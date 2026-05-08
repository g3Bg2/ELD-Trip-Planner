import { useState } from 'react'

import TripForm from './components/TripForm'
import RouteMap from './components/RouteMap'
import DailyLogSheet from './components/DailyLogSheet'
import StatTiles from './components/StatTiles'
import TripTimeline from './components/TripTimeline'
import { planTrip } from './api'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(payload) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await planTrip(payload)
      setResult(data)
    } catch (e) {
      const msg =
        e.response?.data?.error ||
        e.response?.data?.detail ||
        (typeof e.response?.data === 'object'
          ? Object.values(e.response.data).flat().join(' ')
          : null) ||
        e.message ||
        'Failed to plan trip'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-accent text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 17h2l1-3h12l1 3h2"></path>
                <path d="M5 17v3M19 17v3"></path>
                <path d="M6 14l1.5-5h9L18 14"></path>
                <circle cx="8" cy="20" r="1.5" fill="currentColor"></circle>
                <circle cx="16" cy="20" r="1.5" fill="currentColor"></circle>
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold text-ink-900">
                ELD Trip Planner
              </div>
              <div className="text-xs text-ink-500">
                Route, rest stops & FMCSA daily logs — for property-carrying drivers
              </div>
            </div>
          </div>
          <a
            href="https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex text-xs text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline"
          >
            70hr/8day rules reference ↗
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <TripForm onSubmit={handleSubmit} loading={loading} />
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <strong className="font-semibold">Couldn't plan trip.</strong>
                <div className="mt-1">{error}</div>
              </div>
            )}
          </div>
          <div className="lg:col-span-8">
            {!result && !loading && (
              <EmptyState />
            )}
            {loading && <LoadingState />}
            {result && <RouteMap result={result} />}
          </div>
        </div>

        {result && (
          <>
            <StatTiles result={result} />
            <TripTimeline events={result.plan.events} />
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-ink-900">
                  Daily Log Sheets
                </h2>
                <span className="text-xs text-ink-500">
                  {result.plan.daily_logs.length} sheet
                  {result.plan.daily_logs.length === 1 ? '' : 's'} generated
                </span>
              </div>
              <div className="space-y-4">
                {result.plan.daily_logs.map((log, i) => (
                  <DailyLogSheet
                    key={log.date}
                    log={log}
                    dayNumber={i + 1}
                    totalDays={result.plan.daily_logs.length}
                    headerInfo={{
                      carrier: 'ELD Demo Carrier',
                      terminal: result.geocoded.current.display_name,
                    }}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="pt-6 pb-8 text-center text-xs text-ink-500">
          Powered by OpenStreetMap (Nominatim) and OSRM. Built with Django + React.
        </footer>
      </main>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-ink-100 grid place-items-center">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink-500" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3 7-7" />
          <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h7" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-900">
        Plan a trip to see your route & logs
      </h3>
      <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
        Enter your current location, pickup, dropoff and current cycle hours.
        We'll fetch the route, schedule mandatory breaks and rests, and
        generate one or more daily log sheets.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="card p-10 text-center">
      <svg className="mx-auto h-8 w-8 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p className="mt-3 text-sm text-ink-700 font-medium">Planning your trip…</p>
      <p className="mt-1 text-xs text-ink-500">
        Geocoding addresses, fetching the route, and simulating HOS rules.
      </p>
    </div>
  )
}
