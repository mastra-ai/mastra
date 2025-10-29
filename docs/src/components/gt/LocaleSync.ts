import { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocaleSelector } from 'gt-react';

/*
This component is used to sync the locale between the Docusaurus and the
gt-react library. It is used to ensure that the translation locales match for
both the docs and site text.
*/
export function LocaleSync() {
  const { i18n } = useDocusaurusContext();
  const { locale: gtLocale, setLocale: setGtLocale } = useLocaleSelector();

  // If the Docusaurus locale is different from the gt-react locale
  // set the gt-react locale to the Docusaurus locale
  useEffect(() => {
    if (!i18n?.currentLocale) return;
    if (gtLocale === i18n.currentLocale) return;
    setGtLocale(i18n.currentLocale);
  }, [i18n?.currentLocale, gtLocale, setGtLocale]);

  return null;
}

