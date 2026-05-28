import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './en.json';
import zhCN from './zh-CN.json';

const NS = 'playground-ui';

const initPromise = i18next.use(initReactI18next)
  .init({
    resources: {
      en: { [NS]: en },
      'zh-CN': { [NS]: zhCN },
    },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: NS,
    ns: [NS],
    interpolation: { escapeValue: false },
  })
  .catch((error: unknown) => {
    console.error('[playground-ui] Failed to initialize i18n:', error);
  });

/**
 * Initializes the i18n system with the specified locale.
 * Call before rendering if you want a non-default language.
 *
 * @param locale - The locale code (e.g., 'en', 'zh-CN'). Defaults to 'en'.
 * @returns A promise that resolves when initialization and language change complete.
 *
 * @example
 * ```tsx
 * await initI18n('zh-CN');
 * ```
 */
export async function initI18n(locale: string = 'en') {
  await initPromise;
  await i18next.changeLanguage(locale);
}

/**
 * Hook to access translation functions for the playground-ui namespace.
 * Can be used immediately; initialization starts at module import time.
 *
 * @returns An object containing the translation function `t` and i18n instance.
 *
 * @example
 * ```tsx
 * const { t } = useI18n();
 * return <button>{t('ds.button.submit')}</button>;
 * ```
 */
export function useI18n() {
  return useTranslation(NS);
}

export { I18nextProvider as I18nProvider } from 'react-i18next';
