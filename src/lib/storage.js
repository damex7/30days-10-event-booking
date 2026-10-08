/*
  Safe wrappers around Web Storage. Every call can throw (private windows,
  blocked site data, a full quota, or saved text that isn't valid JSON), and
  a broken save should never crash the app, so every call is wrapped.
*/

const nullStore = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

// Resolved lazily: touching window.localStorage itself can throw when storage is blocked.
function safeStore(name) {
  try {
    return window[name] ?? nullStore
  } catch {
    return nullStore
  }
}

/**
 * Read and validate a saved value. Returns { status, value }:
 *  - "missing": nothing saved yet (first visit, or storage blocked)
 *  - "ok":      saved data was read and passed validation
 *  - "corrupt": something was saved but could not be used
 * validate() returns the cleaned value, or null to reject it.
 */
export function readValidated(key, validate = (v) => v, storeName = 'localStorage') {
  const store = safeStore(storeName)
  let raw
  try {
    raw = store.getItem(key)
  } catch {
    return { status: 'missing', value: undefined }
  }
  if (raw == null) return { status: 'missing', value: undefined }

  try {
    const value = validate(JSON.parse(raw))
    if (value == null) throw new Error('failed validation')
    return { status: 'ok', value }
  } catch (error) {
    console.warn(`[storage] Could not read "${key}":`, error.message)
    // Keep a copy of the broken data instead of silently overwriting it.
    try {
      store.setItem(`${key}:corrupt-backup`, raw)
    } catch {
      /* ignore */
    }
    return { status: 'corrupt', value: undefined }
  }
}

export function writeJSON(key, value, storeName = 'localStorage') {
  try {
    safeStore(storeName).setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`[storage] Could not save "${key}":`, error.message)
    return false
  }
}

export function removeKey(key, storeName = 'localStorage') {
  try {
    safeStore(storeName).removeItem(key)
  } catch {
    /* ignore */
  }
}

export const session = {
  get: (key, fallback) => {
    const { status, value } = readValidated(key, (v) => v, 'sessionStorage')
    return status === 'ok' ? value : fallback
  },
  set: (key, value) => writeJSON(key, value, 'sessionStorage'),
  remove: (key) => removeKey(key, 'sessionStorage'),
}
