import { cx } from '../../lib/cx.js'

/*
  One set of button styles, as a function rather than a component, so the
  same look works on <button>, <Link> and <a>:
    <Link className={buttonClass('primary')} to="/organise">Organise</Link>
*/
const VARIANTS = {
  primary: 'bg-gele text-on-gele hover:bg-gele-hover shadow-card',
  secondary: 'bg-gele-soft text-gele-ink hover:bg-gele-soft/70 dark:hover:bg-panel-2',
  outline: 'border border-line-strong bg-panel text-ink hover:bg-panel-2',
  ghost: 'text-ink-soft hover:bg-panel-2 hover:text-ink',
  danger: 'text-danger hover:bg-danger-soft',
  dangerSolid: 'bg-danger text-white hover:opacity-90 dark:text-paper',
  // WhatsApp's green, darkened to keep white text above 4.5:1 contrast.
  whatsapp: 'bg-[#1f7a43] text-white hover:bg-[#17633a] shadow-card',
}
const SIZES = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-sm gap-2',
  lg: 'min-h-13 px-6 text-base gap-2',
  icon: 'size-11 shrink-0',
  iconSm: 'size-9 shrink-0',
}

export function buttonClass(variant = 'primary', size = 'md', className) {
  return cx(
    'inline-flex items-center justify-center rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

export function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}
