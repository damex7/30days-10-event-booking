import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

export default function Events() {
  useDocumentTitle()
  return <h1 className="font-display text-4xl font-semibold">Events</h1>
}
