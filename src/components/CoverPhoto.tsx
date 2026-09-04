import { useRef, useState } from 'react'
import { db } from '../db'
import { deleteGitHubFile, isGitHubConnected, putGitHubBytes } from '../github'
import type { Pet } from '../types'
import { compressCover, coverPhotoPath, coverPhotoUrl } from '../utils/coverPhoto'
import { ConfirmDialog } from './ConfirmDialog'

export function CoverPhoto({ pet, editable = true }: { pet: Pet; editable?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const src = coverPhotoUrl(pet)

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
      await putGitHubBytes(coverPhotoPath(pet.id), bytes, `Update cover photo for ${pet.name}`)
      await db.pets.update(pet.id, { coverAt: new Date().toISOString() })
    } catch (err) {
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
      if (isGitHubConnected()) {
        await deleteGitHubFile(coverPhotoPath(pet.id), `Remove cover photo for ${pet.name}`)
      }
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
        <img className="cover-photo-img" src={src} alt={`${pet.name} cover`} />
      </div>
    )
  }

  return (
    <div className="cover-photo">
      {src ? (
        <img className="cover-photo-img" src={src} alt={`${pet.name} cover`} />
      ) : (
        <div className="cover-photo-img placeholder" aria-hidden>
          No photo
        </div>
      )}
      <div className="cover-photo-actions">
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(event) => void onPick(event.target.files?.[0])}
        />
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? 'Saving…' : src ? 'Change photo' : 'Add from Photos'}
        </button>
        {src ? (
          <button type="button" className="text-btn" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        ) : null}
        <span className="field-hint">Opens the iPhone Photos picker (or camera / files on this device).</span>
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
  const src = coverPhotoUrl(pet)
  if (!src) return <div className="cover-thumb placeholder" aria-hidden />
  return <img className="cover-thumb" src={src} alt="" />
}
