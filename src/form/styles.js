import { cx } from '../lib/cx.js'

/*
  Shared looks for form controls, used by the form toolkit and the filters.
  Inputs are at least 48px tall (44px is the minimum touch target), and a
  16px font size stops iPhones from zooming in when a field gets focus.
*/
export const controlClass = (invalid, className) =>
  cx(
    'w-full rounded-xl border bg-panel px-3.5 text-base text-ink placeholder:text-ink-faint disabled:bg-panel-2 disabled:text-ink-faint',
    invalid ? 'border-danger ring-1 ring-danger' : 'border-line-strong',
    className,
  )

/* Native <select> with our own chevron (the select-chevron utility in index.css). */
export const selectClass = (invalid, className) => controlClass(invalid, cx('select-chevron h-12 pr-10', className))

export const labelClass = 'mb-1.5 block text-sm font-bold text-ink'

/*
  A radio or checkbox drawn as a pill. The real <input> stays in the label
  (visually hidden, still focusable and announced), and the label reacts
  to it with has-[...] variants: checked → filled, keyboard focus → ring.
*/
export const pillClass = (className) =>
  cx(
    'relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-line-strong bg-panel px-4 text-sm font-bold text-ink-soft transition-colors select-none',
    'hover:bg-panel-2 has-checked:border-gele has-checked:bg-gele has-checked:text-on-gele',
    'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
    'has-disabled:cursor-not-allowed has-disabled:opacity-55',
    className,
  )
