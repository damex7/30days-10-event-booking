/*
  Read and write nested values by a dotted path, so one form can hold
  nested data and still give every field a single name:
    "buyer.email"                   values.buyer.email
    "attendees.2.answers.q_size"    values.attendees[2].answers.q_size
  setPath never mutates: it copies each object/array along the path, which
  is what React needs to notice the change.
*/
const keys = (path) => path.split('.').map((k) => (/^\d+$/.test(k) ? Number(k) : k))

export function getPath(obj, path) {
  return keys(path).reduce((value, key) => (value == null ? undefined : value[key]), obj)
}

export function setPath(obj, path, value) {
  const [key, ...rest] = keys(path)
  const current = obj ?? (typeof key === 'number' ? [] : {})
  const next = rest.length === 0 ? value : setPath(current[key], rest.join('.'), value)
  if (Array.isArray(current)) {
    const copy = [...current]
    copy[key] = next
    return copy
  }
  return { ...current, [key]: next }
}

/** A DOM id for a field: "buyer.email" → "f1-buyer-email". */
export const fieldId = (prefix, path) => `${prefix}-${path.replace(/[^\w-]/g, '-')}`
