import type { QueryClientConfig } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { shouldRetryQuery } from './query-utils';

export interface MastraQueryClientProviderProps {
  children: ReactNode;
  options?: QueryClientConfig;
}

export const MastraQueryClientProvider = ({ children, options }: MastraQueryClientProviderProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        ...options,
        defaultOptions: {
          ...options?.defaultOptions,
          queries: {
            retry: shouldRetryQuery,
            ...options?.defaultOptions?.queries,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
