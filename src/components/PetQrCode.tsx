import { useMemo } from 'react'
import { renderSVG } from 'uqr'
import type { Pet } from '../types'
import { petRecordUrl } from '../utils/petQr'

export function PetQrCode({ pet }: { pet: Pet }) {
  const url = petRecordUrl(pet.id)
  const svg = useMemo(() => renderSVG(url, { ecc: 'H', border: 2 }), [url])
  const morphs = pet.morphs.length ? pet.morphs.join(' / ') : '—'

  return (
    <div className="pet-qr-slot">
      <div className="pet-qr">
        <div className="pet-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="pet-qr-species">{pet.species}</p>
        <p className="pet-qr-morphs">{morphs}</p>
      </div>
    </div>
  )
}

export function PrintQrSticker({ pet }: { pet: Pet }) {
  const url = petRecordUrl(pet.id)
  const svg = useMemo(() => renderSVG(url, { ecc: 'H', border: 2 }), [url])
  const morphs = pet.morphs.length ? pet.morphs.join(' / ') : '—'

  return (
    <article className="qr-print-sticker">
      <div className="pet-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="pet-qr-species">{pet.species}</p>
      <p className="pet-qr-morphs">{morphs}</p>
    </article>
  )
}
