import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMcpApp } from './mcp-app-context';
import { createObservabilityFetch } from './observability-fetch';

/**
 * Points playground-ui's data hooks at the Mastra server behind the app's MCP server. Requests
 * go through its app-only observability tools, so the iframe never connects to the server itself.
 */
export function MastraServerProvider({ children }: { children: ReactNode }) {
  const app = useMcpApp();
  const [queryClient] = useState(() => new QueryClient());
  const [fetchThroughTool] = useState(() => createObservabilityFetch(app));

  return (
    <QueryClientProvider client={queryClient}>
      {/* Tools are picked by route path, without the server's prefix. */}
      <MastraReactProvider apiPrefix="" customFetch={fetchThroughTool}>
        {children}
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
