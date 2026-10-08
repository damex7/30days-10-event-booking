import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { ConfirmDialog } from '../components/ui/Dialog.jsx'

/*
  Warn before leaving a form with unsaved changes.
  Two different exits need two different tools:
    - links inside the app (and Back): react-router's useBlocker, which
      pauses the navigation so we can ask in our own dialog;
    - refresh, closing the tab, typing a new URL: the browser's
      beforeunload event. Browsers only show their own generic message
      there; we can ask for it but not word it.
  `when` is read from a ref at the moment of leaving, so after a
  successful submit we can switch the guard off and navigate in the same
  click, without the guard catching our own redirect.

  Returns the dialog element to render.
*/
export function useLeaveGuard(when, { title = 'Leave this page?', message, stayLabel = 'Stay', leaveLabel = 'Leave' } = {}) {
  const whenRef = useRef(when)
  whenRef.current = when

  // Only block moves to another page, not changes to ?search params on this one.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => whenRef.current && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!whenRef.current) return
      e.preventDefault()
      e.returnValue = '' // older browsers need this to show the prompt
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={title}
      confirmLabel={leaveLabel}
      cancelLabel={stayLabel}
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    >
      {message}
    </ConfirmDialog>
  )

  return {
    dialog,
    /** Turn the guard off right now (before navigating away after a submit). */
    release: () => {
      whenRef.current = false
    },
  }
}
