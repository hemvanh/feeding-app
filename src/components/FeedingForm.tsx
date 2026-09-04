import { useState, type FormEvent } from 'react'
import type { FeedingOutcome } from '../types'
import { formatPretty } from '../utils/dates'
import { ConfirmDialog } from './ConfirmDialog'

const EXTENSION_DEFAULTS: Record<'refused' | 'regurgitated', number> = {
  refused: 1,
  regurgitated: 2,
}

type FeedingFormProps = {
  date: string
  onSubmit: (data: {
    date: string
    note: string
    outcome: FeedingOutcome
    extensionDays: number
  }) => Promise<void> | void
}

export function FeedingForm({ date, onSubmit }: FeedingFormProps) {
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState<FeedingOutcome>('fed')
  const [extensionDays, setExtensionDays] = useState(String(EXTENSION_DEFAULTS.refused))
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{
    date: string
    note: string
    outcome: FeedingOutcome
    extensionDays: number
  } | null>(null)

  const failed = outcome === 'refused' || outcome === 'regurgitated'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const extra = failed || outcome === 'extended' ? Number(extensionDays) : 0
    if (!date) {
      setError('Tap a day on the calendar to pick the feeding date.')
      return
    }
    if ((failed || outcome === 'extended') && (!Number.isFinite(extra) || extra < 1)) {
      setError('Add at least 1 extra day when extending the cycle.')
      return
    }
    setError('')
    setPending({
      date,
      note: note.trim(),
      outcome,
      extensionDays: extra,
    })
  }

  async function confirmAdd() {
    if (!pending) return
    const data = pending
    setPending(null)
    await onSubmit(data)
    setNote('')
    setOutcome('fed')
    setExtensionDays(String(EXTENSION_DEFAULTS.refused))
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <p className="selected-date">
        Feeding date: <strong>{formatPretty(date)}</strong>
        <span className="field-hint">Tap a calendar day to change it. It starts on today.</span>
      </p>
      <fieldset>
        <legend>Result</legend>
        <div className="choice-row">
          {(
            [
              ['fed', 'Ate'],
              ['refused', 'Refused'],
              ['regurgitated', 'Regurgitated'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={`choice ${outcome === value ? 'on' : ''}`}>
              <input
                type="radio"
                name="outcome"
                value={value}
                checked={outcome === value}
                onChange={() => {
                  setOutcome(value)
                  if (value === 'refused' || value === 'regurgitated') {
                    setExtensionDays(String(EXTENSION_DEFAULTS[value]))
                  }
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {failed ? (
        <label>
          Extend next feeding by (days)
          <input
            type="number"
            min={1}
            max={60}
            value={extensionDays}
            onChange={(e) => setExtensionDays(e.target.value)}
          />
          <span className="field-hint">
            Pushes the next due date later so you can try again after a refuse or regurgitation.
          </span>
        </label>
      ) : null}
      <label>
        Note
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Prey size, temperature, leftover, behavior…"
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="primary-btn">
        Add Feeding
      </button>
      {pending ? (
        <ConfirmDialog
          title="Add this feeding?"
          message={`Record ${pending.outcome === 'fed' ? 'Ate' : pending.outcome === 'refused' ? 'Refused' : pending.outcome === 'regurgitated' ? 'Regurgitated' : 'Extended'} on ${formatPretty(pending.date)}.`}
          confirmLabel="Add Feeding"
          confirmKind="primary"
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmAdd()}
        />
      ) : null}
    </form>
  )
}

type ExtendFormProps = {
  defaultDays: number
  onSubmit: (days: number, note: string) => Promise<void> | void
}

export function ExtendForm({ defaultDays, onSubmit }: ExtendFormProps) {
  const [days, setDays] = useState(String(defaultDays))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ days: number; note: string } | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const extra = Number(days)
    if (!Number.isFinite(extra) || extra < 1) {
      setError('Enter at least 1 day.')
      return
    }
    setError('')
    setPending({ days: Math.round(extra), note: note.trim() })
  }

  async function confirmExtend() {
    if (!pending) return
    const data = pending
    setPending(null)
    await onSubmit(data.days, data.note)
    setNote('')
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        Extra days
        <input type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} />
      </label>
      <label>
        Note
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why the cycle is being pushed…"
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="primary-btn">
        Extend next feeding
      </button>
      {pending ? (
        <ConfirmDialog
          title="Extend next feeding?"
          message={`Push the next due date later by ${pending.days} day${pending.days === 1 ? '' : 's'}.`}
          confirmLabel="Extend"
          confirmKind="primary"
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmExtend()}
        />
      ) : null}
    </form>
  )
}
