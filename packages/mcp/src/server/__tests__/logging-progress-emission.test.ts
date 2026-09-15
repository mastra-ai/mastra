import http from 'node:http';
import type { ToolsInput } from '@mastra/core/agent';
import getPort from 'get-port';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { z } from 'zod/v3';
import type { LogMessage } from '../../client/client';
import { InternalMastraMCPClient } from '../../client/client';
import { MCPServer } from '../server';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const listenOnFreePort = async (server: http.Server): Promise<number> => {
  const port = await getPort();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });
  return port;
};

const waitFor = async (predicate: () => boolean, timeoutMs = 10000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  expect(predicate()).toBe(true);
};

describe('MCPServer logging and progress emission', () => {
  let server: MCPServer;
  let httpServer: http.Server;

  const tools: ToolsInput = {
    loggingTool: {
      description: 'A tool that emits log messages at multiple levels',
      parameters: z.object({}),
      execute: async (_args: any, options: any) => {
        await options.mcp.log('debug', 'debug message');
        await options.mcp.log('info', 'info message');
        await options.mcp.log('error', 'error message', { code: 42 });
        return { result: 'logged' };
      },
    },
    progressTool: {
      description: 'A tool that emits progress notifications',
      parameters: z.object({}),
      execute: async (_args: any, options: any) => {
        await options.mcp.progress({ progress: 1, total: 3, message: 'step 1' });
        await options.mcp.progress({ progress: 2, total: 3, message: 'step 2' });
        await options.mcp.progress({ progress: 3, total: 3, message: 'done' });
        return { result: 'progressed' };
      },
    },
  };

  const createClient = async (options?: { enableProgressTracking?: boolean; onLog?: (log: LogMessage) => void }) => {
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const client = new InternalMastraMCPClient({
      name: 'logging-progress-test-client',
      server: {
        url: new URL(`http://localhost:${port}/mcp`),
        enableServerLogs: true,
        enableProgressTracking: options?.enableProgressTracking ?? false,
        logger: options?.onLog ?? (() => {}),
      },
    });
    await client.connect();
    return client;
  };

  beforeAll(async () => {
    server = new MCPServer({
      name: 'LoggingProgressTestServer',
      version: '1.0.0',
      tools,
    });

    let port = 0;
    httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      await server.startHTTP({
        url,
        httpPath: '/mcp',
        req,
        res,
      });
    });
    port = await listenOnFreePort(httpServer);
  });

  afterAll(async () => {
    httpServer?.closeAllConnections?.();
    if (httpServer) {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    await server?.close();
  });

  describe('tool-emitted logs (mcp.log)', () => {
    it('are delivered to the calling client log handler', async () => {
      const logs: LogMessage[] = [];
      const client = await createClient({ onLog: log => logs.push(log) });

      try {
        const clientTools = await client.tools();
        await (clientTools['loggingTool']!.execute as any)({});

        await waitFor(() => logs.some(l => l.details?.data?.message === 'error message'));
        const serverLogs = logs.filter(l => l.details?.data?.message !== undefined);
        expect(serverLogs.map(l => l.level)).toEqual(['debug', 'info', 'error']);
        expect(serverLogs[2]!.details?.data?.code).toBe(42);
        expect(serverLogs[2]!.details?.logger).toBe('LoggingProgressTestServer');
      } finally {
        await client.disconnect();
      }
    });

    it('honors the minimum level set via logging/setLevel', async () => {
      const logs: LogMessage[] = [];
      const client = await createClient({ onLog: log => logs.push(log) });

      try {
        // Set minimum level to 'error': debug and info must be dropped
        await (client as any)['client'].setLoggingLevel('error');

        const clientTools = await client.tools();
        await (clientTools['loggingTool']!.execute as any)({});

        await waitFor(() => logs.some(l => l.details?.data?.message === 'error message'));
        const serverLogs = logs.filter(l => l.details?.data?.message !== undefined);
        expect(serverLogs.map(l => l.level)).toEqual(['error']);
      } finally {
        await client.disconnect();
      }
    });
  });

  describe('server-level logs (server.sendLoggingMessage)', () => {
    it('broadcasts to connected clients honoring their minimum level', async () => {
      const logs: LogMessage[] = [];
      const client = await createClient({ onLog: log => logs.push(log) });

      try {
        await (client as any)['client'].setLoggingLevel('warning');

        // Below minimum level: skipped entirely (no eligible clients)
        await server.sendLoggingMessage({ level: 'info', data: { message: 'not delivered' } });
        // At/above minimum level: delivered
        await server.sendLoggingMessage({ level: 'error', data: { message: 'delivered' } });

        await waitFor(() => logs.some(l => l.details?.data?.message === 'delivered'));
        expect(logs.some(l => l.details?.data?.message === 'not delivered')).toBe(false);
      } finally {
        await client.disconnect();
      }
    });
  });

  describe('tool-emitted progress (mcp.progress)', () => {
    it('is delivered to the calling client with its progress token', async () => {
      const client = await createClient({ enableProgressTracking: true });
      const received: any[] = [];
      client.setProgressNotificationHandler(params => received.push(params));

      try {
        const clientTools = await client.tools();
        await (clientTools['progressTool']!.execute as any)({});

        await waitFor(() => received.length >= 3);
        expect(received.map(p => p.progress)).toEqual([1, 2, 3]);
        expect(received[0].total).toBe(3);
        expect(received[0].message).toBe('step 1');
        expect(received[0].progressToken).toBeDefined();
      } finally {
        await client.disconnect();
      }
    });

    it('is a no-op when the caller sent no progress token', async () => {
      const client = await createClient({ enableProgressTracking: false });
      const received: any[] = [];
      client.setProgressNotificationHandler(params => received.push(params));

      try {
        const clientTools = await client.tools();
        const result = await (clientTools['progressTool']!.execute as any)({});
        expect(result.isError).toBeFalsy();

        // Give any stray notifications a moment to arrive
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(received).toHaveLength(0);
      } finally {
        await client.disconnect();
      }
    });
  });
});
