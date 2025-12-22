import { QueryClient, QueryClientConfig, QueryClientProvider } from '@tanstack/react-query';

export interface PlaygroundQueryClientProps {
  children: React.ReactNode;
  options?: QueryClientConfig;
}

export const PlaygroundQueryClient = ({ children, options }: PlaygroundQueryClientProps) => {
  const queryClient = new QueryClient(options);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export * from '@tanstack/react-query';
