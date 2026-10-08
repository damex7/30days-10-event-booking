import { between, check, collect, email, integer, maxLength, ngPhone, notBefore, oneOf, pickBetween, required } from '../form/validators.js'
import { blankAttendee, computeTotals, normaliseCode, quantitiesOf } from './booking.js'
import { lagosDateKey } from './dates.js'
import { normalisePhone } from './phone.js'
import { choicesOf, hasOptions, isEmptyAnswer, pruneAnswers, visibleQuestions } from './questions.js'

/*
  Validation rules for bookings, as pure functions of the values.
  The SAME functions run in the browser (through useForm, for instant
  feedback) and in db.js before a booking is saved (the "server" check),
  so there's exactly one definition of a valid booking.

  The booking form's values:
  {
    buyer: { name, email, phone },
    firstIsBuyer: true,        // "Guest 1 is me": guest 1 copies the buyer's details
    attendees: [{ id, ticketId, name, email, phone, answers: { q_size: 'o_m' } }],
    answers: { q_side: 'o_bride' },          // once-per-booking questions
    promoCode: 'LAUGH20',                    // what's typed in the box
    promo: null | { status: 'applied', code, kind, value, label }
               | { status: 'invalid', code, message },
  }
  There's no separate "quantities" value: 3 guests on Regular IS 3 Regular
  tickets, so the two can't disagree.
*/

/** Fresh values for an event. With only one ticket type on sale, start with one ticket chosen. */
export function blankBookingValues(event) {
  const open = event.tickets.filter((t) => t.onSale)
  return {
    buyer: { name: '', email: '', phone: '' },
    firstIsBuyer: true,
    attendees: open.length === 1 ? [blankAttendee(open[0].id)] : [],
    answers: {},
    promoCode: '',
    promo: null,
  }
}

/** The guests as they'll be saved: guest 1 takes the buyer's details when "this is me" is ticked. */
export function effectiveAttendees(values) {
  return values.attendees.map((a, i) =>
    i === 0 && values.firstIsBuyer ? { ...a, name: values.buyer.name, email: values.buyer.email, phone: values.buyer.phone } : a,
  )
}

/** The promo definition to price with, if one is applied and still matches the box. */
export function appliedPromo(values) {
  const p = values.promo
  return p?.status === 'applied' && p.code === normaliseCode(values.promoCode) ? p : null
}

/** Totals for the current values. */
export const totalsFor = (event, values) => computeTotals(event, quantitiesOf(values.attendees), appliedPromo(values))

/* ---------- Contact details ---------- */

/**
 * A person's contact details at `base` ("buyer", "attendees.1", "").
 * Buyers give name, email AND phone. Other guests give a name and at least
 * one way to reach them: plenty of aunties are on WhatsApp but don't use
 * email, and making them invent an address helps nobody. That's a
 * cross-field rule: the error sits on email, and clears as soon as either
 * field is filled.
 */
export function contactErrors(person = {}, base, { needBoth = false, who = 'your' } = {}) {
  const errors = {}
  const p = base ? `${base}.` : ''
  const yours = who === 'your'
  collect(
    errors,
    `${p}name`,
    check(
      person.name,
      required(yours ? 'Enter your full name.' : 'Enter this guest’s name, as it should appear on their ticket.'),
      maxLength(80, 'Keep the name under 80 characters.'),
    ),
  )
  const noEmail = !String(person.email ?? '').trim()
  const noPhone = !String(person.phone ?? '').trim()
  if (needBoth) {
    collect(errors, `${p}email`, check(person.email, required('Enter your email address. Your tickets are sent there.'), email()))
    collect(errors, `${p}phone`, check(person.phone, required('Enter your phone number, in case the organiser needs to reach you.'), ngPhone()))
  } else {
    collect(
      errors,
      `${p}email`,
      noEmail && noPhone
        ? yours
          ? 'Enter an email address or a phone number, so we can reach you.'
          : 'Enter an email address or a phone number for this guest.'
        : check(person.email, email()),
    )
    collect(errors, `${p}phone`, check(person.phone, ngPhone()))
  }
  return errors
}

/* ---------- Custom questions ---------- */

const REQUIRED_MESSAGE = {
  short: 'Enter an answer.',
  long: 'Enter an answer.',
  number: 'Enter a number.',
  date: 'Enter a date.',
  single: 'Choose an answer.',
  yesno: 'Choose Yes or No.',
  multi: 'Tick at least one.',
}

function rangeMessage(min, max) {
  if (min != null && max != null) return `Enter a number from ${min} to ${max}.`
  if (min != null) return `Enter ${min} or more.`
  return `Enter ${max} or less.`
}

/** The problem with one answer, or undefined. Only called for VISIBLE questions. */
export function questionError(q, value, today = lagosDateKey()) {
  if (isEmptyAnswer(value)) return q.required ? REQUIRED_MESSAGE[q.type] : undefined
  const ids = choicesOf(q).map((o) => o.id)
  switch (q.type) {
    case 'short':
      return check(value, maxLength(200, 'Keep this under 200 characters.'))
    case 'long':
      return check(value, maxLength(1000, 'Keep this under 1,000 characters.'))
    case 'number':
      return check(value, integer('Enter a whole number, like 2.'), (q.min != null || q.max != null) && between(q.min, q.max, rangeMessage(q.min, q.max)))
    case 'date':
      return check(
        value,
        (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? undefined : 'Enter a real date.'),
        q.notInPast && notBefore(today, 'Choose today or a later date.'),
      )
    case 'single':
    case 'yesno':
      return check(value, oneOf(ids, 'Choose one of the options.'))
    case 'multi':
      if (!Array.isArray(value) || value.some((v) => !ids.includes(v))) return 'Choose from the options shown.'
      return check(value, pickBetween(q.min, q.max, { tooFew: `Choose at least ${q.min}.`, tooMany: `Choose up to ${q.max}.` }))
    default:
      return undefined
  }
}

/* ---------- The whole booking ---------- */

/**
 * Every problem with a booking, as { path: message }.
 * `event` must carry availability (withAvailability), so ticket limits use
 * the latest spots left. Hidden questions are never validated: we only
 * look at the questions visible for these answers.
 */
export function validateBooking(values, event, { today = lagosDateKey() } = {}) {
  const errors = {}
  const attendees = values.attendees ?? []
  const qty = quantitiesOf(attendees)

  // Tickets: at least one, within what's left, within the per-person max.
  if (attendees.length === 0) errors.tickets = 'Choose at least one ticket.'
  else if (attendees.length > event.maxPerBooking)
    errors.tickets = `You can book up to ${event.maxPerBooking} tickets at a time. Remove ${attendees.length - event.maxPerBooking}.`
  for (const t of event.tickets) {
    const n = qty[t.id] ?? 0
    if (n === 0) continue
    if (!t.onSale)
      errors.tickets ??= `${t.name} ${t.status === 'soldout' ? 'has just sold out' : 'is no longer on sale'}. Remove ${n === 1 ? 'it' : 'them'} to continue.`
    else if (n > t.remaining)
      errors.tickets ??= `Only ${t.remaining} ${t.name} ${t.remaining === 1 ? 'ticket is' : 'tickets are'} left. Choose ${t.remaining} or fewer.`
  }
  for (const ticketId of Object.keys(qty)) {
    if (!event.tickets.some((t) => t.id === ticketId)) errors.tickets ??= 'One of your tickets is no longer offered. Remove it to continue.'
  }

  Object.assign(errors, contactErrors(values.buyer, 'buyer', { needBoth: true }))

  attendees.forEach((a, i) => {
    if (!(i === 0 && values.firstIsBuyer)) Object.assign(errors, contactErrors(a, `attendees.${i}`, { who: 'guest' }))
    for (const q of visibleQuestions(event.questions, { bookingAnswers: values.answers, guestAnswers: a.answers, scope: 'guest' })) {
      collect(errors, `attendees.${i}.answers.${q.id}`, questionError(q, a.answers?.[q.id], today))
    }
  })

  for (const q of visibleQuestions(event.questions, { bookingAnswers: values.answers, scope: 'booking' })) {
    collect(errors, `answers.${q.id}`, questionError(q, values.answers?.[q.id], today))
  }

  // Promo: optional, but a typed code must have been checked and accepted.
  const typed = normaliseCode(values.promoCode)
  if (typed) {
    if (values.promo?.status === 'invalid' && values.promo.code === typed) errors.promoCode = values.promo.message
    else if (!appliedPromo(values)) errors.promoCode = 'Press Apply to check this code, or clear the box.'
    else if (totalsFor(event, values).subtotalKobo === 0) errors.promoCode = 'Your tickets are free, so there’s nothing to discount. Clear the box to continue.'
  }
  return errors
}

/* ---------- Building the saved booking ---------- */

const tidy = (s) => String(s ?? '').trim()

/**
 * Turn checked form values into the booking record db.js saves.
 * Answers to hidden questions are dropped here, contact details are
 * trimmed, and phone numbers are stored in one format (+234…).
 */
export function bookingFromValues(values, event, promo) {
  const attendees = effectiveAttendees(values).map((a) => ({
    id: a.id,
    ticketId: a.ticketId,
    name: tidy(a.name),
    email: tidy(a.email).toLowerCase(),
    phone: normalisePhone(a.phone) ?? '',
    answers: a.answers ?? {},
  }))
  const pruned = pruneAnswers(event.questions, { answers: values.answers ?? {}, attendees })
  const trimAnswer = (v) => (typeof v === 'string' ? v.trim() : v)
  const totals = computeTotals(event, quantitiesOf(attendees), promo)
  return {
    buyer: { name: tidy(values.buyer.name), email: tidy(values.buyer.email).toLowerCase(), phone: normalisePhone(values.buyer.phone) ?? '' },
    items: totals.items.map(({ ticketId, name, unitKobo, quantity }) => ({ ticketId, name, unitKobo, quantity })),
    attendees: pruned.attendees.map((a) => ({ ...a, answers: Object.fromEntries(Object.entries(a.answers).map(([k, v]) => [k, trimAnswer(v)])) })),
    answers: Object.fromEntries(Object.entries(pruned.answers).map(([k, v]) => [k, trimAnswer(v)])),
    promo: promo && totals.discountKobo > 0 ? { code: promo.code, discountKobo: totals.discountKobo } : null,
    subtotalKobo: totals.subtotalKobo,
    discountKobo: totals.discountKobo,
    totalKobo: totals.totalKobo,
  }
}

/* ---------- Drafts ---------- */

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Keep only answers to questions that still exist, with values of the right shape. */
function cleanDraftAnswers(raw, questions) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const q of questions) {
    const v = raw[q.id]
    if (v == null) continue
    if (q.type === 'multi') {
      if (Array.isArray(v)) out[q.id] = v.filter((id) => q.options.some((o) => o.id === id))
    } else if (hasOptions(q) || q.type === 'yesno') {
      if (choicesOf(q).some((o) => o.id === v)) out[q.id] = v
    } else if (typeof v === 'string') out[q.id] = v.slice(0, 1000)
  }
  return out
}

/**
 * A saved draft, checked against the event AS IT IS NOW. Between saving
 * and coming back, the organiser may have removed a question or an
 * option, and tickets may have sold. So: answers to removed questions are
 * dropped, and guests beyond what's still available are trimmed (from the
 * end). The promo must be applied again (it's re-checked anyway).
 * Returns { values, trimmed } or null if there's nothing usable.
 */
export function cleanBookingDraft(raw, event) {
  if (!raw || typeof raw !== 'object' || !raw.buyer) return null
  const counts = {}
  let trimmed = false
  const attendees = []
  for (const a of Array.isArray(raw.attendees) ? raw.attendees : []) {
    const ticket = event.tickets.find((t) => t.id === a?.ticketId)
    const n = counts[a?.ticketId] ?? 0
    if (!ticket || n >= ticket.remaining || !ticket.onSale || attendees.length >= event.maxPerBooking || typeof a.id !== 'string') {
      trimmed = true
      continue
    }
    counts[a.ticketId] = n + 1
    attendees.push({
      id: a.id.slice(0, 40),
      ticketId: a.ticketId,
      name: str(a.name, 80),
      email: str(a.email, 120),
      phone: str(a.phone, 20),
      answers: cleanDraftAnswers(a.answers, event.questions),
    })
  }
  return {
    trimmed,
    values: {
      buyer: { name: str(raw.buyer.name, 80), email: str(raw.buyer.email, 120), phone: str(raw.buyer.phone, 20) },
      firstIsBuyer: raw.firstIsBuyer !== false,
      attendees,
      answers: cleanDraftAnswers(raw.answers, event.questions),
      promoCode: str(raw.promoCode, 20),
      promo: null,
    },
  }
}
