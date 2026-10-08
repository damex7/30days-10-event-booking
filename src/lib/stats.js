import { formatDateTime } from './dates.js'
import { formatPhoneLocal } from './phone.js'
import { choicesOf, formatAnswer, hasOptions, isEmptyAnswer } from './questions.js'

/*
  The organiser's numbers, as pure functions of (event, bookings).
  Only CONFIRMED bookings count towards sales, revenue and answers;
  cancelled ones are listed (so you can see what happened) but don't count.
*/
const confirmed = (bookings) => bookings.filter((b) => b.status === 'confirmed')

export function salesSummary(event, bookings) {
  const live = confirmed(bookings)
  const tickets = event.tickets.map((t) => {
    let sold = 0
    let revenueKobo = 0
    for (const b of live)
      for (const i of b.items)
        if (i.ticketId === t.id) {
          sold += i.quantity
          revenueKobo += i.unitKobo * i.quantity
        }
    return { id: t.id, name: t.name, quantity: t.quantity, priceKobo: t.priceKobo, sold, revenueKobo }
  })
  return {
    tickets,
    sold: tickets.reduce((n, t) => n + t.sold, 0),
    capacity: tickets.reduce((n, t) => n + t.quantity, 0),
    // What guests actually pay: after promo discounts.
    revenueKobo: live.reduce((n, b) => n + b.totalKobo, 0),
    discountKobo: live.reduce((n, b) => n + b.discountKobo, 0),
    bookings: live.length,
    cancelled: bookings.length - live.length,
  }
}

/** Each guest with their booking, so per-guest and per-booking answers can be read side by side. */
function guestsOf(bookings) {
  return confirmed(bookings).flatMap((b) => b.attendees.map((a) => ({ booking: b, guest: a })))
}

const answerOf = (q, booking, guest) => (q.perAttendee ? guest?.answers[q.id] : booking.answers[q.id])

/**
 * A summary per question:
 *   choice / yes-no: counts per option (multi: a guest can tick several)
 *   number:          answered count, total and average ("How many children?" → total children)
 *   text / date:     the answers themselves, with who gave them
 * Per-guest questions are counted per guest; booking questions per booking.
 */
export function answerSummary(event, bookings) {
  const live = confirmed(bookings)
  const guests = guestsOf(bookings)
  return event.questions.map((q) => {
    const sources = q.perAttendee ? guests.map((g) => ({ ...g, value: answerOf(q, g.booking, g.guest) })) : live.map((b) => ({ booking: b, guest: null, value: answerOf(q, b) }))
    const answered = sources.filter((s) => !isEmptyAnswer(s.value))
    const base = { question: q, asked: q.perAttendee ? 'guests' : 'bookings', answered: answered.length }
    const choices = choicesOf(q)
    if (choices.length) {
      const counts = Object.fromEntries(choices.map((o) => [o.id, 0]))
      for (const s of answered) for (const id of [].concat(s.value)) if (id in counts) counts[id] += 1
      return { ...base, kind: 'choice', options: choices.map((o) => ({ id: o.id, label: o.label, count: counts[o.id] })) }
    }
    if (q.type === 'number') {
      const total = answered.reduce((n, s) => n + (Number(s.value) || 0), 0)
      return { ...base, kind: 'number', total, average: answered.length ? total / answered.length : 0 }
    }
    return {
      ...base,
      kind: 'text',
      answers: answered.map((s) => ({ who: s.guest?.name ?? s.booking.buyer.name, reference: s.booking.reference, text: formatAnswer(q, s.value) })),
    }
  })
}

/**
 * Two choice questions against each other, e.g. aso-ebi colour × size:
 * the tailor's order sheet. Counted per guest when either question is
 * per guest (a booking answer applies to every guest in that booking),
 * otherwise per booking. Only rows where both are answered are counted.
 */
export function crossTab(event, bookings, rowId, colId) {
  const rowQ = event.questions.find((q) => q.id === rowId)
  const colQ = event.questions.find((q) => q.id === colId)
  if (!rowQ || !colQ) return null
  const perGuest = rowQ.perAttendee || colQ.perAttendee
  const units = perGuest ? guestsOf(bookings) : confirmed(bookings).map((b) => ({ booking: b, guest: null }))
  const rows = choicesOf(rowQ)
  const cols = choicesOf(colQ)
  const counts = rows.map(() => cols.map(() => 0))
  for (const { booking, guest } of units) {
    const r = answerOf(rowQ, booking, guest)
    const c = answerOf(colQ, booking, guest)
    if (isEmptyAnswer(r) || isEmptyAnswer(c)) continue
    for (const rv of [].concat(r))
      for (const cv of [].concat(c)) {
        const ri = rows.findIndex((o) => o.id === rv)
        const ci = cols.findIndex((o) => o.id === cv)
        if (ri >= 0 && ci >= 0) counts[ri][ci] += 1
      }
  }
  return {
    rowQ,
    colQ,
    perGuest,
    rows,
    cols,
    counts,
    rowTotals: counts.map((r) => r.reduce((a, b) => a + b, 0)),
    colTotals: cols.map((_, ci) => counts.reduce((a, r) => a + r[ci], 0)),
    total: counts.flat().reduce((a, b) => a + b, 0),
  }
}

/** A sensible starting cross-tab: something × "Size" if there's a size question (colour × size), else the first two. */
export function defaultCrossTab(event) {
  const choice = event.questions.filter(hasOptions)
  if (choice.length < 2) return null
  const size = choice.find((q) => /size/i.test(q.label))
  const other = size && (choice.find((q) => q !== size && q.perAttendee === size.perAttendee) ?? choice.find((q) => q !== size))
  return size && other ? [other.id, size.id] : [choice[0].id, choice[1].id]
}

/* ---------- CSV ---------- */

/**
 * One row per guest (what a caterer, tailor or gate list needs), confirmed
 * bookings only, with a column per question. Money in naira, dates in Lagos time.
 */
export function guestRows(event, bookings) {
  const header = ['Booking reference', 'Booked at (Lagos)', 'Booked by', 'Buyer email', 'Buyer phone', 'Guest', 'Guest name', 'Guest email', 'Guest phone', 'Ticket', 'Ticket price (₦)', 'Booking total (₦)', 'Promo code', ...event.questions.map((q) => q.label)]
  const rows = []
  for (const b of confirmed(bookings)) {
    b.attendees.forEach((a, i) => {
      const item = b.items.find((x) => x.ticketId === a.ticketId)
      rows.push([
        b.reference,
        formatDateTime(b.createdAt),
        b.buyer.name,
        b.buyer.email,
        formatPhoneLocal(b.buyer.phone),
        `${i + 1} of ${b.attendees.length}`,
        a.name,
        a.email,
        formatPhoneLocal(a.phone),
        item?.name ?? '',
        item ? item.unitKobo / 100 : '',
        b.totalKobo / 100,
        b.promo?.code ?? '',
        ...event.questions.map((q) => formatAnswer(q, answerOf(q, b, a))),
      ])
    })
  }
  return [header, ...rows]
}
