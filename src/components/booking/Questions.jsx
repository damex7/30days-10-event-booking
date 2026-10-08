import { useEffect, useRef } from 'react'
import { CheckboxGroupField, DateField, NumberField, RadioGroupField, SelectField, TextAreaField, TextField, YesNoField } from '../../form/controls.jsx'
import { Icon } from '../ui/Icon.jsx'
import { lagosDateKey } from '../../lib/dates.js'
import { describeCondition, visibleQuestions } from '../../lib/questions.js'

/** A hint for number questions that have a range but no hint of their own. */
function rangeHint(q) {
  if (q.hint) return q.hint
  if (q.min != null && q.max != null) return `From ${q.min} to ${q.max}.`
  if (q.min != null) return `${q.min} or more.`
  if (q.max != null) return `${q.max} or less.`
  return undefined
}

/*
  One organiser-defined question, rendered from its config. This switch is
  the whole "form from config" idea: the question's `type` picks the
  control, `required` decides "(optional)", and the path decides where the
  answer is stored ("answers.q_side" or "attendees.1.answers.q_size").
*/
export function QuestionField({ form, question: q, path }) {
  const common = { form, name: path, label: q.label, hint: q.hint || undefined, optional: !q.required }
  switch (q.type) {
    case 'short':
      return <TextField {...common} maxLength={250} />
    case 'long':
      return <TextAreaField {...common} maxLength={1000} />
    case 'number':
      return <NumberField {...common} hint={rangeHint(q)} />
    case 'date':
      return <DateField {...common} min={q.notInPast ? lagosDateKey() : undefined} />
    case 'yesno':
      return <YesNoField {...common} />
    case 'single':
      // Long lists read better as a dropdown than as a wall of radio buttons.
      return q.options.length > 7 ? <SelectField {...common} options={q.options} /> : <RadioGroupField {...common} options={q.options} />
    case 'multi':
      return <CheckboxGroupField {...common} options={q.options} hint={q.hint || (q.max ? `Choose up to ${q.max}.` : 'Tick any that apply.')} />
    default:
      return null
  }
}

/*
  The visible questions for one scope (the booking, or one guest).
  When an answer makes new questions appear ("Yes" to aso-ebi → Colour,
  Head piece, Size), sighted users see them slide in below; screen-reader
  users get told through `announce`, since nothing else would tell them
  the form just grew.
*/
export function QuestionList({ form, questions, scope, bookingAnswers, guestAnswers, basePath, announce, preview = false }) {
  const visible = visibleQuestions(questions, { bookingAnswers, guestAnswers, scope })
  const ids = visible.map((q) => q.id).join(',')

  const previous = useRef(visible)
  useEffect(() => {
    const before = new Set(previous.current.map((q) => q.id))
    const added = visible.filter((q) => !before.has(q.id))
    const removed = previous.current.filter((q) => !visible.some((v) => v.id === q.id))
    previous.current = visible
    if (added.length) announce?.(`${added.length === 1 ? 'A new question appeared' : `${added.length} new questions appeared`}: ${added.map((q) => q.label).join(', ')}.`)
    else if (removed.length) announce?.(`${removed.length === 1 ? 'A question was' : `${removed.length} questions were`} removed: ${removed.map((q) => q.label).join(', ')}.`)
    // Re-run only when the set of visible questions changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  if (visible.length === 0) return null
  return (
    <div className="space-y-5">
      {visible.map((q) =>
        q.showIf ? (
          // A conditional question is indented under a gold rule, so it reads as a follow-up.
          <div key={q.id} className="animate-fade-in border-l-2 border-gold pl-4">
            {preview && (
              <p className="mb-1 flex items-center gap-1 text-xs font-bold text-gold-ink">
                <Icon name="branch" className="size-3.5" />
                {describeCondition(q, questions)}
              </p>
            )}
            <QuestionField form={form} question={q} path={`${basePath}.${q.id}`} />
          </div>
        ) : (
          <QuestionField key={q.id} form={form} question={q} path={`${basePath}.${q.id}`} />
        ),
      )}
    </div>
  )
}
