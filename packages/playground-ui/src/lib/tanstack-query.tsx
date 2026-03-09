import { QueryClient, QueryClientConfig, QueryClientProvider } from '@tanstack/react-query';
import { shouldRetryQuery } from './query-utils';

export interface PlaygroundQueryClientProps {
  children: React.ReactNode;
  options?: QueryClientConfig;
}

export const PlaygroundQueryClient = ({ children, options }: PlaygroundQueryClientProps) => {
  const queryClient = new QueryClient({
    ...options,
    defaultOptions: {
      ...options?.defaultOptions,
      queries: {
        retry: shouldRetryQuery,
        ...options?.defaultOptions?.queries,
      },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export * from '@tanstack/react-query';
