import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './en.json';
import zhCN from './zh-CN.json';

const NS = 'playground-ui';

const initPromise = i18next.use(initReactI18next).init({
  resources: {
    en: { [NS]: en },
    'zh-CN': { [NS]: zhCN },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: NS,
  ns: [NS],
  interpolation: { escapeValue: false },
});

export async function initI18n(locale: string = 'en') {
  await initPromise;
  await i18next.changeLanguage(locale);
}

export function useI18n() {
  return useTranslation(NS);
}

export { I18nextProvider as I18nProvider } from 'react-i18next';
