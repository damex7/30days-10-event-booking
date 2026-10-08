import { createContext, useContext } from 'react'
import { Icon } from '../components/ui/Icon.jsx'
import { cx } from '../lib/cx.js'
import { labelClass } from './styles.js'

/*
  Field: the frame around every control. It owns the accessibility
  wiring, so no individual input has to remember it:

    <label for=id>        names the input (a <legend> names a group)
    hint  id=id-hint      ┐ both listed in the control's aria-describedby,
    error id=id-error     ┘ so a screen reader reads them on focus
    aria-invalid          marks a control with an error showing

  The hint and error sit ABOVE the control (label → hint → error → input).
  On a phone the keyboard covers the bottom half of the screen, and text
  below the field you're typing in is the first thing hidden.

  An error isn't shown by colour alone: there's an icon, the message, and
  a thick bar down the left edge.

  data-field / data-label let useForm find fields in page order and name
  them in the error summary ("Guest 2 · Email").
*/

/** Gives fields a prefix for the summary, e.g. <FieldScope label="Guest 2">. */
const ScopeContext = createContext('')
export function FieldScope({ label, children }) {
  return <ScopeContext.Provider value={label}>{children}</ScopeContext.Provider>
}

export function Field({ form, name, label, hint, optional = false, group = false, className, children }) {
  const scope = useContext(ScopeContext)
  const id = form.idFor(name)
  const error = form.errors[name]
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = { id: group ? undefined : id, 'aria-describedby': group ? undefined : describedBy, 'aria-invalid': error ? true : undefined }

  const frame = cx('min-w-0', error && 'border-l-4 border-danger pl-3', className)
  const LabelTag = group ? 'legend' : 'label'
  const body = (
    <>
      <LabelTag {...(group ? {} : { htmlFor: id })} className={cx(labelClass, group && 'float-left w-full')}>
        {label}
        {optional && <span className="font-normal text-ink-faint"> (optional)</span>}
      </LabelTag>
      {hint && (
        <p id={hintId} className="clear-left -mt-0.5 mb-2 text-sm text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="clear-left mb-2 flex items-start gap-1.5 text-sm font-bold text-danger">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
      <div className="clear-left">{children(control)}</div>
    </>
  )

  const shared = { 'data-field': name, 'data-label': scope ? `${scope} · ${label}` : label }
  return group ? (
    // The fieldset is the group's focus target and blur boundary (see useForm.blurHandler).
    <fieldset id={id} aria-describedby={describedBy} onBlur={form.blurHandler(name)} className={frame} {...shared}>
      {body}
    </fieldset>
  ) : (
    <div className={frame} {...shared}>
      {body}
    </div>
  )
}
