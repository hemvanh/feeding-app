import { useEffect, useRef, useState } from 'react'

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  confirmKind = 'danger',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  confirmKind?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}) {
  const [closing, setClosing] = useState(false)
  const finished = useRef(false)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  function requestClose() {
    if (closing || finished.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finished.current = true
      onCancelRef.current()
      return
    }
    setClosing(true)
  }

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => {
      if (finished.current) return
      finished.current = true
      onCancelRef.current()
    }, 150)
    return () => window.clearTimeout(timer)
  }, [closing])

  return (
    <div
      className={`confirm-backdrop${closing ? ' is-closing' : ''}`}
      onClick={requestClose}
      onAnimationEnd={(event) => {
        if (!closing || event.target !== event.currentTarget || event.animationName !== 'pop-fade-out') return
        if (finished.current) return
        finished.current = true
        onCancelRef.current()
      }}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="row-actions">
          <button type="button" className="ghost-btn" onClick={requestClose}>
            Cancel
          </button>
          <button
            type="button"
            className={confirmKind === 'primary' ? 'primary-btn compact' : 'danger-btn'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
