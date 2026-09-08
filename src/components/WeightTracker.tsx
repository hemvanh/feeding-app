import { useState, type FormEvent } from 'react'
import { db, newId } from '../db'
import { formatGrams, parseGramsInput, type Pet, type Weighing } from '../types'
import { daysBetween, formatPretty, todayISO } from '../utils/dates'
import { ConfirmDialog } from './ConfirmDialog'

function formatGramsTyping(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('en-US')
}

function chronological(weighings: Weighing[]): Weighing[] {
  return [...weighings].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.createdAt.localeCompare(b.createdAt)
  })
}

function growthLabel(current: Weighing, previous: Weighing | undefined): string | null {
  if (!previous) return null
  const delta = current.grams - previous.grams
  const sign = delta > 0 ? '+' : ''
  const days = daysBetween(previous.date, current.date)
  if (days > 0) {
    const perDay = delta / days
    const perDayLabel = `${perDay > 0 ? '+' : ''}${perDay.toLocaleString('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} g/day`
    return `${sign}${formatGrams(delta)} g · ${perDayLabel}`
  }
  return `${sign}${formatGrams(delta)} g`
}

export function WeightTracker({ pet }: { pet: Pet }) {
  const [date, setDate] = useState(todayISO())
  const [grams, setGrams] = useState('')
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Weighing | null>(null)

  const rows = chronological(pet.weighings ?? [])
  const newestFirst = [...rows].reverse()

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const amount = parseGramsInput(grams)
    if (!amount) {
      setError('Weight must be greater than 0 grams.')
      return
    }
    if (!date) {
      setError('Pick a weighing date.')
      return
    }
    setError('')
    const entry: Weighing = {
      id: newId(),
      date,
      grams: amount,
      createdAt: new Date().toISOString(),
    }
    await db.pets.update(pet.id, { weighings: [...(pet.weighings ?? []), entry] })
    setGrams('')
    setDate(todayISO())
  }

  async function removeWeighing(id: string) {
    await db.pets.update(pet.id, {
      weighings: (pet.weighings ?? []).filter((item) => item.id !== id),
    })
    setPendingDelete(null)
  }

  return (
    <div className="weight-tracker">
      <h2>Weight tracking</h2>
      <form className="stack weight-add" onSubmit={handleAdd}>
        <label>
          Weighing date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Pet weight (grams)
          <input
            inputMode="numeric"
            value={grams}
            onChange={(e) => setGrams(formatGramsTyping(e.target.value))}
            placeholder="e.g. 1,250"
            aria-label="Pet weight in grams"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="primary-btn compact">
          Add weighing
        </button>
      </form>
      {newestFirst.length === 0 ? (
        <p className="muted">No weighings yet. Add a weight and date to track growth.</p>
      ) : (
        <ul className="history weight-log">
          {newestFirst.map((item, index) => {
            const previous = rows[rows.length - 2 - index]
            const growth = growthLabel(item, previous)
            return (
              <li key={item.id}>
                <div>
                  <strong>{formatPretty(item.date)}</strong>
                  <span>{formatGrams(item.grams)} g</span>
                </div>
                {growth ? <p className="muted">{growth}</p> : <p className="muted">First record</p>}
                <button type="button" className="text-btn" onClick={() => setPendingDelete(item)}>
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this weighing?"
          message={`Remove ${formatGrams(pendingDelete.grams)} g from ${formatPretty(pendingDelete.date)}. This cannot be undone.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void removeWeighing(pendingDelete.id)}
        />
      ) : null}
    </div>
  )
}
