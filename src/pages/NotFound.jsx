import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/States.jsx'
import { buttonClass } from '../components/ui/Button.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

export default function NotFound({ title = 'We couldn’t find that page', children }) {
  useDocumentTitle('Not found')
  return (
    <EmptyState
      icon="search"
      title={title}
      action={
        <Link to="/" className={buttonClass('primary')}>
          Browse events
        </Link>
      }
    >
      {children ?? <p>The link may be old, or the event may have been removed.</p>}
    </EmptyState>
  )
}
