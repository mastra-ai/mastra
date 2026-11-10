import { createTool } from '@mastra/core/tools';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const UI = 'io.modelcontextprotocol/ui';
const declaresUi = { capabilities: { extensions: { [UI]: { mimeTypes: ['text/html;profile=mcp-app'] } } } };

function createAppServer(appsRequireClientSupport?: boolean) {
  return new MCPServer({
    name: 'Apps',
    version: '1.0.0',
    appsRequireClientSupport,
    legacy: 'stateless',
    appResources: { 'ui://viewer': { name: 'Viewer', html: '<h1>viewer</h1>' } },
    tools: {
      show: createTool({
        id: 'show',
        description: 'Shows a thing',
        inputSchema: z.object({}),
        outputSchema: z.object({ shown: z.boolean() }),
        mcp: { _meta: { ui: { resourceUri: 'ui://viewer' } } },
        execute: async () => ({ shown: true }),
      }),
      page: createTool({
        id: 'page',
        description: 'Pages from inside the viewer',
        inputSchema: z.object({}),
        mcp: { _meta: { ui: { visibility: ['app'] } } },
        execute: async () => 'next page',
      }),
      plain: createTool({ id: 'plain', description: 'No app', execute: async () => 'plain' }),
    },
  });
}

describe('MCP Apps gated on the client declaring the UI extension', () => {
  let served: ServedHTTP;

  beforeAll(async () => {
    served = await serveHTTP(createAppServer(true));
  });

  afterAll(async () => {
    await served.close();
  });

  it('serves apps to a client that declares the extension', async () => {
    const client = await connectClient(served.url, declaresUi);
    try {
      expect(client.getServerCapabilities()?.extensions).toEqual({ [UI]: {} });
      expect(client.getServerCapabilities()?.resources).toBeDefined();
      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(['show', 'page', 'plain']);
      expect(tools[0]?._meta).toEqual({ ui: { resourceUri: 'ui://viewer' }, 'ui/resourceUri': 'ui://viewer' });

      const shown = await client.callTool({ name: 'show', arguments: {} });
      expect(shown._meta).toMatchObject({ ui: { resourceUri: 'ui://viewer' } });
      expect(await client.callTool({ name: 'page', arguments: {} })).toMatchObject({
        content: [{ type: 'text', text: 'next page' }],
      });

      expect((await client.listResources()).resources.map(r => r.uri)).toEqual(['ui://viewer']);
      const viewer = await client.readResource({ uri: 'ui://viewer' });
      expect(viewer.contents[0]).toMatchObject({ text: '<h1>viewer</h1>', mimeType: 'text/html;profile=mcp-app' });
    } finally {
      await client.close();
    }
  });

  it('shows a client without the extension the server as if it had no apps', async () => {
    const client = await connectClient(served.url);
    try {
      expect(client.getServerCapabilities()?.extensions).toBeUndefined();
      expect(client.getServerCapabilities()?.resources).toBeUndefined();

      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(['show', 'plain']);
      expect(tools.every(t => t._meta === undefined)).toBe(true);

      const shown = await client.callTool({ name: 'show', arguments: {} });
      expect(shown.structuredContent).toEqual({ shown: true });
      expect(shown._meta).not.toHaveProperty('ui');
      expect(shown._meta).not.toHaveProperty('ui/resourceUri');
      await expect(client.callTool({ name: 'page', arguments: {} })).rejects.toThrow('Unknown tool: page');

      // The client skips methods the server does not declare; on the wire they are not found either.
      expect((await client.listResources()).resources).toEqual([]);
    } finally {
      await client.close();
    }
    for (const [method, params, name] of [
      ['resources/list', {}, undefined],
      ['resources/read', { uri: 'ui://viewer' }, 'ui://viewer'],
    ] as const) {
      const response = await rawRequest(served.url, { method, params, headers: name ? { 'mcp-name': name } : {} });
      expect(response.json().error).toMatchObject({ code: -32601 });
    }
  });

  it('serves no apps to 2025-era stateless requests, which carry no declaration after initialize', async () => {
    const client = new Client(
      { name: 'legacy', version: '1.0.0' },
      { ...declaresUi, versionNegotiation: { mode: 'legacy' } },
    );
    await client.connect(new StreamableHTTPClientTransport(served.url));
    try {
      // `initialize` itself carries the declaration.
      expect(client.getServerCapabilities()?.extensions).toEqual({ [UI]: {} });
      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(['show', 'plain']);
      expect(tools.every(t => t._meta === undefined)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

describe('MCP Apps without the client-support requirement', () => {
  let served: ServedHTTP;

  beforeAll(async () => {
    served = await serveHTTP(createAppServer());
  });

  afterAll(async () => {
    await served.close();
  });

  it('serves apps to every client', async () => {
    const client = await connectClient(served.url);
    try {
      expect(client.getServerCapabilities()?.extensions).toEqual({ [UI]: {} });
      expect((await client.listTools()).tools.map(t => t.name)).toEqual(['show', 'page', 'plain']);
      expect((await client.listResources()).resources.map(r => r.uri)).toEqual(['ui://viewer']);
    } finally {
      await client.close();
    }
  });
});
