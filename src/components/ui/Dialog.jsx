import { useEffect, useId, useRef } from 'react'
import { Button } from './Button.jsx'

/*
  A confirm dialog on the native <dialog> element. showModal() gives us,
  for free: focus moved into the dialog, focus kept inside it, Escape to
  close, the rest of the page made inert, and focus returned afterwards.
*/
export function ConfirmDialog({ open, title, children, confirmLabel = 'OK', cancelLabel = 'Cancel', tone = 'primary', onConfirm, onCancel, busy = false }) {
  const ref = useRef(null)
  const id = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}t`}
      aria-describedby={`${id}d`}
      onCancel={(e) => {
        e.preventDefault() // Escape: let React state close it
        onCancel()
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-panel p-0 text-ink shadow-pop"
    >
      <div className="foil-edge rounded-2xl p-5 sm:p-6">
        <h2 id={`${id}t`} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        <div id={`${id}d`} className="mt-2 text-ink-soft">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* autoFocus on the safe choice: Enter shouldn't delete or leave by accident. */}
          <Button variant="outline" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'dangerSolid' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
