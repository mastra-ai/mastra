import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { getRequestListener } from '@hono/node-server';
import type { Mastra } from '@mastra/core/mastra';
import { createMCPTransportTestSuite } from '@mastra/server-adapters-test-suite';
import { describe } from 'vitest';
import { createStartRouteHandler } from '../index';

describe('TanStack Start MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'TanStack Start Adapter',
    createServer: async (mastra: Mastra) => {
      const handlers = createStartRouteHandler({ mastra, prefix: '/api' });
      const server = createServer(
        getRequestListener(request => handlers[request.method as keyof typeof handlers]({ request, params: {} })),
      );
      await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));
      return { server, port: (server.address() as AddressInfo).port };
    },
  });
});
