import { CATEGORIES, CITIES, COVER_PATTERNS, COVER_TONES, LIMITS } from '../config.js'
import { isISODate } from './dates.js'
import { BOOKING_REFERENCE } from './ids.js'
import { isKobo } from './money.js'
import { normalisePhone } from './phone.js'
import { canBeCondition, choicesOf, hasOptions, QUESTION_TYPE_IDS } from './questions.js'

/*
  "Validate saved data before trusting it."
  localStorage is just text that anyone can edit in DevTools, that an older
  version of the app may have written, or that a browser extension may have
  mangled. So everything db.js reads goes through these cleaners first:
    - an object that's unusable (no id, a date that isn't a date, a price
      that isn't whole kobo) is DROPPED, with a console warning;
    - small problems are REPAIRED (trim and cap strings, drop an unknown
      option, clear a condition that points nowhere).
  Each cleaner returns a fresh object or null. Nothing here throws.
*/

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v)
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const id = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : null)
const int = (v, min, max) => (Number.isSafeInteger(v) && v >= min && v <= max ? v : null)
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback)
const isoOrNull = (v) => (isISODate(v) ? v : null)
const list = (v) => (Array.isArray(v) ? v : [])

function warn(what, raw) {
  console.warn(`[schema] Dropped an invalid ${what} from saved data:`, raw)
  return null
}

/* ---------- Events ---------- */

function cleanTicket(raw) {
  if (!isObj(raw) || !id(raw.id) || !str(raw.name) || !isKobo(raw.priceKobo)) return null
  const quantity = int(raw.quantity, 1, LIMITS.ticketQuantity)
  if (quantity == null) return null
  return {
    id: raw.id,
    name: str(raw.name, 60),
    description: str(raw.description, 200),
    priceKobo: raw.priceKobo,
    quantity,
    salesEndAt: isoOrNull(raw.salesEndAt),
  }
}

function cleanQuestion(raw) {
  if (!isObj(raw) || !id(raw.id) || !str(raw.label) || !QUESTION_TYPE_IDS.includes(raw.type)) return null
  const q = {
    id: raw.id,
    label: str(raw.label, 120),
    hint: str(raw.hint, 200),
    type: raw.type,
    required: raw.required === true,
    perAttendee: raw.perAttendee === true,
    options: [],
    min: Number.isSafeInteger(raw.min) ? raw.min : null,
    max: Number.isSafeInteger(raw.max) ? raw.max : null,
    notInPast: raw.type === 'date' && raw.notInPast === true,
    showIf: null,
  }
  if (hasOptions(q)) {
    q.options = list(raw.options)
      .filter((o) => isObj(o) && id(o.id) && str(o.label))
      .map((o) => ({ id: o.id, label: str(o.label, 60) }))
    if (q.options.length < 2) return null // a "choice" with one option isn't a question
  }
  if (isObj(raw.showIf) && id(raw.showIf.questionId)) {
    q.showIf = { questionId: raw.showIf.questionId, anyOf: list(raw.showIf.anyOf).filter((v) => typeof v === 'string') }
  }
  return q
}

/** Clear any condition that breaks the rules in questions.js (earlier parent, right scope, real options). */
function repairConditions(questions) {
  return questions.map((q, index) => {
    if (!q.showIf) return q
    const parentIndex = questions.findIndex((p) => p.id === q.showIf.questionId)
    const parent = questions[parentIndex]
    const ok =
      parent &&
      parentIndex < index &&
      canBeCondition(parent) &&
      !(parent.perAttendee && !q.perAttendee) &&
      q.showIf.anyOf.length > 0 &&
      q.showIf.anyOf.every((v) => choicesOf(parent).some((o) => o.id === v))
    return ok ? q : { ...q, showIf: null }
  })
}

function cleanPromo(raw) {
  if (!isObj(raw)) return null
  const code = str(raw.code, 20).toUpperCase()
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return null
  if (raw.kind === 'percent' && int(raw.value, 1, 100) != null) return { code, kind: 'percent', value: raw.value }
  if (raw.kind === 'fixed' && isKobo(raw.value) && raw.value > 0) return { code, kind: 'fixed', value: raw.value }
  return null
}

export function cleanEvent(raw) {
  if (!isObj(raw) || !id(raw.id) || !/^[a-z0-9-]{1,80}$/.test(raw.slug ?? '') || !str(raw.title)) return warn('event', raw)
  if (!isISODate(raw.startsAt) || !isISODate(raw.endsAt) || new Date(raw.endsAt) <= new Date(raw.startsAt)) return warn('event (dates)', raw)
  const tickets = list(raw.tickets).map(cleanTicket).filter(Boolean)
  if (tickets.length === 0) return warn('event (no tickets)', raw)
  const venue = isObj(raw.venue) ? raw.venue : {}
  const organiser = isObj(raw.organiser) ? raw.organiser : {}
  const questions = list(raw.questions).map(cleanQuestion).filter(Boolean)
  return {
    id: raw.id,
    slug: raw.slug,
    title: str(raw.title, 100),
    category: oneOf(raw.category, CATEGORIES.map((c) => c.id), 'community'),
    summary: str(raw.summary, 160),
    description: str(raw.description, 4000),
    cover: {
      pattern: oneOf(raw.cover?.pattern, COVER_PATTERNS, 'lace'),
      tone: oneOf(raw.cover?.tone, COVER_TONES, 'magenta'),
    },
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    venue: { name: str(venue.name, 100), address: str(venue.address, 200), city: oneOf(venue.city, CITIES, CITIES[0]) },
    organiser: { name: str(organiser.name, 80), email: str(organiser.email, 120), phone: normalisePhone(organiser.phone) ?? '' },
    maxPerBooking: int(raw.maxPerBooking, 1, LIMITS.maxPerBooking) ?? 6,
    tickets,
    questions: repairConditions(questions),
    promoCodes: list(raw.promoCodes).map(cleanPromo).filter(Boolean),
    createdAt: isoOrNull(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: isoOrNull(raw.updatedAt) ?? new Date(0).toISOString(),
  }
}

/* ---------- Bookings ---------- */

/** Answers are strings, or lists of strings (multiple choice). Anything else is dropped. */
function cleanAnswers(raw) {
  if (!isObj(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!id(key)) continue
    if (typeof value === 'string') out[key] = value.slice(0, 1000)
    else if (Array.isArray(value)) out[key] = value.filter((v) => typeof v === 'string').slice(0, 30)
  }
  return out
}

export function cleanBooking(raw) {
  if (!isObj(raw) || !id(raw.id) || !BOOKING_REFERENCE.test(raw.reference ?? '') || !id(raw.eventId)) return warn('booking', raw)
  const items = list(raw.items)
    .filter((i) => isObj(i) && id(i.ticketId) && isKobo(i.unitKobo) && int(i.quantity, 1, LIMITS.maxPerBooking) != null)
    .map((i) => ({ ticketId: i.ticketId, name: str(i.name, 60), unitKobo: i.unitKobo, quantity: i.quantity }))
  if (items.length === 0 || ![raw.subtotalKobo, raw.discountKobo, raw.totalKobo].every(isKobo)) return warn('booking (money)', raw)
  const buyer = isObj(raw.buyer) ? raw.buyer : {}
  return {
    id: raw.id,
    reference: raw.reference,
    eventId: raw.eventId,
    status: oneOf(raw.status, ['confirmed', 'cancelled'], 'confirmed'),
    createdAt: isoOrNull(raw.createdAt) ?? new Date(0).toISOString(),
    cancelledAt: isoOrNull(raw.cancelledAt),
    buyer: { name: str(buyer.name, 80), email: str(buyer.email, 120), phone: normalisePhone(buyer.phone) ?? '' },
    items,
    attendees: list(raw.attendees)
      .filter((a) => isObj(a) && id(a.id) && id(a.ticketId))
      .map((a) => ({
        id: a.id,
        ticketId: a.ticketId,
        name: str(a.name, 80),
        email: str(a.email, 120),
        phone: normalisePhone(a.phone) ?? '',
        answers: cleanAnswers(a.answers),
      })),
    answers: cleanAnswers(raw.answers),
    promo: isObj(raw.promo) && str(raw.promo.code) && isKobo(raw.promo.discountKobo) ? { code: str(raw.promo.code, 20), discountKobo: raw.promo.discountKobo } : null,
    subtotalKobo: raw.subtotalKobo,
    discountKobo: raw.discountKobo,
    totalKobo: raw.totalKobo,
  }
}

export function cleanWaitlistEntry(raw) {
  if (!isObj(raw) || !id(raw.id) || !id(raw.eventId) || !str(raw.name)) return warn('waitlist entry', raw)
  return {
    id: raw.id,
    eventId: raw.eventId,
    ticketId: id(raw.ticketId),
    name: str(raw.name, 80),
    email: str(raw.email, 120),
    phone: normalisePhone(raw.phone) ?? '',
    createdAt: isoOrNull(raw.createdAt) ?? new Date(0).toISOString(),
  }
}

/** The whole saved database. Bookings and waitlist entries for events that no longer exist are dropped too. */
export function cleanDb(raw) {
  if (!isObj(raw) || raw.version !== 1) return null
  const events = list(raw.events).map(cleanEvent).filter(Boolean)
  const eventIds = new Set(events.map((e) => e.id))
  return {
    version: 1,
    events,
    bookings: list(raw.bookings)
      .map(cleanBooking)
      .filter((b) => b && eventIds.has(b.eventId)),
    waitlist: list(raw.waitlist)
      .map(cleanWaitlistEntry)
      .filter((w) => w && eventIds.has(w.eventId)),
  }
}
