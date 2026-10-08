import { useState } from 'react'
import { LIMITS } from '../../config.js'
import { Field, FieldScope } from '../../form/Field.jsx'
import { CheckboxField, NumberField, TextField } from '../../form/controls.jsx'
import { labelClass, selectClass } from '../../form/styles.js'
import { asoEbiTemplate, blankOption, blankQuestion, conditionProblem, conditionSources } from '../../lib/eventRules.js'
import { choicesOf, describeCondition, hasOptions, QUESTION_TYPES, typeLabel } from '../../lib/questions.js'
import { cx } from '../../lib/cx.js'
import { Badge } from '../ui/Badge.jsx'
import { Button } from '../ui/Button.jsx'
import { ConfirmDialog } from '../ui/Dialog.jsx'
import { Icon } from '../ui/Icon.jsx'
import { ListItemActions, moveItem, refocusMoved } from './ListItemActions.jsx'

/*
  Step 4: the form builder. Each question is a card: a one-line summary
  when closed, the full editor when open. Everything is buttons, selects
  and checkboxes, so the whole builder works from the keyboard.

  A question with an error is forced open after Save is pressed, so its
  fields are on the page for the error summary to link to and focus.
*/

/** "Ask once per booking" vs "Ask each guest", stored as perAttendee. */
function ScopeChoice({ form, path }) {
  const value = form.get(path)
  const name = form.idFor(path)
  const option = (checked, label, hint) => (
    <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3', value === checked ? 'border-gele bg-gele-soft/60' : 'border-line-strong')}>
      <input type="radio" name={name} checked={value === checked} onChange={() => form.setValue(path, checked)} className="mt-0.5 size-5 shrink-0" />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="block text-sm text-ink-faint">{hint}</span>
      </span>
    </label>
  )
  return (
    <fieldset>
      <legend className={labelClass}>Who answers?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {option(false, 'The person booking, once', 'E.g. “Whose guest are you?”')}
        {option(true, 'Each guest', 'E.g. aso-ebi size, dietary needs')}
      </div>
    </fieldset>
  )
}

/** The "show only if" editor: a parent question, then which of its answers show this one. */
function ConditionEditor({ form, index }) {
  const questions = form.values.questions
  const q = questions[index]
  const path = `questions.${index}`
  const sources = conditionSources(questions, index)
  const parent = questions.find((p) => p.id === q.showIf?.questionId)
  const toggleId = form.idFor(`${path}.showIf-toggle`)
  const selectId = form.idFor(`${path}.showIf-parent`)

  return (
    <div className="space-y-4 rounded-xl bg-panel-2 p-4">
      <CheckboxField
        id={toggleId}
        label="Only show this question when an earlier answer matches"
        hint={sources.length ? 'For example, show “Size” only when “Do you want aso-ebi?” is Yes.' : 'Add a yes/no or choice question above this one to use this.'}
        checked={Boolean(q.showIf)}
        disabled={!q.showIf && sources.length === 0}
        onChange={(on) => form.setValue(`${path}.showIf`, on ? { questionId: sources.at(-1)?.id ?? '', anyOf: [] } : null)}
      />
      {q.showIf && (
        <Field form={form} name={`${path}.showIf`} label="Condition" group>
          {() => (
            <div className="space-y-4">
              <div>
                <label htmlFor={selectId} className={labelClass}>
                  Show when the answer to…
                </label>
                <select id={selectId} value={q.showIf.questionId} onChange={(e) => form.setValue(`${path}.showIf`, { questionId: e.target.value, anyOf: [] })} className={selectClass(false)}>
                  <option value="">Choose a question…</option>
                  {/* Keep a now-invalid parent listed, so the select shows what's actually saved. */}
                  {(parent && !sources.includes(parent) ? [parent, ...sources] : sources).map((s) => (
                    <option key={s.id} value={s.id}>
                      {questions.indexOf(s) + 1}. {s.label || 'Untitled question'}
                    </option>
                  ))}
                </select>
              </div>
              {parent && (
                <fieldset>
                  <legend className={labelClass}>…is any of</legend>
                  <div className="flex flex-wrap gap-2">
                    {choicesOf(parent).map((o) => {
                      const checked = q.showIf.anyOf.includes(o.id)
                      return (
                        <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-panel px-4 has-checked:border-gele has-checked:bg-gele-soft">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              form.setValue(`${path}.showIf.anyOf`, checked ? q.showIf.anyOf.filter((v) => v !== o.id) : [...q.showIf.anyOf, o.id])
                            }
                            className="size-5"
                          />
                          {o.label || 'Untitled option'}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          )}
        </Field>
      )}
    </div>
  )
}

/** The options of a single/multiple choice question: add, edit, reorder, remove. */
function OptionsEditor({ form, index, announce }) {
  const q = form.values.questions[index]
  const path = `questions.${index}.options`
  const setOptions = (fn) => form.setValues((v) => ({ ...v, questions: v.questions.map((x, i) => (i === index ? { ...x, options: fn(x.options) } : x)) }))

  const move = (from, to, direction) => {
    setOptions((opts) => moveItem(opts, from, to))
    form.forget((p) => p.startsWith(`${path}.`))
    announce(`Option moved to position ${to + 1}.`)
    refocusMoved(`mv-${q.options[from].id}`, direction)
  }
  const remove = (j) => {
    setOptions((opts) => opts.filter((_, k) => k !== j))
    form.forget((p) => p.startsWith(`${path}.`))
    announce('Option removed.')
    requestAnimationFrame(() => document.getElementById(`add-opt-${q.id}`)?.focus())
  }
  const add = () => {
    setOptions((opts) => [...opts, blankOption()])
    requestAnimationFrame(() => document.getElementById(form.idFor(`${path}.${q.options.length}.label`))?.focus())
  }

  return (
    <Field form={form} name={path} label="Options" hint="Guests choose from these, in this order." group>
      {() => (
        <div className="space-y-3">
          <ol className="space-y-3">
            {q.options.map((o, j) => (
              <li key={o.id} className="flex items-end gap-2">
                <TextField form={form} name={`${path}.${j}.label`} label={`Option ${j + 1}`} className="flex-1" />
                <div className="pb-1">
                  <ListItemActions idBase={`mv-${o.id}`} name={`option ${j + 1}`} index={j} count={q.options.length} onMove={move} onRemove={q.options.length > 2 ? remove : null} />
                </div>
              </li>
            ))}
          </ol>
          <Button id={`add-opt-${q.id}`} variant="outline" size="sm" onClick={add} disabled={q.options.length >= LIMITS.options}>
            <Icon name="plus" className="size-4" />
            Add an option
          </Button>
        </div>
      )}
    </Field>
  )
}

function QuestionCard({ form, index, open, onToggle, onMove, onDelete, announce }) {
  const questions = form.values.questions
  const q = questions[index]
  const path = `questions.${index}`
  const name = q.label.trim() || `Question ${index + 1}`
  const problem = conditionProblem(questions, index)
  const panelId = `q-panel-${q.id}`

  // Changing the type keeps what still makes sense: options appear for choice types.
  const changeType = (type) =>
    form.setValues((v) => ({
      ...v,
      questions: v.questions.map((x, i) =>
        i === index ? { ...x, type, options: hasOptions({ type }) && x.options.length < 2 ? [...x.options, blankOption(), blankOption()].slice(0, Math.max(2, x.options.length)) : x.options } : x,
      ),
    }))

  return (
    <li className={cx('rounded-2xl border bg-panel', open ? 'border-gele shadow-card' : 'border-line')}>
      <div className="flex flex-wrap items-start gap-2 p-4">
        <div className="min-w-0 flex-1 basis-56">
          <p className="font-display text-lg leading-snug font-semibold">
            {index + 1}. {name}
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{typeLabel(q.type)}</Badge>
            <Badge tone={q.required ? 'gele' : 'neutral'}>{q.required ? 'Required' : 'Optional'}</Badge>
            <Badge>{q.perAttendee ? 'Each guest' : 'Once per booking'}</Badge>
          </p>
          {q.showIf && !problem && (
            <p className="mt-1.5 flex items-center gap-1 text-sm text-gold-ink">
              <Icon name="branch" className="size-4" />
              {describeCondition(q, questions)}
            </p>
          )}
          {problem && !open && (
            <p className="mt-1.5 flex items-start gap-1 text-sm font-bold text-danger">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              {problem}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant={open ? 'secondary' : 'outline'} size="sm" onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
            <Icon name={open ? 'check' : 'edit'} className="size-4" />
            {open ? 'Done' : 'Edit'}
            <span className="sr-only"> {name}</span>
          </Button>
          <ListItemActions idBase={`mv-${q.id}`} name={`“${name}”`} index={index} count={questions.length} onMove={onMove} onRemove={onDelete} />
        </div>
      </div>

      {open && (
        <FieldScope label={`Question ${index + 1}`}>
          <div id={panelId} className="space-y-5 border-t border-line p-4 sm:p-5">
            <TextField form={form} name={`${path}.label`} label="Question" hint="Ask it the way you’d say it, e.g. “What’s your aso-ebi size?”" />
            <TextField form={form} name={`${path}.hint`} label="Hint" optional hint="Extra help shown under the question, like this line." />
            <Field form={form} name={`${path}.type`} label="Answer type">
              {(a11y) => (
                <select {...a11y} value={q.type} onChange={(e) => changeType(e.target.value)} className={selectClass(false, 'max-w-sm')}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}: {t.hint}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {hasOptions(q) && <OptionsEditor form={form} index={index} announce={announce} />}
            {q.type === 'number' && (
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                <NumberField form={form} name={`${path}.min`} label="Lowest" optional />
                <NumberField form={form} name={`${path}.max`} label="Highest" optional />
              </div>
            )}
            {q.type === 'multi' && <NumberField form={form} name={`${path}.max`} label="Most answers a guest can tick" optional />}
            {q.type === 'date' && (
              <CheckboxField id={form.idFor(`${path}.notInPast`)} label="Don’t allow dates in the past" checked={q.notInPast} onChange={(c) => form.setValue(`${path}.notInPast`, c)} />
            )}

            <CheckboxField id={form.idFor(`${path}.required`)} label="Guests must answer this" hint="When it’s shown. A hidden question is never required." checked={q.required} onChange={(c) => form.setValue(`${path}.required`, c)} />
            <ScopeChoice form={form} path={`${path}.perAttendee`} />
            <ConditionEditor form={form} index={index} />
          </div>
        </FieldScope>
      )}
    </li>
  )
}

export function QuestionsStep({ form, announce }) {
  const questions = form.values.questions
  const [openIds, setOpenIds] = useState(() => new Set())
  const [deleting, setDeleting] = useState(null) // index waiting for confirmation

  // After a failed Save, open every question that has a problem.
  const hasError = (i) => form.submitCount > 0 && Object.keys(form.allErrors).some((p) => p.startsWith(`questions.${i}.`))
  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addQuestions = (list) => {
    form.setValues((v) => ({ ...v, questions: [...v.questions, ...list] }))
    setOpenIds((prev) => new Set([...prev, list[0].id]))
    announce(list.length === 1 ? 'Question added.' : `${list.length} questions added.`)
    requestAnimationFrame(() => document.getElementById(form.idFor(`questions.${questions.length}.label`))?.focus())
  }

  const move = (from, to, direction) => {
    const name = questions[from].label || `Question ${from + 1}`
    form.setValues((v) => ({ ...v, questions: moveItem(v.questions, from, to) }))
    form.forget((p) => p.startsWith('questions.'))
    announce(`“${name}” moved to position ${to + 1} of ${questions.length}.`)
    refocusMoved(`mv-${questions[from].id}`, direction)
  }

  const dependents = deleting == null ? [] : questions.filter((q) => q.showIf?.questionId === questions[deleting]?.id)
  const remove = (index) => {
    const id = questions[index].id
    form.setValues((v) => ({
      ...v,
      // Questions that depended on this one lose their condition (and are always shown) rather than break.
      questions: v.questions.filter((_, i) => i !== index).map((q) => (q.showIf?.questionId === id ? { ...q, showIf: null } : q)),
    }))
    form.forget((p) => p.startsWith('questions.'))
    announce(`Question removed.${dependents.length ? ` ${dependents.length} question${dependents.length === 1 ? '' : 's'} that depended on it will now always show.` : ''}`)
    setDeleting(null)
    requestAnimationFrame(() => document.getElementById('add-question')?.focus())
  }

  const deletingName = deleting != null ? questions[deleting]?.label || `Question ${deleting + 1}` : ''

  return (
    <div className="space-y-6">
      <p className="text-ink-soft">
        Ask guests anything you’d otherwise chase on WhatsApp. Name, email and phone are already asked for every guest. Use “Only show when…” for follow-ups, like sizes only for
        people who want aso-ebi. The preview shows the form exactly as guests will see it.
      </p>

      {questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-ink-faint">No questions yet. Guests will only be asked for their contact details.</p>
      ) : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              form={form}
              index={i}
              open={openIds.has(q.id) || hasError(i)}
              onToggle={() => toggle(q.id)}
              onMove={move}
              onDelete={(index) => (questions.some((x) => x.showIf?.questionId === questions[index].id) ? setDeleting(index) : remove(index))}
              announce={announce}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <Button id="add-question" variant="secondary" onClick={() => addQuestions([blankQuestion('short')])} disabled={questions.length >= LIMITS.questions}>
          <Icon name="plus" className="size-4" />
          Add a question
        </Button>
        <Button variant="outline" onClick={() => addQuestions(asoEbiTemplate())} disabled={questions.length + 4 > LIMITS.questions}>
          <Icon name="sparkle" className="size-4" />
          Add aso-ebi questions
        </Button>
      </div>

      <ConfirmDialog
        open={deleting != null}
        title={`Delete “${deletingName}”?`}
        confirmLabel="Delete question"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={() => remove(deleting)}
        onCancel={() => setDeleting(null)}
      >
        {dependents.length > 0 && (
          <p>
            {dependents.map((d) => `“${d.label || 'Untitled'}”`).join(' and ')} {dependents.length === 1 ? 'is' : 'are'} only shown depending on this answer. If you delete it,{' '}
            {dependents.length === 1 ? 'that question' : 'they'} will always be shown.
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}
