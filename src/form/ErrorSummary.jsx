import { Icon } from '../components/ui/Icon.jsx'

/*
  The error summary at the top of a form, after a failed submit.
  - It lists every problem in PAGE order, each a link that focuses the
    field (not just scrolls to it), so keyboard users land in the box.
  - role="alert" makes screen readers announce it as soon as it appears.
    It's keyed by submitCount, so each new submit re-announces it.
  - It shrinks as you fix things, and disappears when nothing is left.

  It also holds a polite live region for the errors revealed on blur
  (useForm.announcement): a screen-reader user who tabs past a field hears
  what was wrong with it without being interrupted mid-sentence.

  A submit failure that isn't about one field (network down, storage full)
  is shown here too.
*/
export function ErrorSummary({ form }) {
  const items = form.summary
  const general = form.submitError && !form.submitError.details ? form.submitError : null

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {form.announcement}
      </div>

      {form.submitCount > 0 && items.length > 0 && (
        <div key={form.submitCount} role="alert" className="mb-6 rounded-2xl border-2 border-danger bg-danger-soft/50 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-danger">
            <Icon name="alert" className="size-5" />
            {items.length === 1 ? 'There’s 1 thing to fix' : `There are ${items.length} things to fix`}
          </h2>
          <ul className="mt-3 space-y-1.5">
            {items.map((item) => (
              <li key={item.path}>
                <a
                  href={`#${form.idFor(item.path)}`}
                  onClick={(e) => {
                    e.preventDefault()
                    form.focusField(item.path)
                  }}
                  className="font-semibold text-danger underline underline-offset-2 hover:no-underline"
                >
                  {item.label && <span>{item.label}: </span>}
                  {item.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {general && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-danger bg-danger-soft/50 p-4">
          <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="font-bold text-danger">That didn’t go through</p>
            <p className="text-ink-soft">{general.message ?? 'Please try again.'}</p>
          </div>
        </div>
      )}
    </>
  )
}
