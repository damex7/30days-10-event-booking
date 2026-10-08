import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/layout/Layout.jsx'
import Events from './pages/Events.jsx'
import NotFound from './pages/NotFound.jsx'

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
      { path: '*', element: <NotFound /> },
    ],
  },
])
