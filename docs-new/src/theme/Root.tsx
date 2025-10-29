import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@site/src/components/ui/sonner';
import { CookieConsent } from '@site/src/components/cookie/cookie-consent';
import { GTProvider, useLocaleSelector } from 'gt-react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import loadTranslations from '../loadTranslations';
import { LocaleSync } from '@site/src/components/gt/LocaleSync';

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
        <LocaleSync />
        <Toaster />
        <CookieConsent />
        {children}
      </QueryClientProvider>
    </GTProvider>
  );
}
