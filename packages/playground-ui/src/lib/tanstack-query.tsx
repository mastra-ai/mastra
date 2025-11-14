import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const PlaygroundQueryClient = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export * from '@tanstack/react-query';
