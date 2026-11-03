import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { createMastraApiFetch } from './mastra-api-fetch';
import { useMcpApp } from './mcp-app-context';

/**
 * Points playground-ui's data hooks at the Mastra server behind the app's MCP server. Requests
 * go through its `mastraApi` tool, so the iframe never connects to the server itself.
 */
export function MastraServerProvider({ children }: { children: ReactNode }) {
  const app = useMcpApp();
  const [queryClient] = useState(() => new QueryClient());
  const [fetchThroughTool] = useState(() => createMastraApiFetch(app));

  return (
    <QueryClientProvider client={queryClient}>
      {/* The tool resolves routes under the server's own prefix. */}
      <MastraReactProvider apiPrefix="" customFetch={fetchThroughTool}>
        {children}
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
