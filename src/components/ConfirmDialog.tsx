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
  return (
    <div className="confirm-backdrop" onClick={onCancel}>
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
          <button type="button" className="ghost-btn" onClick={onCancel}>
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
