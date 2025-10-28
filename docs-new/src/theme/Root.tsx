import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@site/src/components/ui/sonner';
import { CookieConsent } from '@site/src/components/cookie/cookie-consent';
import { GTProvider, LocaleSelector } from 'gt-react';
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
        <LocaleSelector />
        <Toaster />
        <CookieConsent />
        {children}
      </QueryClientProvider>
    </GTProvider>
  );
}
