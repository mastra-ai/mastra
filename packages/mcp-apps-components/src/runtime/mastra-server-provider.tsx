import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

export type MastraConnection = {
  baseUrl: string;
  apiPrefix?: string;
  headers?: Record<string, string>;
};

/** Points playground-ui's data hooks at the Mastra server the tool result names. */
export function MastraServerProvider({ connection, children }: { connection: MastraConnection; children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {/* The iframe runs on an opaque origin, so auth travels in `headers`, never cookies. */}
      <MastraReactProvider
        baseUrl={connection.baseUrl}
        apiPrefix={connection.apiPrefix}
        headers={connection.headers}
        credentials="omit"
      >
        {children}
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
