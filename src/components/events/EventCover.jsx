import { useId } from 'react'
import { cx } from '../../lib/cx.js'

/*
  Generated event covers: a fabric-like pattern in one of five tones, drawn
  as SVG. No photos means nothing to upload, nothing that can 404, and
  every organiser gets a cover that fits the palette. The organiser picks
  the pattern and tone in the event form.

  Covers are decoration (the title is right below), so they're hidden from
  screen readers. Pattern ids come from useId(): two covers on one page
  each need their own <pattern id>.
*/
export const TONES = {
  magenta: { bg: '#8f1150', fg: '#e2ad2f', soft: '#fbe1ec' },
  gold: { bg: '#d99a1b', fg: '#6e0c3d', soft: '#fff6ec' },
  teal: { bg: '#0d6e68', fg: '#f0c04a', soft: '#d5eeea' },
  coral: { bg: '#d9512c', fg: '#2a1520', soft: '#ffd9c7' },
  plum: { bg: '#3d0f27', fg: '#f0c04a', soft: '#ff6aae' },
}

export const PATTERN_LABELS = {
  lace: 'Lace',
  gele: 'Gele folds',
  grid: 'Grid',
  waves: 'Waves',
  rays: 'Sunburst',
  dots: 'Polka dots',
}

function Tile({ pattern, fg, soft }) {
  switch (pattern) {
    case 'lace':
      return (
        <>
          <circle cx="12" cy="12" r="7" fill="none" stroke={fg} strokeWidth="1.6" opacity="0.7" />
          <circle cx="12" cy="12" r="2" fill={soft} opacity="0.7" />
          <circle cx="0" cy="0" r="3" fill="none" stroke={soft} strokeWidth="1" opacity="0.5" />
          <circle cx="24" cy="24" r="3" fill="none" stroke={soft} strokeWidth="1" opacity="0.5" />
        </>
      )
    case 'gele':
      return (
        <>
          <path d="M0 24 24 0" stroke={fg} strokeWidth="7" opacity="0.55" />
          <path d="M-6 18 18 -6M6 30 30 6" stroke={soft} strokeWidth="2" opacity="0.35" />
        </>
      )
    case 'grid':
      return (
        <>
          <path d="M0 0H24M0 0V24" stroke={soft} strokeWidth="1" opacity="0.35" />
          <rect x="9" y="9" width="6" height="6" fill={fg} opacity="0.7" transform="rotate(45 12 12)" />
        </>
      )
    case 'waves':
      return <path d="M0 12c6-8 6 8 12 0s6 8 12 0" fill="none" stroke={fg} strokeWidth="2.4" opacity="0.65" />
    case 'dots':
      return (
        <>
          <circle cx="6" cy="6" r="4" fill={fg} opacity="0.7" />
          <circle cx="18" cy="18" r="4" fill={soft} opacity="0.45" />
        </>
      )
    default:
      return null
  }
}

/* Sunburst: wedges fanning out from below the bottom edge, like a stage light. */
function Rays({ fg }) {
  const wedges = Array.from({ length: 18 }, (_, i) => {
    const a = (Math.PI * (i + 0.5)) / 18 + Math.PI
    const b = (Math.PI * (i + 1)) / 18 + Math.PI
    const r = 500
    return `M200 260L${200 + r * Math.cos(a)} ${260 + r * Math.sin(a)}L${200 + r * Math.cos(b)} ${260 + r * Math.sin(b)}Z`
  })
  return <path d={wedges.join('')} fill={fg} opacity="0.35" />
}

export function EventCover({ cover, className, children }) {
  const id = useId()
  const tone = TONES[cover?.tone] ?? TONES.magenta
  const pattern = cover?.pattern ?? 'lace'
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ backgroundColor: tone.bg }}>
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`${id}p`} width="24" height="24" patternUnits="userSpaceOnUse">
            <Tile pattern={pattern} fg={tone.fg} soft={tone.soft} />
          </pattern>
          <radialGradient id={`${id}g`} cx="0.8" cy="0.1" r="0.9">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#000" stopOpacity="0.18" />
          </radialGradient>
        </defs>
        {pattern === 'rays' ? <Rays fg={tone.fg} /> : <rect width="400" height="225" fill={`url(#${id}p)`} />}
        <rect width="400" height="225" fill={`url(#${id}g)`} />
      </svg>
      {children}
    </div>
  )
}
