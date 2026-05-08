import { useMemo } from 'react'

/**
 * Renders a single FMCSA Drivers Daily Log sheet from one day of duty events.
 * The grid follows the standard 24-hour, 4-status layout.
 */

const STATUSES = [
  { key: 'off_duty', label: '1. Off Duty' },
  { key: 'sleeper_berth', label: '2. Sleeper Berth' },
  { key: 'driving', label: '3. Driving' },
  { key: 'on_duty', label: '4. On Duty (not driving)' },
]

const STATUS_INDEX = STATUSES.reduce((acc, s, i) => {
  acc[s.key] = i
  return acc
}, {})

export default function DailyLogSheet({ log, dayNumber, totalDays, headerInfo }) {
  // SVG layout
  const left = 175       // status label gutter
  const right = 60       // total-hours gutter
  const top = 30
  const rowH = 32
  const innerWidth = 720 // 30 px per hour
  const W = left + innerWidth + right
  const H = top + STATUSES.length * rowH + 30

  const hourX = (h) => left + (h / 24) * innerWidth
  const rowY = (idx) => top + idx * rowH + rowH / 2

  // Build the trace polyline from log segments
  const tracePoints = useMemo(() => {
    if (!log?.segments?.length) return []
    const pts = []
    let prevIdx = null
    for (const seg of log.segments) {
      const idx = STATUS_INDEX[seg.status] ?? 0
      const x1 = hourX(seg.start_hour)
      const x2 = hourX(seg.end_hour)
      const y = rowY(idx)
      if (prevIdx !== null && prevIdx !== idx) {
        // vertical transition at the boundary x
        pts.push([x1, rowY(prevIdx)])
        pts.push([x1, y])
      }
      pts.push([x1, y])
      pts.push([x2, y])
      prevIdx = idx
    }
    return pts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log])

  const polyline = tracePoints.map(([x, y]) => `${x},${y}`).join(' ')

  const dateObj = log?.date ? new Date(log.date + 'T00:00:00') : null
  const mm = dateObj ? String(dateObj.getMonth() + 1).padStart(2, '0') : '--'
  const dd = dateObj ? String(dateObj.getDate()).padStart(2, '0') : '--'
  const yyyy = dateObj ? dateObj.getFullYear() : '----'

  const totals = log?.totals || {}

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-ink-100 bg-ink-50">
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            Daily Log — Day {dayNumber} of {totalDays}
          </h3>
          <p className="text-xs text-ink-500 font-mono">
            {dateObj?.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="text-xs text-ink-500">
          {(log?.total_miles ?? 0).toFixed(1)} mi today
        </div>
      </div>

      <div className="p-4 overflow-x-auto bg-white">
        {/* Header strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
          <Field label="Date" value={`${mm} / ${dd} / ${yyyy}`} mono />
          <Field label="From" value={log?.from_location || '—'} />
          <Field label="To" value={log?.to_location || '—'} />
          <Field
            label="Total Miles Driving"
            value={`${(log?.total_miles ?? 0).toFixed(1)}`}
            mono
          />
          {headerInfo?.carrier && (
            <Field label="Carrier" value={headerInfo.carrier} />
          )}
          {headerInfo?.terminal && (
            <Field label="Home Terminal" value={headerInfo.terminal} />
          )}
        </div>

        {/* The grid */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Daily log 24-hour grid"
        >
          {/* Hour header */}
          <g fontSize="9" fill="#3a4254" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
            {Array.from({ length: 25 }).map((_, h) => {
              const label =
                h === 0 || h === 24 ? 'Mid' : h === 12 ? 'Noon' : h % 12 || 12
              return (
                <text key={h} x={hourX(h)} y={top - 12}>
                  {label}
                </text>
              )
            })}
            <text x={left + innerWidth + right / 2} y={top - 12} fontWeight={600}>
              Total
            </text>
          </g>

          {/* Row backgrounds + labels */}
          {STATUSES.map((s, i) => {
            const y = top + i * rowH
            return (
              <g key={s.key}>
                <rect
                  x={left}
                  y={y}
                  width={innerWidth}
                  height={rowH}
                  fill={i % 2 === 0 ? '#f7f8fa' : '#ffffff'}
                  stroke="#3a4254"
                  strokeWidth={0.6}
                />
                <text
                  x={left - 8}
                  y={y + rowH / 2 + 3}
                  textAnchor="end"
                  fontSize="10.5"
                  fill="#1a1f2c"
                  fontWeight={500}
                >
                  {s.label}
                </text>
                {/* Total hours per status */}
                <text
                  x={left + innerWidth + right / 2}
                  y={y + rowH / 2 + 3}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  fill="#1a1f2c"
                >
                  {(totals[s.key] || 0).toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* Vertical hour ticks */}
          {Array.from({ length: 25 }).map((_, h) => (
            <line
              key={`vh-${h}`}
              x1={hourX(h)}
              x2={hourX(h)}
              y1={top}
              y2={top + STATUSES.length * rowH}
              stroke="#3a4254"
              strokeWidth={h % 6 === 0 ? 1 : 0.6}
            />
          ))}

          {/* Quarter-hour minor ticks */}
          {Array.from({ length: 24 * 4 + 1 }).map((_, q) => {
            const x = left + (q / (24 * 4)) * innerWidth
            return (
              <g key={`q-${q}`}>
                {STATUSES.map((_, i) => (
                  <line
                    key={i}
                    x1={x}
                    x2={x}
                    y1={top + i * rowH + rowH * 0.66}
                    y2={top + i * rowH + rowH}
                    stroke="#bbc2cf"
                    strokeWidth={0.4}
                  />
                ))}
              </g>
            )
          })}

          {/* The duty trace */}
          {polyline && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#0f766e"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Remarks */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Remarks
            </div>
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
              {(log?.remarks || []).length === 0 ? (
                <p className="text-ink-500">No on-duty events.</p>
              ) : (
                (log.remarks || []).map((r, i) => (
                  <p key={i} className="font-mono">
                    <span className="text-accent">{r.time}</span> — {r.text}
                    {r.location ? (
                      <span className="text-ink-500"> · {r.location}</span>
                    ) : null}
                  </p>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Recap
            </div>
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs grid grid-cols-2 gap-y-1.5 font-mono">
              <span className="text-ink-500">Off Duty:</span>
              <span>{(totals.off_duty || 0).toFixed(2)} hrs</span>
              <span className="text-ink-500">Sleeper Berth:</span>
              <span>{(totals.sleeper_berth || 0).toFixed(2)} hrs</span>
              <span className="text-ink-500">Driving:</span>
              <span>{(totals.driving || 0).toFixed(2)} hrs</span>
              <span className="text-ink-500">On Duty:</span>
              <span>{(totals.on_duty || 0).toFixed(2)} hrs</span>
              <span className="text-ink-500 border-t border-ink-200 pt-1.5">
                Total:
              </span>
              <span className="border-t border-ink-200 pt-1.5">
                {(
                  (totals.off_duty || 0) +
                  (totals.sleeper_berth || 0) +
                  (totals.driving || 0) +
                  (totals.on_duty || 0)
                ).toFixed(2)}{' '}
                hrs
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm text-ink-900 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}
