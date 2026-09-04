import { useState, type FormEvent } from 'react'
import { SPECIES, type Pet, type Species } from '../types'
import { MorphPicker } from './MorphPicker'

type PetFormProps = {
  initial?: Pet
  submitLabel: string
  onSubmit: (data: {
    name: string
    species: Species
    morphs: string[]
    feedingPeriodDays: number
  }) => Promise<void> | void
}

export function PetForm({ initial, submitLabel, onSubmit }: PetFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [species, setSpecies] = useState<Species>(initial?.species ?? 'Ball Python')
  const [morphs, setMorphs] = useState<string[]>(initial?.morphs ?? [])
  const [period, setPeriod] = useState(String(initial?.feedingPeriodDays ?? 7))
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    const days = Number(period)
    if (!trimmed) {
      setError('Give this pet a name.')
      return
    }
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      setError('Feeding period must be between 1 and 365 days.')
      return
    }
    setError('')
    await onSubmit({
      name: trimmed,
      species,
      morphs,
      feedingPeriodDays: Math.round(days),
    })
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
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="primary-btn">
        {submitLabel}
      </button>
    </form>
  )
}
