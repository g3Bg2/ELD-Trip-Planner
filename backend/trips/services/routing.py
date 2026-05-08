"""Geocoding (Nominatim) and routing (OSRM) helpers — both free, no key required."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import requests
from django.conf import settings


class RoutingError(Exception):
    """Raised when an external routing/geocoding call fails."""


@dataclass
class GeocodeResult:
    query: str
    display_name: str
    latitude: float
    longitude: float

    def to_dict(self) -> dict:
        return {
            'query': self.query,
            'display_name': self.display_name,
            'latitude': self.latitude,
            'longitude': self.longitude,
        }


@dataclass
class RouteLeg:
    distance_miles: float
    duration_hours: float
    geometry: list[list[float]]  # list of [lat, lon] for the polyline


def _headers() -> dict:
    return {'User-Agent': settings.APP_USER_AGENT}


def geocode(query: str) -> GeocodeResult:
    """Resolve a free-form address to lat/lon via Nominatim."""
    url = f"{settings.NOMINATIM_URL}/search"
    params = {'q': query, 'format': 'json', 'limit': 1, 'addressdetails': 0}
    try:
        resp = requests.get(url, params=params, headers=_headers(), timeout=15)
        resp.raise_for_status()
        results = resp.json()
    except requests.RequestException as exc:
        raise RoutingError(f"Geocoding service unreachable: {exc}") from exc

    if not results:
        raise RoutingError(f"Could not find a location for '{query}'.")

    item = results[0]
    return GeocodeResult(
        query=query,
        display_name=item['display_name'],
        latitude=float(item['lat']),
        longitude=float(item['lon']),
    )


def route(points: list[GeocodeResult]) -> RouteLeg:
    """Get a driving route through the given points (>=2). Returns combined leg."""
    if len(points) < 2:
        raise RoutingError("At least two points are required to compute a route.")

    coord_str = ';'.join(f"{p.longitude},{p.latitude}" for p in points)
    url = f"{settings.OSRM_URL}/route/v1/driving/{coord_str}"
    params = {'overview': 'full', 'geometries': 'geojson', 'steps': 'false'}
    try:
        resp = requests.get(url, params=params, headers=_headers(), timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        raise RoutingError(f"Routing service unreachable: {exc}") from exc

    if data.get('code') != 'Ok' or not data.get('routes'):
        raise RoutingError(f"Routing failed: {data.get('message', 'unknown error')}.")

    r = data['routes'][0]
    distance_miles = r['distance'] / 1609.344
    duration_hours = r['duration'] / 3600.0
    coords = r['geometry']['coordinates']  # [lon, lat]
    geometry = [[c[1], c[0]] for c in coords]  # convert to [lat, lon]

    return RouteLeg(
        distance_miles=distance_miles,
        duration_hours=duration_hours,
        geometry=geometry,
    )


def interpolate_along(geometry: list[list[float]], fraction: float) -> Optional[list[float]]:
    """Return [lat, lon] at the given fraction (0..1) along the polyline."""
    if not geometry:
        return None
    if fraction <= 0:
        return geometry[0]
    if fraction >= 1:
        return geometry[-1]

    # Build cumulative segment lengths (Euclidean is fine for marker placement)
    cum = [0.0]
    for i in range(1, len(geometry)):
        a, b = geometry[i - 1], geometry[i]
        d = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
        cum.append(cum[-1] + d)
    total = cum[-1]
    if total == 0:
        return geometry[0]

    target = fraction * total
    for i in range(1, len(geometry)):
        if cum[i] >= target:
            seg_frac = (target - cum[i - 1]) / (cum[i] - cum[i - 1] or 1)
            a, b = geometry[i - 1], geometry[i]
            return [a[0] + (b[0] - a[0]) * seg_frac, a[1] + (b[1] - a[1]) * seg_frac]
    return geometry[-1]
