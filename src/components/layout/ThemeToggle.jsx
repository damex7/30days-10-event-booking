import { useTheme } from '../../hooks/useTheme.js'
import { Icon } from '../ui/Icon.jsx'

/* A toggle button: aria-pressed tells screen readers whether dark mode is on. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      className="grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10"
    >
      <Icon name={dark ? 'moon' : 'sun'} />
      <span className="sr-only">Dark mode</span>
    </button>
  )
}
