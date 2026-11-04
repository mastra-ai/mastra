import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMcpApp } from './mcp-app-context';
import { createRequestToolFetch } from './request-tool-fetch';

/**
 * Points playground-ui's data hooks at the Mastra server behind the app's MCP server. Requests
 * go through its app-only request tool, so the iframe never connects to the server itself.
 */
export function MastraServerProvider({ children }: { children: ReactNode }) {
  const app = useMcpApp();
  const [queryClient] = useState(() => new QueryClient());
  const [fetchThroughTool] = useState(() => createRequestToolFetch(app));

  return (
    <QueryClientProvider client={queryClient}>
      {/* The tool gets route paths, without the server's prefix. */}
      <MastraReactProvider apiPrefix="" customFetch={fetchThroughTool}>
        {children}
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
