import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DetailsStep, WhenWhereStep } from '../components/organise/BasicSteps.jsx'
import { BookingPreview } from '../components/organise/BookingPreview.jsx'
import { QuestionsStep } from '../components/organise/QuestionsStep.jsx'
import { TicketsStep } from '../components/organise/TicketsStep.jsx'
import { Button, buttonClass } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { ErrorState, LoadingNote, Skeleton } from '../components/ui/States.jsx'
import { STORAGE_PREFIX } from '../config.js'
import { ErrorSummary } from '../form/ErrorSummary.jsx'
import { loadDraft, useDraft } from '../form/useDraft.js'
import { useForm } from '../form/useForm.js'
import { useLeaveGuard } from '../form/useLeaveGuard.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { cx } from '../lib/cx.js'
import { formatDateTime, isoToLagosInput } from '../lib/dates.js'
import { createEvent, getEventForOrganiser, updateEvent } from '../lib/db.js'
import { blankEventValues, cleanEditorDraft, EDITOR_STEPS, eventToForm, firstInvalidStep, stepOfPath, validateEventStep } from '../lib/eventRules.js'
import NotFound from './NotFound.jsx'

/** /organise/new, or /organise/:id/edit (which loads the event first). */
export default function EventEditor() {
  const { id } = useParams()
  const state = useAsync(id ? (signal) => getEventForOrganiser(id, { signal }) : null, [id])
  if (!id) return <Editor key="new" event={null} />
  if (state.status === 'error') {
    if (state.error?.code === 'NOT_FOUND') return <NotFound title="We couldn’t find that event" />
    return <ErrorState error={state.error} onRetry={state.retry} title="We couldn’t load this event" />
  }
  if (!state.data) {
    return (
      <div className="space-y-4">
        <LoadingNote>Loading the event…</LoadingNote>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  return <Editor key={id} event={state.data} />
}

/*
  The multi-step editor. One useForm holds every step's values; what
  changes from step to step is the validate function: only the current
  step's rules apply when you press Next, so you're never told about a
  field you haven't reached. Save runs every step's rules; if an earlier
  step has a problem, it takes you there and shows it.

  The step is in the URL (?step=3), so Back moves between steps and a
  refresh keeps your place (and the draft keeps your values).
*/
function Editor({ event }) {
  const isNew = !event
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const stepIndex = Math.min(Math.max(Number(params.get('step') ?? 1) - 1 || 0, 0), EDITOR_STEPS.length - 1)
  const step = EDITOR_STEPS[stepIndex]
  const last = stepIndex === EDITOR_STEPS.length - 1
  useDocumentTitle(isNew ? 'Create an event' : `Edit: ${event.title}`)

  const ctx = useMemo(
    () => ({
      isNew,
      originalStartsAt: event ? isoToLagosInput(event.startsAt) : undefined,
      sold: event ? Object.fromEntries(event.tickets.map((t) => [t.id, t.sold])) : {},
    }),
    [event, isNew],
  )

  const draftKey = `${STORAGE_PREFIX}:draft:event:${event?.id ?? 'new'}`
  const [draft, setDraft] = useState(() => loadDraft(draftKey, cleanEditorDraft))
  const [furthest, setFurthest] = useState(isNew && !draft ? 0 : EDITOR_STEPS.length - 1)
  const intent = useRef('next') // which button sent the form: 'next' or 'save'
  const [revealOnArrival, setRevealOnArrival] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const headingRef = useRef(null)

  const goTo = useCallback(
    (index) => {
      setFurthest((f) => Math.max(f, index))
      setParams((p) => {
        const next = new URLSearchParams(p)
        next.set('step', String(index + 1))
        return next
      })
    },
    [setParams],
  )

  const validate = useCallback((values) => validateEventStep(step.id, values, ctx), [step.id, ctx])

  const form = useForm({
    initialValues: draft?.data ?? (event ? eventToForm(event) : blankEventValues()),
    validate,
    onSubmit: async (values) => {
      if (intent.current === 'next' && !last) {
        goTo(stepIndex + 1)
        return
      }
      // Saving: every step must pass, not just this one.
      const bad = firstInvalidStep(values, ctx)
      if (bad) {
        goTo(EDITOR_STEPS.findIndex((s) => s.id === bad))
        setRevealOnArrival((n) => n + 1)
        return
      }
      try {
        const saved = isNew ? await createEvent(values) : await updateEvent(event.id, values)
        drafts.clear()
        guard.release()
        navigate(`/organise/${saved.id}`, { state: { saved: saved.title } })
      } catch (error) {
        // The "server" found something (e.g. tickets booked meanwhile): go to that step to show it.
        const path = error.details && Object.keys(error.details)[0]
        if (path) goTo(EDITOR_STEPS.findIndex((s) => s.id === stepOfPath(path)))
        throw error
      }
    },
  })

  // Arriving at a step because Save found a problem there: show its errors and focus the first.
  useEffect(() => {
    if (revealOnArrival) {
      intent.current = 'next'
      form.handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealOnArrival])

  // A new step: start at its heading (keyboard and screen-reader users hear where they are).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [stepIndex])

  const drafts = useDraft(draftKey, form.values, { enabled: form.isDirty })
  const guard = useLeaveGuard(form.isDirty || draft != null, {
    title: isNew ? 'Leave without publishing?' : 'Leave without saving?',
    message: 'Your changes are kept on this device as a draft, so you can come back to them. Guests won’t see them until you save.',
    stayLabel: 'Keep editing',
    leaveLabel: 'Leave for now',
  })

  function discardDraft() {
    drafts.discard()
    setDraft(null)
    form.reset(event ? eventToForm(event) : blankEventValues())
  }

  const stepView = {
    details: <DetailsStep form={form} />,
    when: <WhenWhereStep form={form} />,
    tickets: <TicketsStep form={form} sold={ctx.sold} announce={setAnnouncement} />,
    questions: <QuestionsStep form={form} announce={setAnnouncement} />,
  }[step.id]

  return (
    <div>
      <Link to={isNew ? '/organise' : `/organise/${event.id}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-gele-ink">
        <Icon name="back" className="size-4" />
        {isNew ? 'Your events' : 'Back to the dashboard'}
      </Link>
      <h1 className="mt-1 font-display text-4xl font-semibold">{isNew ? 'Create an event' : `Edit ${event.title}`}</h1>

      {/* The steps. Reached steps are buttons; the current one is marked with aria-current. */}
      <nav aria-label="Steps" className="mt-5 -mx-4 overflow-x-auto px-4">
        <ol className="flex min-w-max gap-2">
          {EDITOR_STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                disabled={i > furthest}
                aria-current={i === stepIndex ? 'step' : undefined}
                className={cx(
                  'flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  i === stepIndex ? 'border-gele bg-gele text-on-gele' : 'border-line-strong bg-panel text-ink-soft hover:bg-panel-2',
                )}
              >
                <span className={cx('grid size-6 place-items-center rounded-full text-xs', i === stepIndex ? 'bg-on-gele text-gele' : 'bg-panel-2')}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {draft && (
        <div role="status" className="mt-5 flex flex-col gap-3 rounded-2xl bg-gold-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-bold text-gold-ink">Restored your unsaved changes</span> from {formatDateTime(draft.savedAt)}.
          </p>
          <button type="button" onClick={discardDraft} className={buttonClass('outline', 'sm', 'shrink-0')}>
            Discard them
          </button>
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
        <form
          {...form.formProps}
          // Which button sent the form? Pressing Enter in a field uses the FIRST submit button in the
          // DOM, so the main button (Next / Publish) comes first in the markup.
          onSubmit={(e) => {
            intent.current = e.nativeEvent.submitter?.dataset.intent ?? 'next'
            form.handleSubmit(e)
          }}
          className="min-w-0"
        >
          <p className="text-sm font-bold tracking-wide text-gele-ink uppercase">
            Step {stepIndex + 1} of {EDITOR_STEPS.length}
          </p>
          <h2 ref={headingRef} tabIndex={-1} className="mb-5 font-display text-3xl font-semibold">
            {step.title}
          </h2>
          <ErrorSummary form={form} />
          {stepView}

          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            {stepIndex > 0 && (
              <Button variant="outline" onClick={() => goTo(stepIndex - 1)}>
                <Icon name="back" className="size-4" />
                Back
              </Button>
            )}
            <div className="ml-auto flex flex-row-reverse flex-wrap gap-2">
              <Button type="submit" data-intent={last ? 'save' : 'next'} disabled={form.isSubmitting}>
                {form.isSubmitting ? 'Saving…' : last ? (isNew ? 'Publish event' : 'Save changes') : 'Next'}
                {!last && <Icon name="arrow" className="size-4" />}
              </Button>
              {!last && !isNew && (
                <Button type="submit" variant="outline" data-intent="save" disabled={form.isSubmitting}>
                  Save changes
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Below xl the preview is opened with a button, under the form. */}
        <div className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
          <Button
            variant="secondary"
            className="mb-3 w-full xl:hidden"
            aria-expanded={showPreview}
            aria-controls="booking-preview"
            onClick={() => setShowPreview((s) => !s)}
          >
            <Icon name="eye" className="size-4" />
            {showPreview ? 'Hide the guest’s view' : 'Show the guest’s view'}
          </Button>
          <div id="booking-preview" className={showPreview ? 'block' : 'hidden xl:block'}>
            <BookingPreview values={form.values} />
          </div>
        </div>
      </div>
      {guard.dialog}
    </div>
  )
}
