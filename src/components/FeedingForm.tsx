import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { RESULT_TAGS, outcomeFromResultTags, resultTagOutcome, type FeedingOutcome } from '../types'
import { formatPretty } from '../utils/dates'
import { ConfirmDialog } from './ConfirmDialog'

const EXTENSION_DEFAULTS: Record<'refused' | 'regurgitated', number> = {
  refused: 1,
  regurgitated: 2,
}

type FeedingFormProps = {
  date: string
  defaultOutcome?: FeedingOutcome
  onSubmit: (data: {
    date: string
    note: string
    outcome: FeedingOutcome
    extensionDays: number
    tags: string[]
  }) => Promise<void> | void
}

function startingResults(outcome: FeedingOutcome): FeedingOutcome[] {
  if (outcome === 'fed' || outcome === 'refused' || outcome === 'regurgitated' || outcome === 'water-changed') {
    return [outcome]
  }
  return ['fed']
}

export function FeedingForm({ date, defaultOutcome = 'fed', onSubmit }: FeedingFormProps) {
  const [selected, setSelected] = useState<FeedingOutcome[]>(() => startingResults(defaultOutcome))
  const [custom, setCustom] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [extensionDays, setExtensionDays] = useState(String(EXTENSION_DEFAULTS.refused))
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{
    date: string
    note: string
    outcome: FeedingOutcome
    extensionDays: number
    tags: string[]
  } | null>(null)

  useEffect(() => {
    setSelected(startingResults(defaultOutcome))
  }, [defaultOutcome])

  const failed = selected.includes('refused') || selected.includes('regurgitated')

  function toggleResult(outcome: FeedingOutcome) {
    setSelected((current) => {
      if (current.includes(outcome)) return current.filter((item) => item !== outcome)
      if (outcome === 'refused' || outcome === 'regurgitated') {
        const otherOn = current.includes(outcome === 'refused' ? 'regurgitated' : 'refused')
        if (!otherOn || outcome === 'regurgitated') setExtensionDays(String(EXTENSION_DEFAULTS[outcome]))
      }
      return [...current, outcome]
    })
  }

  function addCustom(raw: string) {
    const tag = raw.trim().replace(/,+$/, '')
    if (!tag) return
    const standard = resultTagOutcome(tag)
    if (standard) {
      setSelected((current) => (current.includes(standard) ? current : [...current, standard]))
      setDraft('')
      return
    }
    setCustom((current) => (current.some((item) => item.toLowerCase() === tag.toLowerCase()) ? current : [...current, tag]))
    setDraft('')
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    addCustom(draft)
  }

  function resolvedTags() {
    const nextSelected = [...selected]
    const nextCustom = [...custom]
    const tag = draft.trim().replace(/,+$/, '')
    if (tag) {
      const standard = resultTagOutcome(tag)
      if (standard) {
        if (!nextSelected.includes(standard)) nextSelected.push(standard)
      } else if (!nextCustom.some((item) => item.toLowerCase() === tag.toLowerCase())) {
        nextCustom.push(tag)
      }
    }
    const tags = [
      ...RESULT_TAGS.filter((item) => nextSelected.includes(item.outcome)).map((item) => item.label),
      ...nextCustom,
    ]
    return { selected: nextSelected, tags }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const resolved = resolvedTags()
    const outcome = outcomeFromResultTags(resolved.tags)
    const needsExtension = resolved.selected.includes('refused') || resolved.selected.includes('regurgitated')
    const extra = needsExtension ? Number(extensionDays) : 0
    if (!date) {
      setError('Tap a day on the calendar to pick the feeding date.')
      return
    }
    if (!resolved.selected.length) {
      setError('Select at least one result.')
      return
    }
    if (needsExtension && (!Number.isFinite(extra) || extra < 1)) {
      setError('Add at least 1 extra day when extending the cycle.')
      return
    }
    setError('')
    setPending({
      date,
      note: resolved.tags.filter((tag) => !resultTagOutcome(tag)).join(' · '),
      outcome,
      extensionDays: extra,
      tags: resolved.tags,
    })
  }

  async function confirmAdd() {
    if (!pending) return
    const data = pending
    setPending(null)
    await onSubmit(data)
    setSelected(startingResults(defaultOutcome))
    setCustom([])
    setDraft('')
    setExtensionDays(String(EXTENSION_DEFAULTS.refused))
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <p className="selected-date">
        <span className="selected-date-line">
          Feeding date: <strong>{formatPretty(date)}</strong>
        </span>
      </p>
      <div className="tag-field" role="group" aria-label="Result">
        {RESULT_TAGS.map((tag) => {
          const on = selected.includes(tag.outcome)
          return (
            <button
              key={tag.outcome}
              type="button"
              className={`choice${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => toggleResult(tag.outcome)}
            >
              {tag.label}
            </button>
          )
        })}
        {custom.map((tag) => (
          <button
            key={tag}
            type="button"
            className="choice on custom-tag"
            onClick={() => setCustom((current) => current.filter((item) => item !== tag))}
          >
            {tag}
            <span aria-hidden="true">×</span>
            <span className="sr-only">Remove {tag}</span>
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onDraftKeyDown}
          placeholder="Add a tag"
          aria-label="Add a custom tag"
        />
      </div>
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
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="primary-btn">
        Add Feeding
      </button>
      {pending ? (
        <ConfirmDialog
          title="Add this feeding?"
          message={`Record ${pending.tags.join(', ')} on ${formatPretty(pending.date)}.`}
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

