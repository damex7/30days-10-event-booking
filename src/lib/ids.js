/*
  Ids, booking references and slugs.
  crypto.getRandomValues gives unpredictable values. Booking references
  are what people read out on the phone or at the gate, so they skip
  look-alike characters (0/O, 1/I/L) and are grouped: IPE-7KQ3HX.
*/
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomString(length, alphabet) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** "tkt_k3x9q2" style ids for tickets, questions, options and bookings. */
export const newId = (prefix) => `${prefix}_${randomString(8, ID_ALPHABET)}`

export const BOOKING_REFERENCE = /^IPE-[2-9A-HJKMNP-Z]{6}$/
export const newReference = () => `IPE-${randomString(6, REF_ALPHABET)}`

/*
  "Tolú & Dàyọ̀'s Owambe!" → "tolu-and-dayos-owambe".
  NFD splits "ọ̀" into "o" + combining marks, which we then drop, so Yoruba
  names still give readable URLs.
*/
export function slugify(text) {
  return (
    String(text ?? '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'event'
  )
}

/** A slug no other event uses: "lagos-js-meetup", then "lagos-js-meetup-2"... */
export function uniqueSlug(base, taken) {
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}
