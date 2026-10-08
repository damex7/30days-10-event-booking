import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookingForm, useBookingForm } from '../components/booking/BookingForm.jsx'
import { buttonClass } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../components/ui/States.jsx'
import { STORAGE_PREFIX } from '../config.js'
import { loadDraft, useDraft } from '../form/useDraft.js'
import { useLeaveGuard } from '../form/useLeaveGuard.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { blankBookingValues, cleanBookingDraft } from '../lib/bookingRules.js'
import { formatDateTime, formatEventWhen } from '../lib/dates.js'
import { createBooking, getEvent } from '../lib/db.js'
import NotFound from './NotFound.jsx'

function BookSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingNote>Loading the booking form…</LoadingNote>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  )
}

/*
  The booking page: loads the event, then hands it to BookingPage, which
  adds the parts only a real booking needs: the saved draft, the "leave
  without booking?" guard, and the save itself.
*/
export default function Book() {
  const { slug } = useParams()
  const state = useAsync((signal) => getEvent(slug, { signal }), [slug])
  const event = state.data
  useDocumentTitle(event ? `Book: ${event.title}` : 'Book')

  if (state.status === 'error') {
    if (state.error?.code === 'NOT_FOUND') return <NotFound title="We couldn’t find that event" />
    return <ErrorState error={state.error} onRetry={state.retry} title="We couldn’t load the booking form" />
  }
  if (!event) return <BookSkeleton />

  if (!event.bookable) {
    return (
      <EmptyState
        icon="ticket"
        title={event.soldOut ? 'This event is sold out' : 'Booking has closed'}
        action={
          <Link to={`/events/${event.slug}`} className={buttonClass('primary')}>
            {event.soldOut ? 'Join the waitlist' : 'Back to the event'}
          </Link>
        }
      >
        <p>{event.soldOut ? 'Every place has been taken, but places do open up.' : 'Tickets for this event are no longer on sale.'}</p>
      </EmptyState>
    )
  }

  // key: a different event gets a fresh form (and its own draft).
  return <BookingPage key={event.id} event={event} refresh={state.retry} />
}

function BookingPage({ event, refresh }) {
  const navigate = useNavigate()
  const draftKey = `${STORAGE_PREFIX}:draft:booking:${event.id}`

  // Read the draft once, checked against the event as it is now.
  const [draft, setDraft] = useState(() => loadDraft(draftKey, (raw) => cleanBookingDraft(raw, event)))
  const [done, setDone] = useState(false)

  const form = useBookingForm(event, {
    initialValues: draft?.data.values,
    onSubmit: async (values) => {
      try {
        const booking = await createBooking(event.id, values)
        drafts.clear()
        guard.release()
        setDone(true)
        navigate(`/bookings/${booking.reference}`, { state: { justBooked: true } })
      } catch (error) {
        // Someone else took the last spots: reload availability so the
        // ticket steppers and the rules use the new numbers.
        if (error.code === 'SOLD_OUT') refresh()
        throw error
      }
    },
  })

  // Save while there's something new to save. A restored, untouched draft is already saved.
  const drafts = useDraft(draftKey, form.values, { enabled: form.isDirty && !done })
  const hasProgress = (form.isDirty || draft != null) && !done
  const guard = useLeaveGuard(hasProgress, {
    title: 'Leave your booking?',
    message: 'Your answers are saved on this device, so you can finish later. Your places aren’t held until you confirm.',
    stayLabel: 'Keep booking',
    leaveLabel: 'Leave for now',
  })

  function startOver() {
    drafts.discard()
    setDraft(null)
    form.reset(blankBookingValues(event))
  }

  const banner = draft && (
    <div role="status" className="flex flex-col gap-3 rounded-2xl bg-gold-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <Icon name="info" className="mt-0.5 size-5 shrink-0 text-gold-ink" />
        <div>
          <p className="font-bold text-gold-ink">Welcome back. We kept your unfinished booking.</p>
          <p className="text-sm text-ink-soft">
            Saved {formatDateTime(draft.savedAt)}.{draft.data.trimmed && ' Some tickets sold out while you were away, so we removed those guests.'}
          </p>
        </div>
      </div>
      <button type="button" onClick={startOver} className={buttonClass('outline', 'sm', 'shrink-0')}>
        Start over
      </button>
    </div>
  )

  return (
    <>
      <Link to={`/events/${event.slug}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-gele-ink">
        <Icon name="back" className="size-4" />
        {event.title}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold">Book your place</h1>
      <p className="mt-1 mb-8 text-ink-soft">
        {formatEventWhen(event.startsAt, event.endsAt)} · {event.venue.name}, {event.venue.city}
      </p>
      <BookingForm form={form} event={event} banner={banner} />
      {guard.dialog}
    </>
  )
}
