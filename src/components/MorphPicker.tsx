import { useMemo, useState } from 'react'
import { morphsFor } from '../data/morphs'
import type { Species } from '../types'

type MorphPickerProps = {
  species: Species
  value: string[]
  onChange: (morphs: string[]) => void
}

export function MorphPicker({ species, value, onChange }: MorphPickerProps) {
  const [query, setQuery] = useState('')
  const options = morphsFor(species)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter(
      (morph) =>
        !value.includes(morph) && (q === '' || morph.toLowerCase().includes(q)),
    )
  }, [options, query, value])

  function add(morph: string) {
    const tag = morph.trim()
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
    setQuery('')
  }

  function addCustom() {
    add(query)
  }

  return (
    <div className="morph-picker">
      <div className="chips">
        {value.length === 0 ? (
          <span className="muted">No morphs selected</span>
        ) : (
          value.map((morph) => (
            <button
              key={morph}
              type="button"
              className="chip"
              onClick={() => onChange(value.filter((item) => item !== morph))}
            >
              {morph} <span aria-hidden>×</span>
            </button>
          ))
        )}
      </div>
      <div className="morph-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0]) add(filtered[0])
              else addCustom()
            }
          }}
          placeholder={`Search ${species} morphs`}
        />
        {query.trim() && !options.some((m) => m.toLowerCase() === query.trim().toLowerCase()) ? (
          <button type="button" className="ghost-btn" onClick={addCustom}>
            Add “{query.trim()}”
          </button>
        ) : null}
      </div>
      <div className="morph-list">
        {filtered.map((morph) => (
          <button key={morph} type="button" className="morph-option" onClick={() => add(morph)}>
            {morph}
          </button>
        ))}
      </div>
    </div>
  )
}
