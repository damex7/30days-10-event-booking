import { useCallback, useEffect, useState } from 'react'

/*
  Runs an async loader and tracks { status, data, error }: the small piece
  of React Query we need, written by hand so the moving parts are visible.

  - The loader gets an AbortSignal. When deps change (a new
    search term arrives) or the component unmounts, the old request is cancelled,
    so a slow old response can never overwrite a newer one.
  - retry() re-runs the loader with the same deps. Requests that already
    worked come straight from the cache, so a retry only re-asks for the
    ones that failed.
  - Pass `null` as the loader to stay idle (e.g. fewer than 2 letters typed).
*/
export function useAsync(loader, deps) {
  const [state, setState] = useState({ status: loader ? 'loading' : 'idle', data: undefined, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!loader) {
      setState({ status: 'idle', data: undefined, error: null })
      return
    }
    const controller = new AbortController()
    setState((s) => ({ status: 'loading', data: s.data, error: null })) // keep old data visible while reloading
    loader(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: null })
      },
      (error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return
        setState({ status: 'error', data: undefined, error })
      },
    )
    return () => controller.abort()
    // The caller's deps decide when to reload; `loader` is a new function every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
