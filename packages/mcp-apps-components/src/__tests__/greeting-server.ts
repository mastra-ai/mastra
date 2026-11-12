import http from 'node:http';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import type { AppResources } from '@mastra/mcp';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { z } from 'zod';

export const GREETING_URI = 'ui://mastra/greeting';

/**
 * The server a host writes around the greeting app: `showGreeting` opens it for the model, and the
 * app-only `getGreeting` answers the app's fetch. Names starting with "Mallory" have no greeting.
 */
export function greetingServer(appResources: AppResources = {}) {
  return new MCPServer({
    id: 'greeting',
    name: 'Greeting',
    version: '1.0.0',
    appResources,
    tools: {
      showGreeting: createTool({
        id: 'showGreeting',
        description: 'Greets someone by name',
        inputSchema: z.object({ name: z.string() }),
        mcp: { _meta: { ui: { resourceUri: GREETING_URI } } },
        execute: async ({ name }) => ({ name }),
      }),
      getGreeting: createTool({
        id: 'getGreeting',
        description: 'Returns the greeting for a name',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        mcp: { _meta: { ui: { resourceUri: GREETING_URI, visibility: ['app'] } } },
        execute: async ({ name }) => {
          if (name.startsWith('Mallory')) throw new Error(`No greeting for ${name}`);
          return { greeting: `Hello, ${name}, from the server!` };
        },
      }),
    },
  });
}

/** Serves `mcp` over Streamable HTTP on a free port and connects a client to it, as a host does. */
export async function serveAndConnect(mcp: MCPServer) {
  const server = http.createServer(async (req, res) => {
    await mcp.startHTTP({ url: new URL(req.url ?? '', 'http://localhost'), httpPath: '/mcp', req, res });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a port');

  const client = new Client(
    { name: 'test-host', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)));
  return {
    client,
    close: async () => {
      await client.close();
      await mcp.close();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
