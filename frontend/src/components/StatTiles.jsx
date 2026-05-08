export default function StatTiles({ result }) {
  const totals = result.plan.totals
  const tiles = [
    {
      label: 'Total Distance',
      value: `${totals.distance_miles.toLocaleString()} mi`,
      tint: 'bg-teal-50 text-teal-700',
    },
    {
      label: 'Driving Time',
      value: `${totals.driving_hours.toFixed(1)} hrs`,
      tint: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'On-Duty (Pickup/Drop/Fuel)',
      value: `${totals.on_duty_hours.toFixed(1)} hrs`,
      tint: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Trip Duration',
      value: `${totals.trip_duration_hours.toFixed(1)} hrs`,
      tint: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Cycle Used After Trip',
      value: `${totals.cycle_used_after_trip.toFixed(1)} / 70 hrs`,
      tint: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Daily Logs',
      value: `${result.plan.daily_logs.length} day${result.plan.daily_logs.length === 1 ? '' : 's'}`,
      tint: 'bg-emerald-50 text-emerald-700',
    },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="card p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {t.label}
          </div>
          <div className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-base font-semibold ${t.tint}`}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  )
}
