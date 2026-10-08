/*
  An "Add to calendar" file (iCalendar, RFC 5545): the format Google
  Calendar, Outlook and Apple Calendar all import.
  The fiddly rules, all handled here:
    - lines end with CRLF (\r\n), not just \n;
    - times are UTC with a trailing Z (20261114T110000Z), so every calendar
      shows the right local time with no time-zone table needed;
    - commas, semicolons and backslashes in text are escaped, and new
      lines become a literal "\n";
    - no line may be longer than 75 bytes: longer ones are "folded" onto
      the next line, which starts with a space. Bytes, not characters:
      "ọ̀" is several bytes in UTF-8, so we measure with TextEncoder;
    - UID must be unique and stable: the same booking downloaded twice
      updates one calendar entry instead of adding a duplicate.
*/
const stamp = (iso) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

const escapeText = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

function fold(line) {
  const encoder = new TextEncoder()
  const parts = []
  let current = ''
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74 // continuation lines start with a space
    if (encoder.encode(current + ch).length > limit) {
      parts.push(current)
      current = ch
    } else current += ch
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function buildIcs({ uid, title, description, location, startsAt, endsAt, url }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ipe//Event booking demo//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(startsAt)}`,
    `DTEND:${stamp(endsAt)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(location)}`,
    url && `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`Tomorrow: ${title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Save text as a file: a Blob and a temporary link. No library needed. */
export function downloadFile(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
