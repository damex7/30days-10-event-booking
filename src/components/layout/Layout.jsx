import { useEffect } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle.jsx'
import { cx } from '../../lib/cx.js'
import { APP_NAME } from '../../config.js'

const NAV = [
  { to: '/', label: 'Events', end: true },
  { to: '/organise', label: 'Organise' },
]

/*
  App shell: a gele-magenta header band with gold lace, the page, a footer.
  <ScrollRestoration> (a data-router feature) puts you back where you were
  on Back, and at the top of each new page.
*/
export function Layout() {
  // Move focus to <main> on a new page, so keyboard and screen-reader users
  // start at the content, not wherever the old page's focus was.
  const { pathname } = useLocation()
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        data-print-hide
        className="sr-only z-50 rounded-md bg-panel px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header data-print-hide className="on-band relative z-30 bg-band [--lace:var(--color-gold)] md:sticky md:top-0">
        <div className="lace pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:gap-6">
          <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg">
            <Brand />
          </Link>
          <nav aria-label="Main" className="ml-auto">
            <ul className="flex gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold transition-colors sm:px-4',
                        isActive ? 'bg-on-band text-band-deep' : 'hover:bg-white/10',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
        <div className="h-1 bg-gold" aria-hidden="true" />
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 outline-none">
        <Outlet />
      </main>

      <footer data-print-hide className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-ink-faint sm:flex-row sm:justify-between">
          <p>
            <span className="font-display font-semibold text-ink italic">{APP_NAME}</span>: a Day 10 demo. Bookings are saved in this
            browser only and no money changes hands.
          </p>
          <p>All times are Lagos time (WAT, UTC+1).</p>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  )
}

/* "Ìpè" with a little gold envelope. The text is the link's accessible name. */
export function Brand() {
  return (
    <>
      <svg viewBox="0 0 64 64" className="size-9" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="currentColor" opacity="0.12" />
        <path d="M10 26c8-12 36-12 44 0-8-4-36-4-44 0Z" fill="#e2ad2f" />
        <path d="M14 30h36v20a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V30Z" fill="#fff6ec" />
        <path d="m14 31 18 12 18-12" fill="none" stroke="#8f1150" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-2xl leading-none font-semibold italic">{APP_NAME}</span>
    </>
  )
}
