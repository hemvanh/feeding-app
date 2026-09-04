import { useState, type FormEvent } from 'react'
import { FEEDER_TYPES, SPECIES, type Pet, type Species } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { MorphPicker } from './MorphPicker'

type PetFields = {
  name: string
  species: Species
  morphs: string[]
  feedingPeriodDays: number
  feederType: string
  feederWeightGrams: number
}

type PetFormProps = {
  initial?: Pet
  submitLabel: string
  confirmSave?: boolean
  onSubmit: (data: PetFields) => Promise<void> | void
}

export function PetForm({ initial, submitLabel, confirmSave = false, onSubmit }: PetFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [species, setSpecies] = useState<Species>(initial?.species ?? 'Ball Python')
  const [morphs, setMorphs] = useState<string[]>(initial?.morphs ?? [])
  const [period, setPeriod] = useState(String(initial?.feedingPeriodDays ?? 7))
  const [feederType, setFeederType] = useState(initial?.feederType ?? '')
  const [weight, setWeight] = useState(
    initial?.feederWeightGrams && initial.feederWeightGrams > 0 ? String(initial.feederWeightGrams) : '',
  )
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PetFields | null>(null)

  function parsedForm() {
    const trimmed = name.trim()
    const days = Number(period)
    const grams = Number(weight)
    const feeder = feederType.trim()
    if (!trimmed) {
      setError('Give this pet a name.')
      return null
    }
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      setError('Feeding period must be between 1 and 365 days.')
      return null
    }
    if (!feeder) {
      setError('Choose a feeder type, or type a custom one.')
      return null
    }
    if (!Number.isFinite(grams) || grams < 1 || grams > 100000) {
      setError('Weight must be at least 1 gram.')
      return null
    }
    setError('')
    return {
      name: trimmed,
      species,
      morphs,
      feedingPeriodDays: Math.round(days),
      feederType: feeder,
      feederWeightGrams: Math.round(grams),
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const data = parsedForm()
    if (!data) return
    if (confirmSave) {
      setPending(data)
      return
    }
    await onSubmit(data)
  }

  async function confirmChanges() {
    if (!pending) return
    const data = pending
    setPending(null)
    await onSubmit(data)
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Noodle" />
      </label>
      <label>
        Species
        <select
          value={species}
          onChange={(e) => {
            const next = e.target.value as Species
            setSpecies(next)
            setMorphs([])
          }}
        >
          {SPECIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Morphs</legend>
        <MorphPicker species={species} value={morphs} onChange={setMorphs} />
      </fieldset>
      <label>
        Feeding period (days)
        <input
          type="number"
          min={1}
          max={365}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        />
        <span className="field-hint">
          If this is 5, the next feeding is due 5 days after a successful feed.
        </span>
      </label>
      <fieldset className="feeder-fieldset">
        <legend>Feeder type</legend>
        <div className="choice-row feeder-choices">
          {FEEDER_TYPES.map((type) => (
            <label key={type} className={`choice${feederType === type ? ' on' : ''}`}>
              <input
                type="radio"
                name="feeder-type"
                checked={feederType === type}
                onChange={() => setFeederType(type)}
              />
              {type}
            </label>
          ))}
          <input
            className="feeder-custom"
            value={(FEEDER_TYPES as readonly string[]).includes(feederType) ? '' : feederType}
            onChange={(e) => setFeederType(e.target.value)}
            placeholder="Custom feeder"
            aria-label="Custom feeder"
          />
        </div>
        <span className="field-hint">Pick Mouse, Rat, or Chicken, or type any other feeder.</span>
      </fieldset>
      <label>
        Weight (grams)
        <input
          type="number"
          min={1}
          max={100000}
          step={1}
          inputMode="numeric"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="e.g. 15"
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="primary-btn">
        {submitLabel}
      </button>
      {pending ? (
        <ConfirmDialog
          title="Save these changes?"
          message={`Update ${pending.name}'s details.`}
          confirmLabel="Save changes"
          confirmKind="primary"
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmChanges()}
        />
      ) : null}
    </form>
  )
}
