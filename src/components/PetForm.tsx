import { useState, type FormEvent } from 'react'
import { FEEDER_TYPES, PET_SEXES, SPECIES, feederAmountText, isPresetSpecies, isWaterChange, petSex, petSexLabel, type Pet, type PetSex } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { MorphPicker } from './MorphPicker'

type PetFields = {
  name: string
  species: string
  morphs: string[]
  sex: PetSex
  feedingPeriodDays: number
  feederType: string
  feederAmount: string
  feederWeightGrams: undefined
}

type PetFormProps = {
  initial?: Pet
  submitLabel: string
  confirmSave?: boolean
  onSubmit: (data: PetFields) => Promise<void> | void
}

export function PetForm({ initial, submitLabel, confirmSave = false, onSubmit }: PetFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [species, setSpecies] = useState(initial?.species ?? 'Ball Python')
  const [morphs, setMorphs] = useState<string[]>(initial?.morphs ?? [])
  const [sex, setSex] = useState<PetSex>(petSex(initial?.sex))
  const [period, setPeriod] = useState(String(initial?.feedingPeriodDays ?? 7))
  const [feederType, setFeederType] = useState(initial?.feederType ?? '')
  const [amount, setAmount] = useState(initial ? feederAmountText(initial) : '')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PetFields | null>(null)

  function parsedForm() {
    const trimmed = name.trim()
    const days = Number(period)
    const feeder = feederType.trim()
    const kind = species.trim()
    if (!trimmed) {
      setError('Give this pet a name.')
      return null
    }
    if (!kind) {
      setError('Choose a species, or type a custom one.')
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
    setError('')
    return {
      name: trimmed,
      species: kind,
      morphs,
      sex,
      feedingPeriodDays: Math.round(days),
      feederType: feeder,
      feederAmount: amount.trim(),
      feederWeightGrams: undefined,
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
      <fieldset className="feeder-fieldset">
        <legend>Species</legend>
        <div className="choice-row feeder-choices">
          <select
            value={isPresetSpecies(species) ? species : ''}
            onChange={(e) => {
              setSpecies(e.target.value)
              setMorphs([])
            }}
            aria-label="Species"
          >
            <option value="">Custom</option>
            {SPECIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="feeder-custom"
            value={isPresetSpecies(species) ? '' : species}
            onChange={(e) => {
              if (isPresetSpecies(species)) setMorphs([])
              setSpecies(e.target.value)
            }}
            placeholder="Custom species"
            aria-label="Custom species"
          />
        </div>
        <span className="field-hint">Pick a listed species, or type any other one.</span>
      </fieldset>
      <fieldset>
        <legend>Sex</legend>
        <div className="choice-row">
          {PET_SEXES.map((value) => (
            <label key={value} className={`choice${sex === value ? ' on' : ''}`}>
              <input
                type="radio"
                name="pet-sex"
                checked={sex === value}
                onChange={() => setSex(value)}
              />
              {petSexLabel(value)}
            </label>
          ))}
        </div>
        <span className="field-hint">Unsexed means this pet could be male or female.</span>
      </fieldset>
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
        <span className="field-hint">Pick Mouse, Rat, Chicken, or Water Change, or type any other feeder.</span>
      </fieldset>
      <label>
        Amount
        <input
          value={amount}
          maxLength={40}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={isWaterChange(feederType) ? 'e.g. 150L or NPK 2g/L' : 'e.g. 15g or 2 pinkies'}
        />
        <span className="field-hint">A plain number gets {isWaterChange(feederType) ? 'L' : 'g'} added. Any other text, such as NPK 2g/L, shows as typed.</span>
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
