import { formatDateKey } from './dates.js'

/*
  Custom questions: the organiser's own fields ("Aso-ebi colour", "Size"),
  and the rules for when each one is shown.

  A question is plain data:
    { id, label, hint, type, required, perAttendee, options, min, max,
      notInPast, showIf: null | { questionId, anyOf: [...] } }

  `perAttendee` questions are asked once for EACH guest (everyone has their
  own aso-ebi size); the others once per booking ("Whose guest are you?").

  CONDITIONS. One shape for every type: "show this question when the
  answer to `questionId` is any of `anyOf`":
    yes/no          answers are 'yes' / 'no'          anyOf: ['yes']
    single choice   the answer is an option id        anyOf: ['o_gold', 'o_wine']
    multiple choice the answer is a list of ids; it matches if ANY picked
                    option is in anyOf
  Other types (text, number, date) can't be a condition's source: "show if
  the answer is 'yes'" is clear for a choice and guesswork for free text.

  Ordering rules (the editor enforces them, cleanEvent re-checks saved data):
    - a question may only depend on an EARLIER question, so there are no
      loops and the form reads top to bottom;
    - a per-guest question may depend on a booking question or on an
      earlier question for the same guest; a booking question may only
      depend on another booking question (it has no single guest to look at).

  Visibility is chained: if the parent is hidden, so is the child, even if
  the parent's old answer would still match. Untick "Do you want aso-ebi?"
  and "Colour" disappears, and so does "Size", which depended on "Colour".
*/

export const QUESTION_TYPES = [
  { id: 'short', label: 'Short answer', hint: 'A name, a word or a line of text' },
  { id: 'long', label: 'Long answer', hint: 'A few sentences' },
  { id: 'single', label: 'Single choice', hint: 'Pick one option' },
  { id: 'multi', label: 'Multiple choice', hint: 'Tick any that apply' },
  { id: 'number', label: 'Number', hint: 'A whole number, with an optional range' },
  { id: 'date', label: 'Date', hint: 'A calendar date' },
  { id: 'yesno', label: 'Yes / no', hint: 'Two buttons: Yes and No' },
]
export const QUESTION_TYPE_IDS = QUESTION_TYPES.map((t) => t.id)
export const typeLabel = (id) => QUESTION_TYPES.find((t) => t.id === id)?.label ?? id

export const YES_NO = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
]

export const hasOptions = (q) => q.type === 'single' || q.type === 'multi'
/** Types whose answer can switch another question on or off. */
export const canBeCondition = (q) => q.type === 'single' || q.type === 'multi' || q.type === 'yesno'
/** The options a choice-like question offers (yes/no has fixed ones). */
export const choicesOf = (q) => (q.type === 'yesno' ? YES_NO : hasOptions(q) ? q.options : [])

export const isEmptyAnswer = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
export const emptyAnswerFor = (q) => (q.type === 'multi' ? [] : '')

/** Does an answer satisfy a showIf? */
export function matchesCondition(showIf, answer) {
  if (isEmptyAnswer(answer)) return false
  return Array.isArray(answer) ? answer.some((a) => showIf.anyOf.includes(a)) : showIf.anyOf.includes(answer)
}

/**
 * The questions that are visible right now, in order.
 *   bookingAnswers: { questionId: answer } for once-per-booking questions
 *   guestAnswers:   the same for ONE guest (omit for the booking-level list)
 * Pass `scope: 'booking'` or `scope: 'guest'` to get that half of the form.
 *
 * Because parents always come before children, one pass in order is
 * enough: by the time we reach a question, its parent's visibility is known.
 */
export function visibleQuestions(questions, { bookingAnswers = {}, guestAnswers = {}, scope }) {
  const visible = new Set()
  const byId = new Map(questions.map((q) => [q.id, q]))
  for (const q of questions) {
    if (!q.showIf) {
      visible.add(q.id)
      continue
    }
    const parent = byId.get(q.showIf.questionId)
    // A broken condition (parent deleted) shows the question rather than silently losing it.
    if (!parent) {
      visible.add(q.id)
      continue
    }
    if (!visible.has(parent.id)) continue
    const answer = parent.perAttendee ? guestAnswers?.[parent.id] : bookingAnswers?.[parent.id]
    if (matchesCondition(q.showIf, answer)) visible.add(q.id)
  }
  return questions.filter((q) => visible.has(q.id) && (scope == null || (scope === 'guest') === Boolean(q.perAttendee)))
}

/**
 * Keep only the answers to questions that are visible and answered.
 * This is what gets validated and saved: an answer to a hidden question
 * (you picked "Gold", then switched aso-ebi to No) never leaves the form.
 */
export function pruneAnswers(questions, { answers = {}, attendees = [] }) {
  const keep = (list, source) =>
    Object.fromEntries(list.filter((q) => !isEmptyAnswer(source?.[q.id])).map((q) => [q.id, source[q.id]]))
  return {
    answers: keep(visibleQuestions(questions, { bookingAnswers: answers, scope: 'booking' }), answers),
    attendees: attendees.map((a) => ({
      ...a,
      answers: keep(visibleQuestions(questions, { bookingAnswers: answers, guestAnswers: a.answers, scope: 'guest' }), a.answers),
    })),
  }
}

/** An answer as words, for summaries, the dashboard and the CSV. */
export function formatAnswer(q, value) {
  if (isEmptyAnswer(value)) return ''
  if (q.type === 'yesno') return value === 'yes' ? 'Yes' : 'No'
  if (hasOptions(q)) {
    const label = (id) => q.options.find((o) => o.id === id)?.label ?? '(removed option)'
    return Array.isArray(value) ? value.map(label).join(', ') : label(value)
  }
  if (q.type === 'date') return formatDateKey(value)
  return String(value)
}

/** "Shown when 'Do you want aso-ebi?' is Yes" (for the form builder and preview). */
export function describeCondition(q, questions) {
  if (!q.showIf) return ''
  const parent = questions.find((p) => p.id === q.showIf.questionId)
  if (!parent) return 'Shown always (its condition points to a deleted question)'
  const names = choicesOf(parent)
    .filter((o) => q.showIf.anyOf.includes(o.id))
    .map((o) => o.label)
  return `Shown when “${parent.label}” is ${names.join(' or ') || '…'}`
}
