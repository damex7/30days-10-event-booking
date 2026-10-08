import { Icon } from './Icon.jsx'
import { Button } from './Button.jsx'
import { cx } from '../../lib/cx.js'

/*
  The three states every data view needs besides "here's your data":
  loading (Skeleton), failed (ErrorState with Retry) and nothing yet
  (EmptyState, which points to the next step instead of just saying "none").
*/

/** A placeholder block that pulses while content loads. Hidden from screen readers. */
export function Skeleton({ className, ...rest }) {
  return <div aria-hidden="true" className={cx('animate-shimmer rounded-lg bg-panel-2', className)} {...rest} />
}

/** Announces "Loading…" once for screen readers while the skeletons show. */
export function LoadingNote({ children = 'Loading…' }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  )
}

export function EmptyState({ icon = 'ticket', title, children, action, className }) {
  return (
    <div className={cx('mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center', className)}>
      <div className="lace foil-edge grid size-20 place-items-center rounded-full bg-panel text-gele-ink">
        <Icon name={icon} className="size-9" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold text-ink">{title}</h2>
      {children && <div className="mt-2 text-ink-soft">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/** role="alert" so screen readers announce the failure when it appears. */
export function ErrorState({ error, onRetry, title = 'Something went wrong', className }) {
  return (
    <div role="alert" className={cx('mx-auto flex max-w-md flex-col items-center px-4 py-10 text-center', className)}>
      <div className="grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <Icon name="alert" className="size-7" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-ink-soft">{error?.message ?? 'Please try again.'}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <Icon name="retry" className="size-4" />
          Try again
        </Button>
      )}
    </div>
  )
}
