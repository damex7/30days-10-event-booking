import { useEffect } from 'react'
import { APP_NAME, APP_TAGLINE } from '../config.js'

/** Sets the tab title ("Laugh Out Lagos · Ìpè"), so history and tabs are readable. */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} · ${APP_TAGLINE}`
  }, [title])
}
