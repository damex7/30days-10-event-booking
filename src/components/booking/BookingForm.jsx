import { useCallback, useId, useRef, useState } from 'react'
import { ErrorSummary } from '../../form/ErrorSummary.jsx'
import { TextField } from '../../form/controls.jsx'
import { useForm } from '../../form/useForm.js'
import { blankBookingValues, totalsFor, validateBooking } from '../../lib/bookingRules.js'
import { formatEventWhen } from '../../lib/dates.js'
import { formatNaira } from '../../lib/money.js'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'
import { AttendeeCard } from './AttendeeCard.jsx'
import { OrderSummary } from './OrderSummary.jsx'
import { PromoField } from './PromoField.jsx'
import { QuestionList } from './Questions.jsx'
import { TicketPicker } from './TicketPicker.jsx'

/**
 * The booking form's state: useForm with the booking rules for THIS event.
 * Used by the real booking page and by the organiser's live preview.
 */
export function useBookingForm(event, { initialValues, onSubmit }) {
  const validate = useCallback((values) => validateBooking(values, event), [event])
  return useForm({ initialValues: initialValues ?? blankBookingValues(event), validate, onSubmit })
}

function Section({ number, title, intro, headingRef, children }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex items-baseline gap-3">
        {number != null && (
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-gele text-sm font-bold text-on-gele">
            {number}
          </span>
        )}
        <div>
          <h2 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="font-display text-2xl font-semibold">
            {title}
          </h2>
          {intro && <p className="text-ink-soft">{intro}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/*
  The booking form, generated from the event's config:
    1. Tickets         one stepper per ticket type
    2. Your details    the buyer: name, email, phone
    3. Questions       the organiser's once-per-booking questions (if any)
    4. Guests          one card per ticket, with the per-guest questions
    5. Promo code      only if the event has codes
    6. Check & confirm the order summary and the button
  Sections that have nothing to ask aren't shown, and the numbers follow.

  `preview` is the organiser's live preview: the same form, given an
  onSubmit (in useBookingForm) that saves nothing.
*/
export function BookingForm({ form, event, preview = false, banner }) {
  const [announcement, setAnnouncement] = useState('')
  const announce = useCallback((text) => setAnnouncement(text), [])
  const guestsHeading = useRef(null)
  const values = form.values
  const totals = totalsFor(event, values)
  const count = values.attendees.length
  const hasBookingQuestions = event.questions.some((q) => !q.perAttendee)
  const hasPromo = event.hasPromoCodes ?? event.promoCodes?.length > 0
  const showPromo = hasPromo && (totals.subtotalKobo > 0 || values.promoCode)

  const removeGuest = (index) => {
    form.setValues((v) => ({
      ...v,
      attendees: v.attendees.filter((_, i) => i !== index),
      firstIsBuyer: index === 0 ? false : v.firstIsBuyer,
    }))
    form.forget((path) => path.startsWith('attendees.'))
    announce(`Guest ${index + 1} removed. ${count - 1 === 1 ? '1 ticket' : `${count - 1} tickets`} in your booking.`)
    // The card (and its Remove button) is gone, so put focus somewhere sensible.
    requestAnimationFrame(() => guestsHeading.current?.focus())
  }

  let n = 0
  const next = () => ++n
  const submitText = preview ? 'Check the form' : totals.totalKobo > 0 ? `Confirm booking · ${formatNaira(totals.totalKobo)}` : 'Confirm booking'

  return (
    <form {...form.formProps} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-10">
        {banner}
        <ErrorSummary form={form} />
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        <Section number={next()} title="Tickets">
          <TicketPicker form={form} event={event} onGuestsChanged={() => form.forget((p) => p.startsWith('attendees.'))} />
        </Section>

        <Section number={next()} title="Your details" intro="The person booking. We’ll send the tickets here.">
          <div className="space-y-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
            <TextField form={form} name="buyer.name" label="Full name" autoComplete="name" />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField form={form} name="buyer.email" label="Email" type="email" inputMode="email" autoComplete="email" spellCheck={false} />
              <TextField form={form} name="buyer.phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" hint="Like 0803 123 4567 or +234 803 123 4567." />
            </div>
          </div>
        </Section>

        {hasBookingQuestions && (
          <Section number={next()} title="A few questions" intro={`From ${event.organiser.name || 'the organiser'}.`}>
            <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
              <QuestionList form={form} questions={event.questions} scope="booking" bookingAnswers={values.answers} basePath="answers" announce={announce} preview={preview} />
            </div>
          </Section>
        )}

        <Section number={next()} title="Guests" intro="One set of details for each ticket, so every guest gets their own." headingRef={guestsHeading}>
          {count === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-ink-faint">Choose your tickets above, and a card for each guest appears here.</p>
          ) : (
            <div className="space-y-4">
              {values.attendees.map((a, i) => (
                <AttendeeCard key={a.id} form={form} event={event} index={i} onRemove={removeGuest} announce={announce} preview={preview} />
              ))}
            </div>
          )}
        </Section>

        {showPromo && (
          <Section number={next()} title="Promo code">
            <PromoField form={form} event={event} preview={preview} />
          </Section>
        )}

        <Section number={next()} title="Check and confirm">
          <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
            <OrderSummary totals={totals} />
            {count > 0 && (
              <p className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
                <span className="font-bold text-ink">Guests: </span>
                {values.attendees.map((a, i) => (i === 0 && values.firstIsBuyer ? values.buyer.name || 'You' : a.name || `Guest ${i + 1}`)).join(', ')}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.isSubmitting}>
            <Icon name="check" className="size-5" />
            {form.isSubmitting ? 'Booking…' : submitText}
          </Button>
          {!preview && <p className="text-sm text-ink-faint">This is a demo: no payment is taken and no email is sent.</p>}
        </Section>
      </div>

      {/* Desktop: the summary follows you down the page. */}
      <aside className="hidden lg:block" aria-label="Your order">
        <div className="foil-edge sticky top-24 rounded-2xl bg-panel p-5 shadow-card">
          <p className="text-sm font-bold tracking-wide text-gele-ink uppercase">Your order</p>
          <p className="mt-1 font-display text-xl leading-snug font-semibold">{event.title}</p>
          <p className="mb-4 text-sm text-ink-soft">{formatEventWhen(event.startsAt, event.endsAt)}</p>
          <OrderSummary totals={totals} />
          <Button type="submit" className="mt-5 w-full" disabled={form.isSubmitting}>
            {form.isSubmitting ? 'Booking…' : submitText}
          </Button>
        </div>
      </aside>

      {/* Phones: the total and the button stay in reach at the bottom. */}
      <div
        data-sticky-bar
        className={`${preview ? 'hidden' : ''} fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-faint">{count === 1 ? '1 ticket' : `${count} tickets`}</p>
            <p className="font-display text-lg font-bold">{totals.totalKobo === 0 ? 'Free' : formatNaira(totals.totalKobo)}</p>
          </div>
          <Button type="submit" disabled={form.isSubmitting}>
            {form.isSubmitting ? 'Booking…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </form>
  )
}
