import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { ConsoleLogger } from '@mastra/core/logger';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MCPClient } from './configuration.js';

/**
 * `listTools()` keys each tool as `${serverName}_${toolName}`. Server names and
 * tool names can both contain `_`, so server `local` with tool `x_status` and
 * server `local_x` with tool `status` both produce `local_x_status`, and one
 * tool replaced the other silently (#29360). The client now logs a warning
 * naming both server/tool pairs. Which tool wins is unchanged: the server
 * listed later in `servers`.
 */
describe('MCPClient namespaced tool key collisions (#29360)', () => {
  const httpServers: HttpServer[] = [];
  let mcp: MCPClient | undefined;

  async function serveTool(toolName: string, description: string): Promise<URL> {
    const mcpServer = new McpServer({ name: `${toolName}-server`, version: '1.0.0' }, { capabilities: { tools: {} } });
    mcpServer.registerTool(toolName, { description, inputSchema: { q: z.string().optional() } }, async () => ({
      content: [{ type: 'text', text: description }],
    }));
    const handler = toNodeHandler(createMcpHandler(() => mcpServer.server, { legacy: 'reject' }));
    const httpServer = createServer((req, res) => handler(req, res));
    httpServers.push(httpServer);
    return new Promise<URL>((resolve, reject) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const address = httpServer.address();
        if (address === null || typeof address === 'string') {
          reject(new Error(`Expected a TCP address, got ${String(address)}`));
          return;
        }
        resolve(new URL(`http://127.0.0.1:${address.port}/mcp`));
      });
    });
  }

  let localUrl: URL;
  let localXUrl: URL;
  let ticketsUrl: URL;

  beforeAll(async () => {
    localUrl = await serveTool('x_status', 'Status of x on the local server');
    localXUrl = await serveTool('status', 'Status on the local_x server');
    ticketsUrl = await serveTool('status', 'Status of the ticket queue');
  });

  afterEach(async () => {
    await mcp?.disconnect().catch(() => {});
    mcp = undefined;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    for (const httpServer of httpServers) httpServer.close();
  });

  function clientWithWarnSpy(servers: Record<string, URL>) {
    mcp = new MCPClient({
      id: `collisions-${Object.keys(servers).join('-')}`,
      servers: Object.fromEntries(Object.entries(servers).map(([name, url]) => [name, { url }])),
    });
    // `__setLogger` stores a `child()` of the logger, so spy on the class to see what the client logs.
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(() => {});
    mcp.__setLogger(new ConsoleLogger({ name: 'test', level: 'warn' }));
    return { client: mcp, warn };
  }

  function collisionWarnings(warn: ReturnType<typeof vi.spyOn>) {
    return warn.mock.calls.filter(([message]) => typeof message === 'string' && message.includes('local_x_status'));
  }

  it('warns, naming both servers and tools, when `local`/`x_status` and `local_x`/`status` collide', async () => {
    const { client, warn } = clientWithWarnSpy({ local: localUrl, local_x: localXUrl });

    const tools = await client.listTools();

    const warnings = collisionWarnings(warn);
    expect(warnings).toHaveLength(1);
    const [message, context] = warnings[0]!;
    expect(message).toContain('local');
    expect(message).toContain('x_status');
    expect(message).toContain('local_x');
    expect(context).toMatchObject({
      key: 'local_x_status',
      replaced: { serverName: 'local', toolName: 'x_status' },
      replacedBy: { serverName: 'local_x', toolName: 'status' },
    });

    // Behavior is unchanged: the server listed later keeps the key.
    expect(Object.keys(tools)).toEqual(['local_x_status']);
    expect(tools.local_x_status?.description).toBe('Status on the local_x server');
  });

  it('warns the same way when rebuilding a cached catalog with toolsFromDefinitions()', async () => {
    const { client, warn } = clientWithWarnSpy({ local: localUrl, local_x: localXUrl });
    const definitions = await client.listToolDefinitions();
    warn.mockClear();

    const tools = await client.toolsFromDefinitions({ definitions });

    expect(collisionWarnings(warn)).toHaveLength(1);
    expect(Object.keys(tools)).toEqual(['local_x_status']);
    expect(tools.local_x_status?.description).toBe('Status on the local_x server');
  });

  it('does not warn when two servers expose the same tool name under different server names', async () => {
    const { client, warn } = clientWithWarnSpy({ local_x: localXUrl, tickets: ticketsUrl });

    const tools = await client.listTools();

    expect(warn).not.toHaveBeenCalled();
    expect(Object.keys(tools).sort()).toEqual(['local_x_status', 'tickets_status']);
  });
});
