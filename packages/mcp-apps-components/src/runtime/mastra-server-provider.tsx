import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { McpAppContract } from '../define-mcp-app-ui';
import { createMcpAppDataFetch } from './data-fetch';
import { useMcpApp } from './mcp-app-context';

/**
 * Points playground-ui's data hooks at the server behind the app's MCP server. Their requests
 * become the contract's reads, sent over the host's MCP connection, so the iframe never connects
 * to the server itself.
 */
export function MastraServerProvider({
  contract,
  context,
  children,
}: {
  contract: Pick<McpAppContract, 'name' | 'dataTool' | 'reads'>;
  /** Sent with each read, for the server's `prepareRequest`. */
  context: Record<string, unknown>;
  children: ReactNode;
}) {
  const app = useMcpApp();
  const [queryClient] = useState(() => new QueryClient());
  const [fetchThroughHost] = useState(() => createMcpAppDataFetch(app, { ui: contract, context }));

  return (
    <QueryClientProvider client={queryClient}>
      {/* Requests carry route paths, without the server's prefix. */}
      <MastraReactProvider apiPrefix="" customFetch={fetchThroughHost}>
        {children}
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
