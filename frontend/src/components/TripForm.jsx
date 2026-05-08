import { useState } from 'react'

const SAMPLE_TRIPS = [
  {
    label: 'Chicago → Indianapolis → Atlanta',
    current_location: 'Chicago, IL',
    pickup_location: 'Indianapolis, IN',
    dropoff_location: 'Atlanta, GA',
    current_cycle_used_hours: 12,
  },
  {
    label: 'LA → Phoenix → New York',
    current_location: 'Los Angeles, CA',
    pickup_location: 'Phoenix, AZ',
    dropoff_location: 'New York, NY',
    current_cycle_used_hours: 8,
  },
  {
    label: 'Dallas → Memphis → Charlotte',
    current_location: 'Dallas, TX',
    pickup_location: 'Memphis, TN',
    dropoff_location: 'Charlotte, NC',
    current_cycle_used_hours: 24,
  },
]

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    current_cycle_used_hours: '',
  })
  const [errors, setErrors] = useState({})

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }))
  }

  function validate() {
    const e = {}
    if (!form.current_location.trim()) e.current_location = 'Required'
    if (!form.pickup_location.trim()) e.pickup_location = 'Required'
    if (!form.dropoff_location.trim()) e.dropoff_location = 'Required'
    const hrs = Number(form.current_cycle_used_hours)
    if (form.current_cycle_used_hours === '' || Number.isNaN(hrs)) {
      e.current_cycle_used_hours = 'Enter hours used (0–70)'
    } else if (hrs < 0 || hrs > 70) {
      e.current_cycle_used_hours = 'Must be between 0 and 70'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit({
      ...form,
      current_cycle_used_hours: Number(form.current_cycle_used_hours),
    })
  }

  function loadSample(sample) {
    setForm({
      current_location: sample.current_location,
      pickup_location: sample.pickup_location,
      dropoff_location: sample.dropoff_location,
      current_cycle_used_hours: String(sample.current_cycle_used_hours),
    })
    setErrors({})
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Trip Details</h2>
        <p className="mt-1 text-sm text-ink-500">
          Enter the route and current cycle. We'll plan stops, breaks and rests
          per FMCSA 70hr/8day rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="label-base">Current Location</label>
          <input
            className={`input-base ${errors.current_location ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            placeholder="e.g. Chicago, IL"
            value={form.current_location}
            onChange={(e) => update('current_location', e.target.value)}
          />
          {errors.current_location && (
            <p className="mt-1 text-xs text-red-600">{errors.current_location}</p>
          )}
        </div>

        <div>
          <label className="label-base">Pickup Location</label>
          <input
            className={`input-base ${errors.pickup_location ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            placeholder="e.g. Indianapolis, IN"
            value={form.pickup_location}
            onChange={(e) => update('pickup_location', e.target.value)}
          />
          {errors.pickup_location && (
            <p className="mt-1 text-xs text-red-600">{errors.pickup_location}</p>
          )}
        </div>

        <div>
          <label className="label-base">Dropoff Location</label>
          <input
            className={`input-base ${errors.dropoff_location ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            placeholder="e.g. Atlanta, GA"
            value={form.dropoff_location}
            onChange={(e) => update('dropoff_location', e.target.value)}
          />
          {errors.dropoff_location && (
            <p className="mt-1 text-xs text-red-600">{errors.dropoff_location}</p>
          )}
        </div>

        <div>
          <label className="label-base">
            Current Cycle Used (Hours, last 8 days)
          </label>
          <input
            type="number"
            min="0"
            max="70"
            step="0.25"
            className={`input-base ${errors.current_cycle_used_hours ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            placeholder="0–70"
            value={form.current_cycle_used_hours}
            onChange={(e) => update('current_cycle_used_hours', e.target.value)}
          />
          {errors.current_cycle_used_hours && (
            <p className="mt-1 text-xs text-red-600">
              {errors.current_cycle_used_hours}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Planning…
            </>
          ) : (
            <>
              Plan Trip
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
              </svg>
            </>
          )}
        </button>
      </div>

      <div className="border-t border-ink-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
          Try a sample
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TRIPS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => loadSample(s)}
              className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100 transition"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}
