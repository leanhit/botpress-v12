import { lang } from 'botpress/shared'

import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import vi from './vi.json'

const translations = { en, fr, es, vi }

const initializeTranslations = () => {
  lang.extend(translations)
  lang.init()
}

export { initializeTranslations }
