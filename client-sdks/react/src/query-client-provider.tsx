import { QueryClient, QueryClientProvider as QCProvider, isServer, QueryClientConfig } from '@tanstack/react-query';

function makeQueryClient(config?: QueryClientConfig) {
  const defaultConfig = {
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  };
  return new QueryClient(config || defaultConfig);
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(config?: QueryClientConfig) {
  if (isServer) {
    return makeQueryClient(config);
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient(config);
    return browserQueryClient;
  }
}

export interface QueryClientProviderProps {
  children: React.ReactNode;
  config?: QueryClientConfig;
}

export const QueryClientProvider = ({ children, config }: QueryClientProviderProps) => {
  return <QCProvider client={new QueryClient()}>{children}</QCProvider>;
};
