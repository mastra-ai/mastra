import { QueryClient, QueryClientConfig, QueryClientProvider } from '@tanstack/react-query';

export interface PlaygroundQueryClientProps {
  children: React.ReactNode;
  options?: QueryClientConfig;
}

export const PlaygroundQueryClient = ({ children, options }: PlaygroundQueryClientProps) => {
  // QueryClient is created once since this component is high in the tree and won't re-render
  const queryClient = new QueryClient(options);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export * from '@tanstack/react-query';
