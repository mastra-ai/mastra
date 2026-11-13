import { createTool } from '@mastra/core/tools';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TaskRequester } from '../client/tasks/requester';
import { tasksCapabilityEntry } from '../shared/tasks';
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

  it('serves apps to a 2025-era client that declared the extension at initialize', async () => {
    const client = new Client(
      { name: 'legacy', version: '1.0.0' },
      { ...declaresUi, versionNegotiation: { mode: 'legacy' } },
    );
    const transport = new StreamableHTTPClientTransport(served.url);
    await client.connect(transport);
    try {
      expect(client.getServerCapabilities()?.extensions).toEqual({ [UI]: {} });
      // Stateless HTTP keeps nothing between requests; the session id the client echoes carries the declaration.
      expect(transport.sessionId).toMatch(/^mcp-apps\./);

      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(['show', 'page', 'plain']);
      expect(tools[0]?._meta).toMatchObject({ ui: { resourceUri: 'ui://viewer' } });
      expect((await client.callTool({ name: 'show', arguments: {} }))._meta).toMatchObject({
        ui: { resourceUri: 'ui://viewer' },
      });
      expect(await client.callTool({ name: 'page', arguments: {} })).toMatchObject({
        content: [{ type: 'text', text: 'next page' }],
      });
      const viewer = await client.readResource({ uri: 'ui://viewer' });
      expect(viewer.contents[0]).toMatchObject({ text: '<h1>viewer</h1>' });
    } finally {
      await client.close();
    }
  });

  it('keeps a 2025-era client without the extension sessionless and without apps', async () => {
    const client = new Client({ name: 'legacy', version: '1.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    const transport = new StreamableHTTPClientTransport(served.url);
    await client.connect(transport);
    try {
      expect(transport.sessionId).toBeUndefined();
      expect(client.getServerCapabilities()?.extensions).toBeUndefined();
      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(['show', 'plain']);
      expect(tools.every(t => t._meta === undefined)).toBe(true);
      await expect(client.callTool({ name: 'page', arguments: {} })).rejects.toThrow('Unknown tool: page');
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

describe('tool result transform told whether the caller is served apps', () => {
  let served: ServedHTTP;
  const seen: boolean[] = [];

  beforeAll(async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: `row-${i}`, detail: 'x'.repeat(200) }));
    served = await serveHTTP(
      new MCPServer({
        name: 'Apps',
        version: '1.0.0',
        appsRequireClientSupport: true,
        legacy: 'stateless',
        appResources: { 'ui://viewer': { name: 'Viewer', html: '<h1>viewer</h1>' } },
        toolResult: {
          // The app renders every row; the model only needs a summary of them.
          transform: ({ output, result, apps }) => {
            seen.push(apps);
            if (!apps) return undefined;
            const { rows: all } = output as { rows: { id: string }[] };
            return {
              ...result,
              structuredContent: output as Record<string, unknown>,
              content: [{ type: 'text', text: `${all.length} rows, shown in the viewer.` }],
            };
          },
        },
        tools: {
          list: createTool({
            id: 'list',
            description: 'Lists rows',
            inputSchema: z.object({}),
            mcp: { _meta: { ui: { resourceUri: 'ui://viewer' } } },
            execute: async () => ({ rows }),
          }),
        },
      }),
    );
  });

  afterAll(async () => {
    await served.close();
  });

  beforeEach(() => {
    seen.length = 0;
  });

  it('lets an app caller send the model a summary and the app the full output', async () => {
    const client = await connectClient(served.url, declaresUi);
    try {
      const result = await client.callTool({ name: 'list', arguments: {} });
      expect(result.content).toEqual([{ type: 'text', text: '50 rows, shown in the viewer.' }]);
      expect((result.structuredContent as { rows: unknown[] }).rows).toHaveLength(50);
      expect(result._meta).toMatchObject({ ui: { resourceUri: 'ui://viewer' } });
      expect(seen).toEqual([true]);
    } finally {
      await client.close();
    }
  });

  it('keeps the full output for a caller without apps', async () => {
    const client = await connectClient(served.url);
    try {
      const result = await client.callTool({ name: 'list', arguments: {} });
      expect(result.structuredContent).toBeUndefined();
      const [block] = result.content as { type: string; text: string }[];
      expect(JSON.parse(block!.text).rows).toHaveLength(50);
      expect(seen).toEqual([false]);
    } finally {
      await client.close();
    }
  });
});

describe('tool task results', () => {
  let served: ServedHTTP;
  const clients: Client[] = [];

  beforeAll(async () => {
    served = await serveHTTP(
      new MCPServer({
        name: 'Apps',
        version: '1.0.0',
        appsRequireClientSupport: true,
        appResources: { 'ui://viewer': { name: 'Viewer', html: '<h1>viewer</h1>' } },
        tasks: { tools: { list: 'always' } },
        tools: {
          list: createTool({
            id: 'list',
            description: 'Lists rows',
            inputSchema: z.object({}),
            mcp: { _meta: { ui: { resourceUri: 'ui://viewer' } } },
            execute: async () => ({ rows: [] }),
          }),
        },
      }),
    );
  });

  afterAll(async () => {
    await Promise.all(clients.map(client => client.close()));
    await served.close();
  });

  /** Calls `list` as a task, as a client declaring Tasks (and the UI extension, with `ui`), and reads its result. */
  async function taskResult(ui: boolean) {
    const extensions = { ...tasksCapabilityEntry(), ...(ui ? declaresUi.capabilities.extensions : {}) };
    const response = await rawRequest(served.url, {
      method: 'tools/call',
      params: { name: 'list', arguments: {} },
      capabilities: { extensions },
      headers: { 'mcp-name': 'list' },
    });
    const { result } = await response.json();
    expect(result).toMatchObject({ resultType: 'task' });
    const client = await connectClient(served.url);
    clients.push(client);
    const tasks = new TaskRequester(client);
    for (let i = 0; i < 200; i++) {
      const task = await tasks.get(result.taskId);
      if (task.status === 'completed') return task.result as { _meta?: Record<string, unknown> };
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('task never completed');
  }

  it("keeps the app link for a caller that renders apps and drops it for one that doesn't", async () => {
    expect((await taskResult(true))._meta).toMatchObject({ ui: { resourceUri: 'ui://viewer' } });
    expect((await taskResult(false))._meta?.ui).toBeUndefined();
  });
});
