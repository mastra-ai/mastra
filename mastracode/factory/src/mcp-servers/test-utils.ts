/** Real MCP servers on loopback for Factory MCP server tests. Not bundled (see tsdown.config.ts). */

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { onTestFinished } from 'vitest';
import { z } from 'zod';

export interface TestMcpServerCall {
  tool: 'echo' | 'add';
  args: unknown;
}

export interface TestMcpServer {
  /** Streamable HTTP endpoint, e.g. `http://127.0.0.1:51234/mcp`. */
  url: string;
  host: string;
  /** Every tool invocation the server executed, in order. */
  calls: TestMcpServerCall[];
  /** JSON-RPC methods received, in order (`server/discover`, `tools/list`, `tools/call`, ...). */
  methods: string[];
  close(): Promise<void>;
}

/**
 * Starts a real `@mastra/mcp` server over Streamable HTTP on `127.0.0.1:0` with
 * `echo` and `add` tools. With `bearerToken`, requests without
 * `Authorization: Bearer <token>` get a 401. Closed when the test finishes.
 */
export async function startTestMcpServer({ bearerToken }: { bearerToken?: string } = {}): Promise<TestMcpServer> {
  const calls: TestMcpServerCall[] = [];
  const methods: string[] = [];
  const mcp = new MCPServer({
    id: `factory-mcp-test-${randomUUID()}`,
    name: 'Factory MCP test server',
    version: '1.0.0',
    tools: {
      echo: createTool({
        id: 'echo',
        description: 'Echo text back.',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => {
          calls.push({ tool: 'echo', args: { text } });
          return { text };
        },
      }),
      add: createTool({
        id: 'add',
        description: 'Add two numbers.',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => {
          calls.push({ tool: 'add', args: { a, b } });
          return { sum: a + b };
        },
      }),
    },
  });

  let origin = '';
  const http = createServer(async (req, res) => {
    if (bearerToken && req.headers.authorization !== `Bearer ${bearerToken}`) {
      res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks).toString('utf8');
      for (const message of [JSON.parse(body)].flat()) {
        if (typeof message?.method === 'string') methods.push(message.method);
      }
      // startHTTP reads the body from the request; hand it the parsed copy.
      (req as typeof req & { body?: unknown }).body = JSON.parse(body);
    }
    await mcp.startHTTP({ url: new URL(req.url ?? '/', origin), httpPath: '/mcp', req, res });
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const { port } = http.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;

  const close = async () => {
    http.closeAllConnections();
    await new Promise<void>(resolve => http.close(() => resolve()));
    await mcp.close();
  };
  onTestFinished(close);
  return { url: `${origin}/mcp`, host: `127.0.0.1:${port}`, calls, methods, close };
}
