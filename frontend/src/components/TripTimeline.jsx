const STATUS_COLOR = {
  off_duty: 'bg-slate-200 text-slate-700',
  sleeper_berth: 'bg-indigo-100 text-indigo-700',
  driving: 'bg-teal-100 text-teal-700',
  on_duty: 'bg-amber-100 text-amber-800',
}

const STATUS_LABEL = {
  off_duty: 'Off Duty',
  sleeper_berth: 'Sleeper',
  driving: 'Driving',
  on_duty: 'On Duty',
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TripTimeline({ events }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100">
        <h2 className="text-base font-semibold text-ink-900">
          Trip Timeline
        </h2>
        <p className="text-xs text-ink-500">
          Every duty status change, in chronological order.
        </p>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-ink-100">
        {events.map((ev, i) => (
          <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-ink-50">
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[ev.status] || 'bg-slate-100'}`}
            >
              {STATUS_LABEL[ev.status] || ev.status}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink-900 truncate">
                {ev.note || '—'}
              </div>
              <div className="text-xs text-ink-500 font-mono">
                {fmtTime(ev.start)} → {fmtTime(ev.end)} ·{' '}
                {ev.duration_hours.toFixed(2)} hrs
                {ev.miles ? ` · ${ev.miles.toFixed(1)} mi` : ''}
              </div>
              {ev.location_name && (
                <div className="text-xs text-ink-500 truncate">
                  {ev.location_name}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
