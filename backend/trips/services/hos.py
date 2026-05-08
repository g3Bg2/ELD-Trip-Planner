"""Hours-of-Service trip planner.

Implements 70hr/8day property-carrying-driver rules:
  - 11-hour driving limit
  - 14-hour on-duty window
  - 30-minute break after 8 cumulative driving hours
  - 70 hours on-duty in any 8-day period (34-hour restart available)
  - 10 consecutive hours off-duty between shifts
  - 1 hour on-duty (not driving) for pickup and dropoff
  - Fueling at least once every 1,000 miles (30 min on-duty not driving)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, time
from typing import Optional

from .routing import GeocodeResult, RouteLeg, interpolate_along


AVG_SPEED_MPH = 55.0
PICKUP_DROPOFF_HOURS = 1.0
FUEL_STOP_HOURS = 0.5
FUEL_INTERVAL_MILES = 1000.0
BREAK_HOURS = 0.5
DAILY_DRIVE_LIMIT = 11.0
DAILY_WINDOW_LIMIT = 14.0
DRIVE_BEFORE_BREAK = 8.0
WEEKLY_LIMIT = 70.0
RESET_HOURS = 10.0
RESTART_HOURS = 34.0
DEFAULT_START_TIME = time(6, 0)  # 6:00 AM


# Duty status codes
OFF_DUTY = 'off_duty'
SLEEPER = 'sleeper_berth'
DRIVING = 'driving'
ON_DUTY = 'on_duty'  # on-duty not driving


@dataclass
class Event:
    status: str
    start: datetime
    end: datetime
    location: Optional[list[float]] = None  # [lat, lon]
    location_name: Optional[str] = None
    note: str = ''
    miles: float = 0.0

    def to_dict(self) -> dict:
        return {
            'status': self.status,
            'start': self.start.isoformat(),
            'end': self.end.isoformat(),
            'duration_hours': round((self.end - self.start).total_seconds() / 3600, 3),
            'location': self.location,
            'location_name': self.location_name,
            'note': self.note,
            'miles': round(self.miles, 2),
        }


@dataclass
class TripStops:
    label: str
    location: list[float]
    location_name: str
    arrival: datetime
    note: str

    def to_dict(self) -> dict:
        return {
            'label': self.label,
            'location': self.location,
            'location_name': self.location_name,
            'arrival': self.arrival.isoformat(),
            'note': self.note,
        }


@dataclass
class _State:
    now: datetime
    cycle_used: float  # hours used in rolling 70/8
    drive_today: float = 0.0
    window_used: float = 0.0
    drive_since_break: float = 0.0
    miles_since_fuel: float = 0.0
    miles_traveled: float = 0.0


def _position_at(legs: list[tuple[RouteLeg, str, str]], miles: float) -> tuple[list[float], str]:
    """Given total miles traveled, return (lat/lon, leg-label)."""
    cum = 0.0
    for leg, name_from, name_to in legs:
        if miles <= cum + leg.distance_miles:
            frac = (miles - cum) / leg.distance_miles if leg.distance_miles else 0
            pos = interpolate_along(leg.geometry, frac) or leg.geometry[0]
            return pos, f"between {name_from} and {name_to}"
        cum += leg.distance_miles
    last_leg = legs[-1][0]
    return last_leg.geometry[-1], legs[-1][2]


def plan_trip(
    current: GeocodeResult,
    pickup: GeocodeResult,
    dropoff: GeocodeResult,
    leg1: RouteLeg,
    leg2: RouteLeg,
    current_cycle_used_hours: float,
    start_at: Optional[datetime] = None,
) -> dict:
    """Run the HOS simulation and return a serializable plan."""

    if start_at is None:
        today = datetime.utcnow().date()
        start_at = datetime.combine(today, DEFAULT_START_TIME)

    legs = [(leg1, current.display_name, pickup.display_name),
            (leg2, pickup.display_name, dropoff.display_name)]
    pickup_mile = leg1.distance_miles
    total_miles = leg1.distance_miles + leg2.distance_miles

    state = _State(now=start_at, cycle_used=current_cycle_used_hours)
    events: list[Event] = []
    stops: list[TripStops] = []

    def emit(status: str, hours: float, *, location=None, location_name=None,
             note='', miles=0.0):
        end = state.now + timedelta(hours=hours)
        ev = Event(status=status, start=state.now, end=end,
                   location=location, location_name=location_name,
                   note=note, miles=miles)
        events.append(ev)
        state.now = end
        return ev

    # Initial off-duty marker (helps logs render the start of day correctly)
    if start_at.time() > time(0, 0):
        midnight = datetime.combine(start_at.date(), time(0, 0))
        events.append(Event(
            status=OFF_DUTY, start=midnight, end=start_at,
            location=[current.latitude, current.longitude],
            location_name=current.display_name,
            note='Off duty (start of day)',
        ))

    # Guard: if cycle is already exhausted, take a 34-hour restart first.
    if state.cycle_used >= WEEKLY_LIMIT:
        emit(OFF_DUTY, RESTART_HOURS,
             location=[current.latitude, current.longitude],
             location_name=current.display_name,
             note='34-hour restart (cycle exhausted)')
        state.cycle_used = 0.0

    # Pickup-and-dropoff are mandatory on-duty events at their locations.
    pickup_done = False
    dropoff_done = False

    safety = 0  # avoid infinite loops in pathological inputs
    while not dropoff_done and safety < 500:
        safety += 1

        cycle_remaining = WEEKLY_LIMIT - state.cycle_used

        # 1) Need a 34-hour restart?
        if cycle_remaining <= 0:
            pos, label = _position_at(legs, state.miles_traveled)
            emit(OFF_DUTY, RESTART_HOURS,
                 location=pos, location_name=label,
                 note='34-hour restart (70hr/8day cycle limit)')
            state.cycle_used = 0.0
            state.drive_today = 0
            state.window_used = 0
            state.drive_since_break = 0
            continue

        # 2) Need a 10-hour reset?
        if state.drive_today >= DAILY_DRIVE_LIMIT or state.window_used >= DAILY_WINDOW_LIMIT:
            pos, label = _position_at(legs, state.miles_traveled)
            emit(SLEEPER, RESET_HOURS,
                 location=pos, location_name=label,
                 note='10-hour reset (end of duty period)')
            state.drive_today = 0
            state.window_used = 0
            state.drive_since_break = 0
            continue

        # 3) Need a 30-min break?
        if state.drive_since_break >= DRIVE_BEFORE_BREAK:
            pos, label = _position_at(legs, state.miles_traveled)
            emit(OFF_DUTY, BREAK_HOURS,
                 location=pos, location_name=label,
                 note='30-min break (8hr driving rule)')
            state.window_used += BREAK_HOURS
            state.drive_since_break = 0
            continue

        # 4) Pickup activity if we just arrived at pickup
        if not pickup_done and abs(state.miles_traveled - pickup_mile) < 0.01:
            emit(ON_DUTY, PICKUP_DROPOFF_HOURS,
                 location=[pickup.latitude, pickup.longitude],
                 location_name=pickup.display_name,
                 note='Pickup (1 hour on-duty)')
            stops.append(TripStops(
                label='Pickup',
                location=[pickup.latitude, pickup.longitude],
                location_name=pickup.display_name,
                arrival=events[-1].start,
                note='1 hour on-duty for loading',
            ))
            state.window_used += PICKUP_DROPOFF_HOURS
            state.cycle_used += PICKUP_DROPOFF_HOURS
            pickup_done = True
            continue

        # 5) Otherwise: drive
        drive_avail_hours = min(
            DAILY_DRIVE_LIMIT - state.drive_today,
            DAILY_WINDOW_LIMIT - state.window_used,
            DRIVE_BEFORE_BREAK - state.drive_since_break,
            cycle_remaining,
        )
        if drive_avail_hours <= 0:
            # Defensive: shouldn't happen because checks above handled all cases.
            continue

        # Distance to next mandatory anchor:
        anchors_ahead: list[tuple[float, str]] = []
        if not pickup_done:
            anchors_ahead.append((pickup_mile, 'pickup'))
        anchors_ahead.append((total_miles, 'dropoff'))
        next_fuel_at = state.miles_traveled + (FUEL_INTERVAL_MILES - state.miles_since_fuel)
        if next_fuel_at < total_miles:
            anchors_ahead.append((next_fuel_at, 'fuel'))

        anchors_ahead.sort(key=lambda x: x[0])
        next_anchor_miles, next_anchor_kind = next(
            (m, k) for m, k in anchors_ahead if m > state.miles_traveled
        )

        drive_miles_avail = drive_avail_hours * AVG_SPEED_MPH
        miles_to_anchor = next_anchor_miles - state.miles_traveled
        drive_miles = min(drive_miles_avail, miles_to_anchor)
        drive_hours = drive_miles / AVG_SPEED_MPH

        start_pos, _ = _position_at(legs, state.miles_traveled)
        end_miles = state.miles_traveled + drive_miles
        end_pos, end_label = _position_at(legs, end_miles)

        emit(DRIVING, drive_hours,
             location=end_pos, location_name=end_label,
             note=f"Driving {round(drive_miles, 1)} mi",
             miles=drive_miles)
        state.drive_today += drive_hours
        state.window_used += drive_hours
        state.drive_since_break += drive_hours
        state.cycle_used += drive_hours
        state.miles_since_fuel += drive_miles
        state.miles_traveled = end_miles

        # 6) Handle fuel stop arrival
        if next_anchor_kind == 'fuel' and abs(state.miles_traveled - next_anchor_miles) < 0.01:
            pos, label = _position_at(legs, state.miles_traveled)
            emit(ON_DUTY, FUEL_STOP_HOURS,
                 location=pos, location_name=label,
                 note='Fueling stop (every 1,000 miles)')
            stops.append(TripStops(
                label='Fuel',
                location=pos,
                location_name=label,
                arrival=events[-1].start,
                note='~30 min on-duty to refuel',
            ))
            state.window_used += FUEL_STOP_HOURS
            state.cycle_used += FUEL_STOP_HOURS
            state.miles_since_fuel = 0

        # 7) Handle dropoff arrival
        if abs(state.miles_traveled - total_miles) < 0.01 and not dropoff_done:
            emit(ON_DUTY, PICKUP_DROPOFF_HOURS,
                 location=[dropoff.latitude, dropoff.longitude],
                 location_name=dropoff.display_name,
                 note='Dropoff (1 hour on-duty)')
            stops.append(TripStops(
                label='Dropoff',
                location=[dropoff.latitude, dropoff.longitude],
                location_name=dropoff.display_name,
                arrival=events[-1].start,
                note='1 hour on-duty for unloading',
            ))
            state.window_used += PICKUP_DROPOFF_HOURS
            state.cycle_used += PICKUP_DROPOFF_HOURS
            dropoff_done = True

    # Pad final off-duty until midnight of last day so daily log renders fully.
    last_end = events[-1].end if events else state.now
    final_midnight = datetime.combine(
        (last_end + timedelta(days=1)).date(), time(0, 0)
    )
    if last_end < final_midnight:
        events.append(Event(
            status=OFF_DUTY,
            start=last_end,
            end=final_midnight,
            location=[dropoff.latitude, dropoff.longitude],
            location_name=dropoff.display_name,
            note='Off duty (end of trip)',
        ))

    daily_logs = _build_daily_logs(events)

    return {
        'events': [e.to_dict() for e in events],
        'stops': [s.to_dict() for s in stops],
        'daily_logs': daily_logs,
        'totals': {
            'distance_miles': round(total_miles, 2),
            'driving_hours': round(sum(
                (e.end - e.start).total_seconds() / 3600
                for e in events if e.status == DRIVING
            ), 2),
            'on_duty_hours': round(sum(
                (e.end - e.start).total_seconds() / 3600
                for e in events if e.status == ON_DUTY
            ), 2),
            'off_duty_hours': round(sum(
                (e.end - e.start).total_seconds() / 3600
                for e in events if e.status in (OFF_DUTY, SLEEPER)
            ), 2),
            'cycle_used_after_trip': round(state.cycle_used, 2),
            'trip_duration_hours': _trip_duration_hours(events),
        },
    }


def _trip_duration_hours(events: list[Event]) -> float:
    """Active trip time from first work event to last work event (excludes
    bookend off-duty padding so the totals tile shows real elapsed time)."""
    work = [e for e in events if e.status in (DRIVING, ON_DUTY)]
    if not work:
        return 0.0
    return round((work[-1].end - work[0].start).total_seconds() / 3600, 2)


def _build_daily_logs(events: list[Event]) -> list[dict]:
    """Group events into daily log sheets keyed by calendar date.

    Each event spanning a midnight boundary is split. Each daily log includes
    24 segments expressed as (status, start_hour, end_hour) for the grid drawing.
    """
    if not events:
        return []

    by_date: dict[str, list[Event]] = {}

    for ev in events:
        cur_start = ev.start
        cur_end = ev.end
        while cur_start < cur_end:
            day = cur_start.date()
            day_end = datetime.combine(day, time(0, 0)) + timedelta(days=1)
            seg_end = min(cur_end, day_end)
            seg = Event(
                status=ev.status,
                start=cur_start,
                end=seg_end,
                location=ev.location,
                location_name=ev.location_name,
                note=ev.note,
                miles=ev.miles * ((seg_end - cur_start).total_seconds()
                                  / max((ev.end - ev.start).total_seconds(), 1)),
            )
            by_date.setdefault(day.isoformat(), []).append(seg)
            cur_start = seg_end

    logs = []
    for day_str in sorted(by_date.keys()):
        day_events = by_date[day_str]
        # Coalesce consecutive events with the same status to keep segments tidy.
        coalesced: list[Event] = []
        for ev in day_events:
            if coalesced and coalesced[-1].status == ev.status \
                    and coalesced[-1].end == ev.start:
                merged = coalesced[-1]
                coalesced[-1] = Event(
                    status=merged.status,
                    start=merged.start,
                    end=ev.end,
                    location=ev.location,
                    location_name=ev.location_name,
                    note=merged.note + ('; ' + ev.note if ev.note and ev.note != merged.note else ''),
                    miles=merged.miles + ev.miles,
                )
            else:
                coalesced.append(ev)

        # Build 24-hour grid segments
        midnight = datetime.combine(day_events[0].start.date(), time(0, 0))
        segments = []
        for ev in coalesced:
            start_h = (ev.start - midnight).total_seconds() / 3600
            end_h = (ev.end - midnight).total_seconds() / 3600
            segments.append({
                'status': ev.status,
                'start_hour': round(start_h, 4),
                'end_hour': round(end_h, 4),
                'note': ev.note,
                'location_name': ev.location_name,
            })

        # Per-status hour totals
        totals = {OFF_DUTY: 0.0, SLEEPER: 0.0, DRIVING: 0.0, ON_DUTY: 0.0}
        miles = 0.0
        remarks = []
        for ev in coalesced:
            hours = (ev.end - ev.start).total_seconds() / 3600
            totals[ev.status] = totals.get(ev.status, 0.0) + hours
            if ev.status == DRIVING:
                miles += ev.miles
            if ev.note and ev.status != OFF_DUTY:
                remarks.append({
                    'time': ev.start.strftime('%H:%M'),
                    'text': ev.note,
                    'location': ev.location_name,
                })

        logs.append({
            'date': day_str,
            'segments': segments,
            'totals': {k: round(v, 2) for k, v in totals.items()},
            'total_miles': round(miles, 1),
            'remarks': remarks,
            'from_location': day_events[0].location_name,
            'to_location': day_events[-1].location_name,
        })

    return logs
