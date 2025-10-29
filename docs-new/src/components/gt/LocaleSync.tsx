import React, { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocaleSelector } from 'gt-react';

export function LocaleSync() {
  const { i18n } = useDocusaurusContext();
  const { locale: gtLocale, setLocale: setGtLocale } = useLocaleSelector();

  useEffect(() => {
    if (!i18n?.currentLocale) return;
    if (gtLocale === i18n.currentLocale) return;
    setGtLocale(i18n.currentLocale);
  }, [i18n?.currentLocale, gtLocale, setGtLocale]);

  return null;
}

