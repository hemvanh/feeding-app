import { useEffect, useMemo, useState } from 'react'
import { renderSVG } from 'uqr'
import type { Pet } from '../types'
import { useCoverSrc } from '../utils/coverPhoto'
import { petRecordUrl } from '../utils/petQr'
import { fallbackQrInk, qrInkForPet, type QrInk } from '../utils/qrColors'

function qrSvg(url: string, ink: QrInk) {
  return renderSVG(url, {
    ecc: 'H',
    border: 2,
    blackColor: ink.dark,
    whiteColor: ink.light,
  })
}

export function PetQrCode({ pet }: { pet: Pet }) {
  const coverSrc = useCoverSrc(pet)
  const [ink, setInk] = useState<QrInk>(() => fallbackQrInk(pet))
  const url = petRecordUrl(pet.id)
  const svg = useMemo(() => qrSvg(url, ink), [url, ink])
  const morphs = pet.morphs.length ? pet.morphs.join(' / ') : '—'

  useEffect(() => {
    let cancelled = false
    setInk(fallbackQrInk(pet))
    void qrInkForPet(pet).then((next) => {
      if (!cancelled) setInk(next)
    })
    return () => {
      cancelled = true
    }
  }, [pet.id, pet.coverAt, coverSrc])

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

export function PrintQrSticker({ pet, ink }: { pet: Pet; ink?: QrInk }) {
  const colors = ink ?? fallbackQrInk(pet)
  const url = petRecordUrl(pet.id)
  const svg = useMemo(() => qrSvg(url, colors), [url, colors])
  const morphs = pet.morphs.length ? pet.morphs.join(' / ') : '—'

  return (
    <article className="qr-print-sticker">
      <div className="pet-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="pet-qr-species">{pet.species}</p>
      <p className="pet-qr-morphs">{morphs}</p>
    </article>
  )
}
