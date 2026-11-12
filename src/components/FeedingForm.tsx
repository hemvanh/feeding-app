import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  MOLT_TAG,
  RESULT_TAGS,
  isMoltTag,
  outcomeFromResultTags,
  resultTagOutcome,
  type FeedingOutcome,
} from '../types'
import { formatPretty } from '../utils/dates'
import { ConfirmDialog } from './ConfirmDialog'

const EXTENSION_DEFAULTS = {
  refused: 1,
  regurgitated: 2,
  molt: 3,
  manual: 3,
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

type PendingFeeding = {
  date: string
  note: string
  outcome: FeedingOutcome
  extensionDays: number
  tags: string[]
}

function startingResults(outcome: FeedingOutcome): FeedingOutcome[] {
  if (outcome === 'fed' || outcome === 'refused' || outcome === 'regurgitated' || outcome === 'water-changed') {
    return [outcome]
  }
  return ['fed']
}

function suggestedDays(selected: FeedingOutcome[], molt: boolean): number | null {
  const days = [
    selected.includes('refused') ? EXTENSION_DEFAULTS.refused : 0,
    selected.includes('regurgitated') ? EXTENSION_DEFAULTS.regurgitated : 0,
    molt ? EXTENSION_DEFAULTS.molt : 0,
  ]
  const best = Math.max(...days)
  return best > 0 ? best : null
}

export function FeedingForm({ date, defaultOutcome = 'fed', onSubmit }: FeedingFormProps) {
  const [selected, setSelected] = useState<FeedingOutcome[]>(() => startingResults(defaultOutcome))
  const [molt, setMolt] = useState(false)
  const [custom, setCustom] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [extend, setExtend] = useState(false)
  const [extensionDays, setExtensionDays] = useState(String(EXTENSION_DEFAULTS.manual))
  const [extensionNote, setExtensionNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingFeeding | null>(null)

  useEffect(() => {
    setSelected(startingResults(defaultOutcome))
  }, [defaultOutcome])

  function syncExtend(nextSelected: FeedingOutcome[], nextMolt: boolean, turnedOn: boolean) {
    const days = suggestedDays(nextSelected, nextMolt)
    if (turnedOn && days) {
      setExtend(true)
      setExtensionDays(String(days))
    } else if (!turnedOn && !days) {
      setExtend(false)
    }
  }

  function toggleResult(outcome: FeedingOutcome) {
    setError('')
    const on = !selected.includes(outcome)
    const next = on ? [...selected, outcome] : selected.filter((item) => item !== outcome)
    setSelected(next)
    if (outcome === 'refused' || outcome === 'regurgitated') syncExtend(next, molt, on)
  }

  function toggleMolt() {
    setError('')
    const on = !molt
    setMolt(on)
    syncExtend(selected, on, on)
  }

  function toggleExtend() {
    setError('')
    if (!extend) setExtensionDays(String(suggestedDays(selected, molt) ?? EXTENSION_DEFAULTS.manual))
    setExtend(!extend)
  }

  function addCustom(raw: string) {
    const tag = raw.trim().replace(/,+$/, '')
    if (!tag) return
    setError('')
    setDraft('')
    if (isMoltTag(tag)) {
      if (!molt) toggleMolt()
      return
    }
    const standard = resultTagOutcome(tag)
    if (standard) {
      if (!selected.includes(standard)) toggleResult(standard)
      return
    }
    setCustom((current) => (current.some((item) => item.toLowerCase() === tag.toLowerCase()) ? current : [...current, tag]))
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    addCustom(draft)
  }

  function resolvedTags() {
    const nextSelected = [...selected]
    const nextCustom = [...custom]
    let nextMolt = molt
    const tag = draft.trim().replace(/,+$/, '')
    if (tag) {
      const standard = resultTagOutcome(tag)
      if (isMoltTag(tag)) nextMolt = true
      else if (standard) {
        if (!nextSelected.includes(standard)) nextSelected.push(standard)
      } else if (!nextCustom.some((item) => item.toLowerCase() === tag.toLowerCase())) {
        nextCustom.push(tag)
      }
    }
    const standardLabels = RESULT_TAGS.filter((item) => nextSelected.includes(item.outcome)).map((item) => item.label)
    return [...standardLabels, ...(nextMolt ? [MOLT_TAG] : []), ...nextCustom]
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const tags = resolvedTags()
    const extra = extend ? Number(extensionDays) : 0
    if (!date) {
      setError('Tap a day on the calendar to pick the feeding date.')
      return
    }
    if (!tags.length && !extend) {
      setError('Select a result, add a tag, or extend.')
      return
    }
    if (extend && (!Number.isFinite(extra) || extra < 1)) {
      setError('Add at least 1 extra day when extending.')
      return
    }
    setError('')
    setPending({
      date,
      note: extend ? extensionNote.trim() : '',
      outcome: outcomeFromResultTags(tags, extend),
      extensionDays: extend ? Math.round(extra) : 0,
      tags,
    })
  }

  async function confirmAdd() {
    if (!pending) return
    const data = pending
    setPending(null)
    await onSubmit(data)
    setSelected(startingResults(defaultOutcome))
    setMolt(false)
    setCustom([])
    setDraft('')
    setExtend(false)
    setExtensionDays(String(EXTENSION_DEFAULTS.manual))
    setExtensionNote('')
  }

  function confirmMessage(data: PendingFeeding) {
    const what = data.tags.length ? data.tags.join(', ') : 'an extension'
    const push = data.extensionDays
      ? ` Push the next feeding ${data.extensionDays} day${data.extensionDays === 1 ? '' : 's'} later.`
      : ''
    return `Record ${what} on ${formatPretty(data.date)}.${push}`
  }

  const resultButton = (outcome: FeedingOutcome, label: string) => {
    const on = selected.includes(outcome)
    return (
      <button
        key={outcome}
        type="button"
        className={`choice${on ? ' on' : ''}`}
        aria-pressed={on}
        onClick={() => toggleResult(outcome)}
      >
        {label}
      </button>
    )
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <p className="selected-date">
        <span className="selected-date-line">
          Feeding date: <strong>{formatPretty(date)}</strong>
        </span>
      </p>
      <div className={`tag-field${extend ? ' is-extend' : ''}`} role="group" aria-label="Result">
        {RESULT_TAGS.map((tag) => resultButton(tag.outcome, tag.label))}
        <button
          type="button"
          className={`choice${molt ? ' on' : ''}`}
          aria-pressed={molt}
          onClick={toggleMolt}
        >
          {MOLT_TAG}
        </button>
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
          onBlur={() => addCustom(draft)}
          placeholder="Add a tag"
          aria-label="Add a custom tag"
        />
      </div>
      <div className={`extend-row${extend ? ' is-on' : ''}`}>
        <label className="extend-toggle">
          <input type="checkbox" checked={extend} onChange={toggleExtend} />
          Extend
        </label>
        <label className="extend-days">
          <span className="sr-only">Extra days</span>
          <input
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            value={extensionDays}
            disabled={!extend}
            onChange={(e) => setExtensionDays(e.target.value)}
            aria-label="Extra days"
          />
          <span aria-hidden="true">days</span>
        </label>
        <input
          className="extend-note"
          value={extensionNote}
          disabled={!extend}
          onChange={(e) => setExtensionNote(e.target.value)}
          placeholder="Notes"
          aria-label="Extension notes"
        />
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="primary-btn">
        Add Feeding
      </button>
      {pending ? (
        <ConfirmDialog
          title="Add this feeding?"
          message={confirmMessage(pending)}
          confirmLabel="Add Feeding"
          confirmKind="primary"
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmAdd()}
        />
      ) : null}
    </form>
  )
}
