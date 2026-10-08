import { YES_NO } from '../lib/questions.js'
import { cx } from '../lib/cx.js'
import { Field } from './Field.jsx'
import { controlClass, pillClass, selectClass } from './styles.js'

/*
  Controls built on <Field>. Each one takes the form and a path:
    <TextField form={form} name="buyer.email" label="Email" type="email" />
  and reads/writes that path through the form. Native elements all the way
  down (input, select, radio, checkbox), so the keyboard, autofill and
  screen readers work without extra code.
*/

/** Props every text-like input shares. */
function inputProps(form, name, a11y) {
  return {
    ...a11y,
    name,
    value: form.get(name) ?? '',
    onChange: (e) => form.setValue(name, e.target.value),
    onBlur: form.blurHandler(name),
  }
}

export function TextField({ form, name, label, hint, optional, className, inputClassName, ...rest }) {
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className}>
      {(a11y) => <input type="text" {...inputProps(form, name, a11y)} className={controlClass(a11y['aria-invalid'], cx('h-12', inputClassName))} {...rest} />}
    </Field>
  )
}

export function TextAreaField({ form, name, label, hint, optional, className, rows = 4, maxLength, ...rest }) {
  const length = String(form.get(name) ?? '').length
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className}>
      {(a11y) => (
        <>
          <textarea rows={rows} {...inputProps(form, name, a11y)} className={controlClass(a11y['aria-invalid'], 'min-h-24 py-3')} {...rest} />
          {/* A counter that only appears when you're getting close, instead of a hard stop mid-sentence. */}
          {maxLength && length > maxLength * 0.8 && (
            <p className={cx('mt-1 text-right text-xs', length > maxLength ? 'font-bold text-danger' : 'text-ink-faint')}>
              {length > maxLength ? `${length - maxLength} characters too many` : `${maxLength - length} characters left`}
            </p>
          )}
        </>
      )}
    </Field>
  )
}

/** Whole numbers. type="text" + inputMode="numeric", not type="number" (which accepts "1e5", changes on scroll, and hides what's wrong). */
export function NumberField({ form, name, label, hint, optional, className, ...rest }) {
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className}>
      {(a11y) => (
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          {...inputProps(form, name, a11y)}
          className={controlClass(a11y['aria-invalid'], 'h-12 max-w-40')}
          {...rest}
        />
      )}
    </Field>
  )
}

/** A calendar date ("YYYY-MM-DD"), with an optional earliest date. */
export function DateField({ form, name, label, hint, optional, className, min, ...rest }) {
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className}>
      {(a11y) => <input type="date" min={min} {...inputProps(form, name, a11y)} className={controlClass(a11y['aria-invalid'], 'h-12 max-w-56')} {...rest} />}
    </Field>
  )
}

/** A date and time ("YYYY-MM-DDTHH:mm"), entered as Lagos time. */
export function DateTimeField({ form, name, label, hint, optional, className, ...rest }) {
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className}>
      {(a11y) => <input type="datetime-local" {...inputProps(form, name, a11y)} className={controlClass(a11y['aria-invalid'], 'h-12 max-w-64')} {...rest} />}
    </Field>
  )
}

export function SelectField({ form, name, label, hint, optional, className, options, placeholder = 'Choose…', ...rest }) {
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className}>
      {(a11y) => (
        <select {...inputProps(form, name, a11y)} className={selectClass(a11y['aria-invalid'])} {...rest}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

/** Short option lists look best as pills; long labels as full-width rows. */
const fitsAsPills = (options) => options.length <= 5 && options.every((o) => o.label.length <= 16 && !o.hint)

function OptionRow({ type, name, checked, onChange, option, invalid }) {
  return (
    <label
      className={cx(
        'flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border bg-panel px-3.5 py-3 transition-colors hover:bg-panel-2',
        'has-checked:border-gele has-checked:bg-gele-soft/60 has-disabled:cursor-not-allowed has-disabled:opacity-55',
        invalid ? 'border-danger' : 'border-line-strong',
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={option.disabled}
        aria-invalid={invalid || undefined}
        className="mt-0.5 size-5 shrink-0"
      />
      <span>
        <span className="font-semibold">{option.label}</span>
        {option.hint && <span className="block text-sm text-ink-faint">{option.hint}</span>}
      </span>
    </label>
  )
}

/** One answer from a list. Arrow keys move between options, as in any native radio group. */
export function RadioGroupField({ form, name, label, hint, optional, className, options, variant }) {
  const value = form.get(name) ?? ''
  const pills = variant ? variant === 'pills' : fitsAsPills(options)
  const groupName = form.idFor(name) + '-radio'
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className} group>
      {(a11y) => (
        <div className={pills ? 'flex flex-wrap gap-2' : 'grid gap-2'}>
          {options.map((o) =>
            pills ? (
              <label key={o.id} className={pillClass(a11y['aria-invalid'] && 'border-danger')}>
                <input
                  type="radio"
                  name={groupName}
                  checked={value === o.id}
                  onChange={() => form.setValue(name, o.id)}
                  disabled={o.disabled}
                  aria-invalid={a11y['aria-invalid']}
                  className="sr-only"
                />
                {value === o.id && <span aria-hidden="true">✓</span>}
                {o.label}
              </label>
            ) : (
              <OptionRow
                key={o.id}
                type="radio"
                name={groupName}
                checked={value === o.id}
                onChange={() => form.setValue(name, o.id)}
                option={o}
                invalid={a11y['aria-invalid']}
              />
            ),
          )}
        </div>
      )}
    </Field>
  )
}

export function YesNoField(props) {
  return <RadioGroupField {...props} options={YES_NO} variant="pills" />
}

/** Any number of answers; the value is a list of option ids, kept in the options' order. */
export function CheckboxGroupField({ form, name, label, hint, optional, className, options }) {
  const value = form.get(name) ?? []
  const toggle = (id) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    form.setValue(
      name,
      options.map((o) => o.id).filter((oid) => next.includes(oid)),
    )
  }
  return (
    <Field form={form} name={name} label={label} hint={hint} optional={optional} className={className} group>
      {(a11y) => (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <OptionRow
              key={o.id}
              type="checkbox"
              name={`${form.idFor(name)}-cb`}
              checked={value.includes(o.id)}
              onChange={() => toggle(o.id)}
              option={o}
              invalid={a11y['aria-invalid']}
            />
          ))}
        </div>
      )}
    </Field>
  )
}

/** A single on/off checkbox with its label beside it ("Same as the person booking"). Not validated, so no Field frame. */
export function CheckboxField({ id, label, hint, checked, onChange, className, disabled }) {
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 size-5 shrink-0"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <div>
        <label htmlFor={id} className="cursor-pointer font-semibold">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-faint">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
