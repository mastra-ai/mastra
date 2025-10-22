import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@site/src/components/ui/sonner';
import { CookieConsent } from '@site/src/components/cookie/cookie-consent';

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
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <CookieConsent />
      {children}
    </QueryClientProvider>
  );
}
