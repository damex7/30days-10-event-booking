import { cx } from '../../lib/cx.js'

const TONES = {
  neutral: 'bg-panel-2 text-ink-soft',
  gele: 'bg-gele-soft text-gele-ink',
  gold: 'bg-gold-soft text-gold-ink',
  teal: 'bg-teal-soft text-teal-ink',
  danger: 'bg-danger-soft text-danger',
}

/** A small label. Its text says what it means; colour only reinforces it. */
export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  )
}
