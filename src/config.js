/*
  App-wide settings and the fixed lists the forms choose from.
  Everything an organiser or guest picks from a list lives here, so the
  forms, the filters and the saved-data checks all agree on what's allowed.
*/
export const APP_NAME = 'Ìpè'
export const APP_TAGLINE = 'Your invitation to the best events in Naija'

/** Prefix for every localStorage key, so this app never collides with another on localhost. */
export const STORAGE_PREFIX = 'ipe'

export const CITIES = ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt', 'Enugu', 'Kano', 'Benin City', 'Abeokuta', 'Jos', 'Uyo']

export const CATEGORIES = [
  { id: 'wedding', label: 'Owambe & weddings' },
  { id: 'tech', label: 'Tech & meetups' },
  { id: 'music', label: 'Concerts & music' },
  { id: 'faith', label: 'Church & faith' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'community', label: 'Community & workshops' },
]
export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id

/* Generated covers: a pattern drawn in SVG, in one of the palette tones. */
export const COVER_PATTERNS = ['lace', 'gele', 'grid', 'waves', 'rays', 'dots']
export const COVER_TONES = ['magenta', 'gold', 'teal', 'coral', 'plum']

/** Limits the organiser can't go beyond (and the booking form respects). */
export const LIMITS = {
  maxPerBooking: 20, // the highest "per person" limit an organiser may set
  ticketQuantity: 10000,
  ticketTypes: 8,
  questions: 20,
  options: 20,
  priceNaira: 10_000_000,
}
