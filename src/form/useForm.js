import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fieldId, getPath, setPath } from './paths.js'

/*
  useForm: a small form hook. Values in one object, a pure validate()
  function, and a few rules about WHEN to show errors.

    const form = useForm({ initialValues, validate, onSubmit })
    <form {...form.formProps}>
      <TextField form={form} name="buyer.email" label="Email" />
    </form>

  ── KNOWING vs SHOWING ──────────────────────────────────────────────────
  validate(values) runs on every render: it's a pure function of the
  values, so we always KNOW every problem (allErrors). Deciding which
  problems to SHOW is separate, and follows "reward early, punish late":

    1. While you type in a field that has no error showing, nothing new
       appears. We don't shout "invalid email" at "ada@".
    2. When you leave a field (blur) and it has a problem, that problem
       is revealed.
    3. Once a field's error is showing, it updates LIVE on every keystroke,
       and disappears the moment the value becomes valid (the reward).
       After that, the field goes back to rule 1.
    4. Submitting reveals every problem at once, shows the summary, and
       moves focus to the first one.

  The "revealed" set holds the paths whose errors may be shown.
  errors (what the UI shows) = allErrors, limited to revealed paths.

  ── ORDER ───────────────────────────────────────────────────────────────
  Error order must match the page, not object key order: the summary and
  "focus the first error" should start at the top. Each field's wrapper
  has data-field="path", so after every render we read the fields from
  the <form> in DOM order. That stays right in a form that's generated
  from config and whose fields come and go.

  ── SERVER ERRORS ───────────────────────────────────────────────────────
  onSubmit may throw an error with `details` ({ path: message }), e.g.
  "Only 2 VIP tickets are left". Those show like any other error until
  the field is changed.
*/
export function useForm({ initialValues, validate, onSubmit }) {
  const prefix = 'f' + useId().replace(/[^\w]/g, '')
  const formRef = useRef(null)

  const [values, setValuesState] = useState(initialValues)
  const initialRef = useRef(JSON.stringify(initialValues))
  const [revealed, setRevealed] = useState(() => new Set())
  const [serverErrors, setServerErrors] = useState({})
  const [submitCount, setSubmitCount] = useState(0)
  const [isSubmitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null) // a failure that isn't about one field
  const [announcement, setAnnouncement] = useState('')
  const [focusRequest, setFocusRequest] = useState(0)
  const [fields, setFields] = useState([]) // [{ path, label }] in DOM order

  /* Knowing: every current problem. Client rules win over stale server messages. */
  const allErrors = useMemo(() => ({ ...serverErrors, ...validate(values) }), [serverErrors, validate, values])

  /* Showing: only revealed paths. */
  const errors = useMemo(() => Object.fromEntries(Object.entries(allErrors).filter(([path]) => revealed.has(path))), [allErrors, revealed])

  /* Rule 3's ending: a revealed field that became valid goes back to "quiet until blur". */
  useEffect(() => {
    setRevealed((prev) => {
      const next = new Set([...prev].filter((path) => allErrors[path]))
      return next.size === prev.size ? prev : next
    })
  }, [allErrors])

  /* Read the fields' order (and labels, for the summary) from the DOM after each render. */
  useLayoutEffect(() => {
    const els = formRef.current?.querySelectorAll('[data-field]') ?? []
    const next = Array.from(els, (el) => ({ path: el.dataset.field, label: el.dataset.label ?? '' }))
    setFields((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  })

  const ordered = useCallback(
    (errorMap) => {
      const known = fields.filter((f) => errorMap[f.path]).map((f) => ({ ...f, message: errorMap[f.path] }))
      const extra = Object.keys(errorMap)
        .filter((p) => !fields.some((f) => f.path === p))
        .map((p) => ({ path: p, label: '', message: errorMap[p] }))
      return [...known, ...extra]
    },
    [fields],
  )

  /* ---------- Changing values ---------- */

  const setValue = useCallback((path, value) => {
    setValuesState((prev) => setPath(prev, path, value))
    setServerErrors((prev) => {
      if (!(path in prev)) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
    setSubmitError(null)
  }, [])

  /** For changes that touch several fields at once (add a guest, copy the buyer's details). */
  const setValues = useCallback((updater) => {
    setValuesState((prev) => (typeof updater === 'function' ? updater(prev) : updater))
    setSubmitError(null)
  }, [])

  /** Start again from new values (e.g. a restored draft). `asInitial` makes them the "clean" state for isDirty. */
  const reset = useCallback((next, { asInitial = true } = {}) => {
    setValuesState(next)
    if (asInitial) initialRef.current = JSON.stringify(next)
    setRevealed(new Set())
    setServerErrors({})
    setSubmitCount(0)
    setSubmitError(null)
  }, [])

  /* ---------- Revealing ---------- */

  // Kept in a ref so the blur handler always sees the latest errors without being re-created.
  const allErrorsRef = useRef(allErrors)
  allErrorsRef.current = allErrors
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed

  /** Rule 2. Also announces the new error politely, for screen-reader users who've moved on. */
  const touch = useCallback((path) => {
    const message = allErrorsRef.current[path]
    if (!message || revealedRef.current.has(path)) return
    setRevealed((prev) => new Set(prev).add(path))
    const label = fieldsRef.current.find((f) => f.path === path)?.label
    setAnnouncement(`${label ? `${label}: ` : ''}${message}`)
  }, [])

  /**
   * Blur handler for a field or a group. For a radio/checkbox group it's put on the
   * <fieldset>: moving between options inside the group isn't "leaving" it.
   */
  const blurHandler = useCallback(
    (path) => (event) => {
      if (event?.currentTarget?.contains?.(event.relatedTarget)) return
      touch(path)
    },
    [touch],
  )

  /* ---------- Focus ---------- */

  const idFor = useCallback((path) => fieldId(prefix, path), [prefix])

  /** Focus a field by path. Groups focus their checked option, or the first one. */
  const focusField = useCallback(
    (path) => {
      const el = document.getElementById(idFor(path))
      if (!el) return
      const target = el.matches('fieldset, [role="group"], [role="radiogroup"]')
        ? (el.querySelector('input:checked:not(:disabled)') ?? el.querySelector('input:not(:disabled), button:not(:disabled)'))
        : el
      target?.focus()
    },
    [idFor],
  )

  // After a failed submit, wait for the render that shows the errors, then focus the first.
  useEffect(() => {
    if (focusRequest === 0) return
    const first = ordered(allErrorsRef.current)[0]
    if (first) focusField(first.path)
    // Only when a new request is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest])

  /* ---------- Submitting ---------- */

  const valuesRef = useRef(values)
  valuesRef.current = values

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault()
      if (isSubmitting) return
      setSubmitCount((n) => n + 1)
      setSubmitError(null)
      const current = allErrorsRef.current
      const paths = Object.keys(current)
      if (paths.length > 0) {
        setRevealed(new Set(paths)) // rule 4
        setFocusRequest((n) => n + 1)
        return
      }
      setSubmitting(true)
      try {
        await onSubmit(valuesRef.current)
      } catch (error) {
        if (error?.details && Object.keys(error.details).length) {
          setServerErrors(error.details)
          setRevealed(new Set(Object.keys(error.details)))
          setFocusRequest((n) => n + 1)
        }
        setSubmitError(error)
      } finally {
        setSubmitting(false)
      }
    },
    [isSubmitting, onSubmit],
  )

  const isDirty = useMemo(() => JSON.stringify(values) !== initialRef.current, [values])

  return {
    values,
    setValue,
    setValues,
    reset,
    errors,
    allErrors,
    isValid: Object.keys(allErrors).length === 0,
    /** Visible errors in page order, with labels: what the error summary lists. */
    summary: ordered(errors),
    touch,
    blurHandler,
    focusField,
    idFor,
    get: (path) => getPath(values, path),
    isDirty,
    isSubmitting,
    submitCount,
    submitError,
    announcement,
    formProps: { ref: formRef, onSubmit: handleSubmit, noValidate: true },
    handleSubmit,
  }
}
