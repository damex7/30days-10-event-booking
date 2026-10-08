import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/layout/Layout.jsx'
import Book from './pages/Book.jsx'
import Confirmation from './pages/Confirmation.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EventEditor from './pages/EventEditor.jsx'
import EventPage from './pages/EventPage.jsx'
import Events from './pages/Events.jsx'
import NotFound from './pages/NotFound.jsx'
import OrganiseHome from './pages/OrganiseHome.jsx'
import PrintTicket from './pages/PrintTicket.jsx'

/*
  A "data router" (createBrowserRouter) rather than <BrowserRouter>. We
  don't use its loaders; we need it because useBlocker, which powers the
  "leave with unsaved changes?" warning on the forms, only works with one.
*/
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Events /> },
      { path: '/events/:slug', element: <EventPage /> },
      { path: '/events/:slug/book', element: <Book /> },
      { path: '/bookings/:reference', element: <Confirmation /> },
      { path: '/bookings/:reference/ticket', element: <PrintTicket /> },
      { path: '/organise', element: <OrganiseHome /> },
      { path: '/organise/new', element: <EventEditor /> },
      { path: '/organise/:id', element: <Dashboard /> },
      { path: '/organise/:id/edit', element: <EventEditor /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
