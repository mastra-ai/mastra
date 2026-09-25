import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export const TEST_BASE_URL = 'http://localhost:4111';

/** Wraps children in the real `@mastra/client-js` + React Query provider stack. */
export const makeWrapper = ({ baseUrl = TEST_BASE_URL }: { baseUrl?: string } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={baseUrl}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return { wrapper, queryClient };
};
