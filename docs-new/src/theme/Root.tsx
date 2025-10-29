import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@site/src/components/ui/sonner';
import { CookieConsent } from '@site/src/components/cookie/cookie-consent';
import { GTProvider, useLocaleSelector } from 'gt-react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import loadTranslations from '../loadTranslations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <GTProvider locales={['en', 'ja']} loadTranslations={loadTranslations}>
      <QueryClientProvider client={queryClient}>
        <DocusaurusToGtLocaleSync />
        <Toaster />
        <CookieConsent />
        {children}
      </QueryClientProvider>
    </GTProvider>
  );
}

// Sync locale when Docusaurus route locale changes
function DocusaurusToGtLocaleSync() {
  const { i18n } = useDocusaurusContext();
  const { locale: gtLocale, setLocale: setGtLocale } = useLocaleSelector();

  useEffect(() => {
    if (!i18n?.currentLocale) return;
    if (gtLocale === i18n.currentLocale) return;
    setGtLocale(i18n.currentLocale);
  }, [i18n?.currentLocale, gtLocale, setGtLocale]);

  return null;
}
