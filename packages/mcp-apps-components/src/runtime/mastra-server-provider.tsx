import { MastraReactProvider } from '@mastra/react';
import type { App } from '@modelcontextprotocol/ext-apps';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMcpApp } from './mcp-app-context';

/**
 * Points playground-ui's data hooks at the server behind the app's MCP server. `createFetch` sends
 * their requests over the host's MCP connection, so the iframe never connects to the server itself.
 */
export function MastraServerProvider({
  createFetch,
  children,
}: {
  createFetch: (app: App) => typeof fetch;
  children: ReactNode;
}) {
  const app = useMcpApp();
  const [queryClient] = useState(() => new QueryClient());
  const [fetchThroughHost] = useState(() => createFetch(app));

  return (
    <QueryClientProvider client={queryClient}>
      {/* Requests carry route paths, without the server's prefix. */}
      <MastraReactProvider apiPrefix="" customFetch={fetchThroughHost}>
        {children}
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
