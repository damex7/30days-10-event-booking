import { useCallback, useEffect, useRef } from 'react'
import { readValidated, removeKey, writeJSON } from '../lib/storage.js'

const WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Read a saved draft once (e.g. in a useState initialiser).
 * Drafts are { version: 1, savedAt, values }. Old (> 7 days) or malformed
 * drafts are thrown away. `clean(values)` checks the values against the
 * world as it is NOW (the event may have changed since) and returns
 * whatever the caller needs, or null to discard. Returns { data, savedAt }.
 */
export function loadDraft(key, clean) {
  const { status, value } = readValidated(key, (d) => (d?.version === 1 && typeof d.savedAt === 'string' ? d : null))
  if (status !== 'ok') return null
  if (Date.now() - new Date(value.savedAt).getTime() > WEEK) {
    removeKey(key)
    return null
  }
  const cleaned = clean(value.values)
  return cleaned == null ? null : { data: cleaned, savedAt: value.savedAt }
}

/*
  useDraft: keep a copy of a form's values in localStorage, so a refresh,
  a crash or a phone killing the tab doesn't lose them.
    - Saves 400ms after the last change (debounced), not on every keystroke.
    - Only while `enabled` (e.g. not in the organiser's preview, not
      before the form has anything worth keeping).
    - clear() removes the draft (after a successful submit, or "Start over").
  localStorage rather than sessionStorage: a booking started on a phone
  should still be there after the browser was closed. Drafts expire after
  7 days. On a shared computer that's a trade-off; it's noted in the README.
*/
export function useDraft(key, values, { enabled = true } = {}) {
  const skip = useRef(false)

  useEffect(() => {
    if (!enabled || skip.current) return
    const timer = setTimeout(() => writeJSON(key, { version: 1, savedAt: new Date().toISOString(), values }), 400)
    return () => clearTimeout(timer)
  }, [key, values, enabled])

  /** Delete the draft and stop saving (the form is done). */
  const clear = useCallback(() => {
    skip.current = true
    removeKey(key)
  }, [key])

  /** Delete the draft but keep saving new changes ("Start over"). */
  const discard = useCallback(() => removeKey(key), [key])

  return { clear, discard }
}
