import { useState } from 'react';
import { QueryClient, QueryClientConfig, QueryClientProvider } from '@tanstack/react-query';

export interface PlaygroundQueryClientProps {
  children: React.ReactNode;
  options?: QueryClientConfig;
}

export const PlaygroundQueryClient = ({ children, options }: PlaygroundQueryClientProps) => {
  // Use useState to ensure QueryClient is only created once per component instance
  const [queryClient] = useState(() => new QueryClient(options));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export * from '@tanstack/react-query';
