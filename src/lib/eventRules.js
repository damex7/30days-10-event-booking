import { CATEGORIES, CITIES, COVER_PATTERNS, COVER_TONES, LIMITS } from '../config.js'
import { after, between, check, collect, email, integer, maxLength, minLength, ngPhone, notBefore, oneOf, required } from '../form/validators.js'
import { isoToLagosInput, lagosInputToISO } from './dates.js'
import { newId } from './ids.js'
import { koboToWholeNaira, nairaToKobo } from './money.js'
import { normalisePhone } from './phone.js'
import { canBeCondition, choicesOf, hasOptions, QUESTION_TYPE_IDS } from './questions.js'

/*
  The event editor's rules: how an event becomes form values and back,
  and what makes each step valid. Pure functions, used by the editor (step
  by step) and by db.js (all at once, before saving), like bookingRules.

  Form values keep what the inputs show, as strings: prices in whole
  naira ("15000"), dates as Lagos wall-clock time ("2026-11-14T18:00").
  formToEvent() converts once, on save: naira → kobo, Lagos time → UTC.
*/

export const EDITOR_STEPS = [
  { id: 'details', label: 'Details', title: 'About your event' },
  { id: 'when', label: 'When & where', title: 'When and where' },
  { id: 'tickets', label: 'Tickets', title: 'Tickets' },
  { id: 'questions', label: 'Questions', title: 'Questions for your guests' },
]

/* ---------- Building values ---------- */

export const blankTicket = (name = '') => ({ id: newId('tkt'), name, description: '', price: '0', quantity: '100', salesEndAt: '' })
export const blankOption = (label = '') => ({ id: newId('o'), label })
export const blankQuestion = (type = 'short') => ({
  id: newId('q'),
  label: '',
  hint: '',
  type,
  required: false,
  perAttendee: false,
  options: hasOptions({ type }) ? [blankOption(), blankOption()] : [],
  min: '',
  max: '',
  notInPast: false,
  showIf: null,
})

export function blankEventValues() {
  return {
    title: '',
    summary: '',
    description: '',
    category: '',
    cover: { pattern: 'lace', tone: 'magenta' },
    startsAt: '',
    endsAt: '',
    venue: { name: '', address: '', city: '' },
    organiser: { name: '', email: '', phone: '' },
    maxPerBooking: '6',
    tickets: [blankTicket('Regular')],
    questions: [],
    promoCodes: [],
  }
}

const numText = (n) => (n == null ? '' : String(n))

export function eventToForm(event) {
  return {
    title: event.title,
    summary: event.summary,
    description: event.description,
    category: event.category,
    cover: { ...event.cover },
    startsAt: isoToLagosInput(event.startsAt),
    endsAt: isoToLagosInput(event.endsAt),
    venue: { ...event.venue },
    organiser: { ...event.organiser },
    maxPerBooking: String(event.maxPerBooking),
    tickets: event.tickets.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      price: String(koboToWholeNaira(t.priceKobo)),
      quantity: String(t.quantity),
      salesEndAt: t.salesEndAt ? isoToLagosInput(t.salesEndAt) : '',
    })),
    questions: event.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })), min: numText(q.min), max: numText(q.max), showIf: q.showIf ? { ...q.showIf, anyOf: [...q.showIf.anyOf] } : null })),
    promoCodes: event.promoCodes.map((p) => ({ code: p.code, kind: p.kind, value: String(p.kind === 'fixed' ? koboToWholeNaira(p.value) : p.value) })),
  }
}

const int = (v) => (/^-?\d+$/.test(String(v ?? '').trim()) ? Number(v) : null)

/**
 * Form values → the event record. `tolerant` (for the live preview) turns
 * half-typed values into something renderable instead of failing.
 */
export function formToEvent(values, { id = 'evt_preview', slug = 'preview', createdAt, tolerant = false } = {}) {
  const now = new Date().toISOString()
  const startsAt = lagosInputToISO(values.startsAt) ?? (tolerant ? now : null)
  const endsAt = lagosInputToISO(values.endsAt) ?? (tolerant ? new Date(Date.parse(startsAt) + 3_600_000).toISOString() : null)
  return {
    id,
    slug,
    title: values.title.trim() || (tolerant ? 'Your event' : ''),
    category: values.category || 'community',
    summary: values.summary.trim(),
    description: values.description.trim(),
    cover: { ...values.cover },
    startsAt,
    endsAt,
    venue: { name: values.venue.name.trim(), address: values.venue.address.trim(), city: values.venue.city },
    organiser: { name: values.organiser.name.trim(), email: values.organiser.email.trim().toLowerCase(), phone: normalisePhone(values.organiser.phone) ?? '' },
    maxPerBooking: int(values.maxPerBooking) ?? 6,
    tickets: values.tickets.map((t, i) => ({
      id: t.id,
      name: t.name.trim() || (tolerant ? `Ticket ${i + 1}` : ''),
      description: t.description.trim(),
      priceKobo: nairaToKobo(Math.max(0, int(t.price) ?? 0)),
      quantity: Math.max(tolerant ? 1 : 0, int(t.quantity) ?? 0),
      salesEndAt: lagosInputToISO(t.salesEndAt),
    })),
    questions: values.questions.map((q) => ({
      id: q.id,
      label: q.label.trim() || (tolerant ? 'Untitled question' : ''),
      hint: q.hint.trim(),
      type: q.type,
      required: q.required,
      perAttendee: q.perAttendee,
      options: hasOptions(q) ? q.options.map((o, j) => ({ id: o.id, label: o.label.trim() || (tolerant ? `Option ${j + 1}` : '') })) : [],
      min: q.type === 'number' || q.type === 'multi' ? int(q.min) : null,
      max: q.type === 'number' || q.type === 'multi' ? int(q.max) : null,
      notInPast: q.type === 'date' && q.notInPast,
      showIf: q.showIf && q.showIf.questionId && q.showIf.anyOf.length ? { questionId: q.showIf.questionId, anyOf: [...q.showIf.anyOf] } : null,
    })),
    promoCodes: values.promoCodes.map((p) => ({
      code: p.code.trim().toUpperCase(),
      kind: p.kind,
      value: p.kind === 'fixed' ? nairaToKobo(int(p.value) ?? 0) : (int(p.value) ?? 0),
    })),
    createdAt: createdAt ?? now,
    updatedAt: now,
  }
}

/* ---------- Conditions ("show only if") ---------- */

/**
 * The questions that question `index` may depend on: earlier ones, of a
 * type that has fixed answers, in a compatible scope (a booking-level
 * question can't depend on a per-guest one: which guest?).
 */
export function conditionSources(questions, index) {
  const q = questions[index]
  return questions.slice(0, index).filter((p) => canBeCondition(p) && !(p.perAttendee && !q.perAttendee))
}

/** What's wrong with a question's condition, if anything (shown on the card and used by validation). */
export function conditionProblem(questions, index) {
  const q = questions[index]
  if (!q.showIf) return null
  const parentIndex = questions.findIndex((p) => p.id === q.showIf.questionId)
  const parent = questions[parentIndex]
  if (!q.showIf.questionId) return 'Choose which question this depends on.'
  if (!parent) return 'The question this depended on was deleted. Choose another, or turn the condition off.'
  const name = parent.label.trim() || `Question ${parentIndex + 1}`
  if (parentIndex > index) return `This depends on “${name}”, which now comes after it. Move it below “${name}”.`
  if (!canBeCondition(parent)) return `“${name}” is no longer a choice or yes/no question, so it can’t control this one.`
  if (parent.perAttendee && !q.perAttendee) return `“${name}” is asked for each guest, so a once-per-booking question can’t depend on it. Ask this one for each guest too.`
  if (q.showIf.anyOf.length === 0) return `Tick at least one answer to “${name}” that shows this question.`
  if (q.showIf.anyOf.some((v) => !choicesOf(parent).some((o) => o.id === v))) return `One of the answers this depends on was removed from “${name}”. Tick the answers again.`
  return null
}

/* ---------- Validation, step by step ---------- */

function detailsErrors(v) {
  const e = {}
  collect(e, 'title', check(v.title, required('Give your event a name.'), minLength(4, 'Use at least 4 characters, e.g. “Ada’s 30th”.'), maxLength(100, 'Keep the name under 100 characters.')))
  collect(e, 'summary', check(v.summary, maxLength(160, 'Keep the summary under 160 characters: it’s shown on the event card.')))
  collect(e, 'description', check(v.description, required('Describe your event, so guests know what to expect.'), minLength(20, 'Add a little more: at least 20 characters.'), maxLength(4000, 'Keep the description under 4,000 characters.')))
  collect(e, 'category', check(v.category, required('Choose a category.'), oneOf(CATEGORIES.map((c) => c.id), 'Choose one of the categories.')))
  collect(e, 'cover.pattern', check(v.cover.pattern, oneOf(COVER_PATTERNS, 'Choose a pattern.')))
  collect(e, 'cover.tone', check(v.cover.tone, oneOf(COVER_TONES, 'Choose a colour.')))
  collect(e, 'organiser.name', check(v.organiser.name, required('Enter the organiser’s name, as guests should see it.'), maxLength(80, 'Keep the name under 80 characters.')))
  collect(e, 'organiser.email', check(v.organiser.email, required('Enter an email guests can contact.'), email()))
  collect(e, 'organiser.phone', check(v.organiser.phone, ngPhone()))
  return e
}

function whenErrors(v, ctx) {
  const e = {}
  const nowLocal = isoToLagosInput((ctx.now ?? new Date()).toISOString())
  // Only a NEW start time must be in the future: editing the venue of an event that started yesterday is fine.
  const startChanged = ctx.isNew || v.startsAt !== ctx.originalStartsAt
  collect(e, 'startsAt', check(v.startsAt, required('Enter the date and time the event starts.'), startChanged && notBefore(nowLocal, 'The start can’t be in the past. Choose a later date or time.')))
  collect(
    e,
    'endsAt',
    check(
      v.endsAt,
      required('Enter the date and time the event ends.'),
      after(v.startsAt, 'The end must be after the start. Check the date as well as the time.'),
      (end) => (v.startsAt && end && Date.parse(lagosInputToISO(end)) - Date.parse(lagosInputToISO(v.startsAt)) > 14 * 86_400_000 ? 'An event can last up to 14 days.' : undefined),
    ),
  )
  collect(e, 'venue.name', check(v.venue.name, required('Enter the venue’s name, e.g. “Ocean Pearl Event Hall”.'), maxLength(100, 'Keep the venue name under 100 characters.')))
  collect(e, 'venue.address', check(v.venue.address, required('Enter the address, so guests can find it.'), maxLength(200, 'Keep the address under 200 characters.')))
  collect(e, 'venue.city', check(v.venue.city, required('Choose the city.'), oneOf(CITIES, 'Choose one of the cities.')))
  return e
}

function ticketErrors(v, ctx) {
  const e = {}
  const sold = ctx.sold ?? {}
  collect(e, 'maxPerBooking', check(v.maxPerBooking, required('Enter how many tickets one person may book.'), integer(), between(1, LIMITS.maxPerBooking, `Enter a number from 1 to ${LIMITS.maxPerBooking}.`)))
  if (v.tickets.length === 0) e.tickets = 'Add at least one ticket type.'
  if (v.tickets.length > LIMITS.ticketTypes) e.tickets = `You can have up to ${LIMITS.ticketTypes} ticket types.`
  const names = v.tickets.map((t) => t.name.trim().toLowerCase())
  v.tickets.forEach((t, i) => {
    const p = `tickets.${i}`
    const taken = sold[t.id] ?? 0
    collect(
      e,
      `${p}.name`,
      check(t.name, required('Name this ticket, e.g. “Regular” or “VIP”.'), maxLength(60, 'Keep the name under 60 characters.'), (n) =>
        names.indexOf(n.trim().toLowerCase()) !== i ? 'Another ticket has this name. Give each ticket its own name.' : undefined,
      ),
    )
    collect(e, `${p}.price`, check(t.price, required('Enter a price. Use 0 for a free ticket.'), integer('Enter the price in whole naira, like 5000.'), between(0, LIMITS.priceNaira, 'Enter a price from ₦0 to ₦10,000,000.')))
    collect(
      e,
      `${p}.quantity`,
      check(
        t.quantity,
        required('Enter how many of this ticket are available.'),
        integer(),
        between(1, LIMITS.ticketQuantity, `Enter a number from 1 to ${LIMITS.ticketQuantity.toLocaleString('en-NG')}.`),
        between(taken, null, `${taken} of these are already booked, so the quantity can’t be lower than ${taken}.`),
      ),
    )
    collect(e, `${p}.salesEndAt`, check(t.salesEndAt, (end) => (v.endsAt && end && end >= v.endsAt ? 'Sales must end before the event ends.' : undefined)))
    collect(e, `${p}.description`, check(t.description, maxLength(200, 'Keep the description under 200 characters.')))
  })
  // Tickets that people have booked can't vanish (their bookings would point at nothing).
  for (const [ticketId, n] of Object.entries(sold)) {
    if (n > 0 && !v.tickets.some((t) => t.id === ticketId)) e.tickets = 'A ticket type with bookings was removed. Undo that, or cancel its bookings first.'
  }
  const codes = v.promoCodes.map((c) => c.code.trim().toUpperCase())
  v.promoCodes.forEach((c, i) => {
    const p = `promoCodes.${i}`
    collect(
      e,
      `${p}.code`,
      check(c.code, required('Enter the code guests will type.'), (x) => (/^[A-Za-z0-9]{3,20}$/.test(x.trim()) ? undefined : 'Use 3 to 20 letters and numbers, with no spaces.'), (x) =>
        codes.indexOf(x.trim().toUpperCase()) !== i ? 'This code is listed twice.' : undefined,
      ),
    )
    collect(
      e,
      `${p}.value`,
      c.kind === 'percent'
        ? check(c.value, required('Enter the percentage off.'), integer(), between(1, 100, 'Enter a percentage from 1 to 100.'))
        : check(c.value, required('Enter the amount off, in naira.'), integer('Enter whole naira, like 2000.'), between(1, LIMITS.priceNaira, 'Enter an amount of at least ₦1.')),
    )
  })
  return e
}

function questionErrors(v) {
  const e = {}
  if (v.questions.length > LIMITS.questions) e.questions = `You can ask up to ${LIMITS.questions} questions.`
  v.questions.forEach((q, i) => {
    const p = `questions.${i}`
    collect(e, `${p}.label`, check(q.label, required('Write the question, e.g. “What’s your aso-ebi size?”.'), maxLength(120, 'Keep the question under 120 characters.')))
    collect(e, `${p}.hint`, check(q.hint, maxLength(200, 'Keep the hint under 200 characters.')))
    collect(e, `${p}.type`, check(q.type, oneOf(QUESTION_TYPE_IDS, 'Choose a question type.')))
    if (hasOptions(q)) {
      if (q.options.length < 2) e[`${p}.options`] = 'Add at least 2 options.'
      if (q.options.length > LIMITS.options) e[`${p}.options`] = `Use up to ${LIMITS.options} options.`
      const labels = q.options.map((o) => o.label.trim().toLowerCase())
      q.options.forEach((o, j) => {
        collect(
          e,
          `${p}.options.${j}.label`,
          check(o.label, required('Enter this option, or remove it.'), maxLength(60, 'Keep options under 60 characters.'), (x) =>
            labels.indexOf(x.trim().toLowerCase()) !== j ? 'This option is listed twice.' : undefined,
          ),
        )
      })
    }
    if (q.type === 'number') {
      collect(e, `${p}.min`, check(q.min, integer()))
      collect(e, `${p}.max`, check(q.max, integer(), (mx) => (int(q.min) != null && int(mx) != null && int(mx) < int(q.min) ? 'The highest number must be at least the lowest.' : undefined)))
    }
    if (q.type === 'multi') {
      collect(e, `${p}.max`, check(q.max, integer(), between(1, q.options.length, `Enter a number from 1 to ${q.options.length} (the number of options).`)))
    }
    collect(e, `${p}.showIf`, conditionProblem(v.questions, i) ?? undefined)
  })
  return e
}

const STEP_RULES = { details: detailsErrors, when: whenErrors, tickets: ticketErrors, questions: questionErrors }

/**
 * Errors for one step of the editor.
 * ctx: { isNew, originalStartsAt, sold: { ticketId: count }, now }
 */
export const validateEventStep = (stepId, values, ctx = {}) => STEP_RULES[stepId](values, ctx)

/** Every step at once (the final Save, and db.js). */
export function validateEvent(values, ctx = {}) {
  return Object.assign({}, ...EDITOR_STEPS.map((s) => STEP_RULES[s.id](values, ctx)))
}

/** The first step with a problem, or null. */
export function firstInvalidStep(values, ctx) {
  return EDITOR_STEPS.find((s) => Object.keys(STEP_RULES[s.id](values, ctx)).length > 0)?.id ?? null
}

/* ---------- Ready-made questions ---------- */

/** The aso-ebi set every owambe needs: Yes/No, then colour, head piece and size only for "Yes". */
export function asoEbiTemplate() {
  const want = { ...blankQuestion('yesno'), label: 'Do you want aso-ebi?', hint: 'Tell guests the price and how to pay.', required: true, perAttendee: true }
  const when = { questionId: want.id, anyOf: ['yes'] }
  return [
    want,
    { ...blankQuestion('single'), label: 'Aso-ebi colour', required: true, perAttendee: true, options: [blankOption('Gold'), blankOption('Wine')], showIf: { ...when } },
    { ...blankQuestion('single'), label: 'Head piece', required: true, perAttendee: true, options: [blankOption('Gele'), blankOption('Fila (cap)'), blankOption('No head piece')], showIf: { ...when } },
    {
      ...blankQuestion('single'),
      label: 'Size',
      required: true,
      perAttendee: true,
      options: ['S', 'M', 'L', 'XL', 'XXL'].map((s) => blankOption(s)),
      showIf: { ...when },
    },
  ]
}

/* ---------- Drafts ---------- */

/*
  A saved editor draft, made safe to load: every field is forced into the
  shape of a fresh form (strings stay strings, lists stay lists of the
  right items), so a corrupted or outdated draft can't crash the editor.
  Anything unusable falls back to the blank value.
*/
function conform(raw, template) {
  if (typeof template === 'string') return typeof raw === 'string' ? raw.slice(0, 4000) : template
  if (typeof template === 'boolean') return typeof raw === 'boolean' ? raw : template
  if (template && typeof template === 'object' && !Array.isArray(template)) {
    const src = raw && typeof raw === 'object' ? raw : {}
    return Object.fromEntries(Object.entries(template).map(([k, t]) => [k, conform(src[k], t)]))
  }
  return template
}

const conformList = (raw, make) => (Array.isArray(raw) ? raw.slice(0, 30).filter((x) => x && typeof x === 'object' && typeof x.id === 'string') : []).map((x) => conform(x, make(x)))

export function cleanEditorDraft(raw) {
  if (!raw || typeof raw !== 'object') return null
  const base = blankEventValues()
  const { tickets, questions, promoCodes, ...rest } = base
  return {
    ...conform(raw, rest),
    tickets: conformList(raw.tickets, (t) => ({ ...blankTicket(), id: t.id })),
    questions: conformList(raw.questions, (q) => ({ ...blankQuestion(), id: q.id })).map((q, i) => {
      const src = raw.questions.filter((x) => x && typeof x.id === 'string')[i] ?? {}
      return {
        ...q,
        type: QUESTION_TYPE_IDS.includes(q.type) ? q.type : 'short',
        options: conformList(src.options, (o) => ({ ...blankOption(), id: o.id })),
        showIf: src.showIf && typeof src.showIf.questionId === 'string' ? { questionId: src.showIf.questionId, anyOf: (src.showIf.anyOf ?? []).filter((v) => typeof v === 'string') } : null,
      }
    }),
    promoCodes: (Array.isArray(raw.promoCodes) ? raw.promoCodes : []).map((p) => conform(p, { ...promoCodes[0], code: '', kind: 'percent', value: '' })).map((p) => ({ ...p, kind: p.kind === 'fixed' ? 'fixed' : 'percent' })),
  }
}

/** Which step a field belongs to (to jump to the right step when the server reports a problem). */
export function stepOfPath(path) {
  if (/^(startsAt|endsAt|venue\.)/.test(path)) return 'when'
  if (/^(tickets|maxPerBooking|promoCodes)/.test(path)) return 'tickets'
  if (/^questions/.test(path)) return 'questions'
  return 'details'
}
