import { useRef, useState } from 'react'
import { db } from '../db'
import { deleteGitHubFile, isGitHubConnected, putGitHubBytes } from '../github'
import type { Pet } from '../types'
import { compressCover, coverPhotoPath, setLocalCoverPreview, useCoverSrc } from '../utils/coverPhoto'
import { ConfirmDialog } from './ConfirmDialog'

export function CoverPhoto({ pet, editable = true }: { pet: Pet; editable?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const src = useCoverSrc(pet)

  async function onPick(file: File | undefined) {
    if (!file) return
    if (!isGitHubConnected()) {
      setError('Connect GitHub in the bar above so this photo syncs to iPhone and PC.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const bytes = await compressCover(file)
      setLocalCoverPreview(pet.id, bytes)
      const stamp = String(Date.now())
      await putGitHubBytes(coverPhotoPath(pet.id, stamp), bytes, `Update cover photo for ${pet.name}`)
      if (pet.coverAt) {
        const previous = coverPhotoPath(pet.id, pet.coverAt)
        const next = coverPhotoPath(pet.id, stamp)
        if (previous !== next) {
          try {
            await deleteGitHubFile(previous, `Replace cover photo for ${pet.name}`)
          } catch {
            /* old file may already be gone */
          }
        }
      }
      await db.pets.update(pet.id, { coverAt: stamp })
    } catch (err) {
      setLocalCoverPreview(pet.id, null)
      setError(err instanceof Error ? err.message : 'Could not save this photo.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function removeCover() {
    setConfirmRemove(false)
    setBusy(true)
    setError('')
    try {
      if (isGitHubConnected() && pet.coverAt) {
        await deleteGitHubFile(coverPhotoPath(pet.id, pet.coverAt), `Remove cover photo for ${pet.name}`)
      }
      setLocalCoverPreview(pet.id, null)
      await db.pets.update(pet.id, { coverAt: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this photo.')
    } finally {
      setBusy(false)
    }
  }

  if (!editable) {
    if (!src) return null
    return (
      <div className="cover-photo">
        <img key={src} className="cover-photo-img" src={src} alt={`${pet.name} cover`} />
      </div>
    )
  }

  return (
    <div className="cover-photo">
      {src ? (
        <img key={src} className="cover-photo-img" src={src} alt={`${pet.name} cover`} />
      ) : (
        <div className="cover-photo-img placeholder" aria-hidden>
          No photo
        </div>
      )}
      <div className="cover-photo-actions">
        <label className={`ghost-btn cover-photo-pick${busy ? ' is-busy' : ''}`}>
          <input
            ref={input}
            className="cover-photo-file"
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/*"
            disabled={busy}
            onChange={(event) => void onPick(event.target.files?.[0])}
          />
          {busy ? 'Saving…' : src ? 'Change photo' : 'Add from Photos'}
        </label>
        {src ? (
          <button type="button" className="text-btn" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        ) : null}
        <span className="field-hint">
          iPhone will not grant this app Photos access in Settings — that is normal, and you will not get a
          privacy prompt. Pick the photo in the sheet (Photo Library or Browse).
        </span>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {confirmRemove ? (
        <ConfirmDialog
          title="Remove cover photo?"
          message={`${pet.name}'s photo will be deleted from GitHub.`}
          confirmLabel="Remove"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => void removeCover()}
        />
      ) : null}
    </div>
  )
}

export function CoverThumb({ pet }: { pet: Pet }) {
  const src = useCoverSrc(pet)
  if (!src) return <div className="cover-thumb placeholder" aria-hidden />
  return <img key={src} className="cover-thumb" src={src} alt="" />
}
