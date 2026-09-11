import { Mastra } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MCPServer } from '../server';
import { connectModern, serveHTTP, textOf } from './harness';
import type { ServedHTTP } from './harness';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const initialTool = createTool({
  id: 'initialTool',
  description: 'An initial tool',
  inputSchema: z.object({}),
  execute: async () => 'initial',
});

const dynamicTool = createTool({
  id: 'dynamicTool',
  description: 'A dynamically added tool',
  inputSchema: z.object({ input: z.string().optional() }),
  execute: async () => 'dynamic',
});

describe('MCPServer dynamic tools + tools/list_changed', () => {
  let server: MCPServer;
  let served: ServedHTTP;
  let client: Awaited<ReturnType<typeof connectModern>>;
  const changes: Array<() => void> = [];
  const nextChange = () => new Promise<void>(resolve => changes.push(resolve));

  beforeAll(async () => {
    server = new MCPServer({ name: 'DynamicToolsTestServer', version: '1.0.0', tools: { initialTool } });
    served = await serveHTTP(server);
    client = await connectModern(served.url);
    client.setNotificationHandler('notifications/tools/list_changed', async () => changes.shift()?.());
    await client.listen({ toolsListChanged: true });
  });

  afterAll(async () => {
    await client.close();
    await served.close();
  });

  it('declares the tools listChanged capability', () => {
    expect(client.getServerCapabilities()?.tools?.listChanged).toBe(true);
  });

  it('adding a tool notifies the client and the new tool is listed and callable', async () => {
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(['initialTool']);
    const notified = nextChange();
    await server.toolActions.add({ dynamicTool });
    await notified;
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(['initialTool', 'dynamicTool']);
    expect(textOf(await client.callTool({ name: 'dynamicTool', arguments: { input: 'hello' } }))).toBe('dynamic');
  });

  it('lists healthy tools when one tool has no input schema', async () => {
    const schemaLessTool = createTool({
      id: 'schemaLessTool',
      description: 'No input schema',
      execute: async () => 'ok',
    });
    const notified = nextChange();
    await server.toolActions.add({ schemaLessTool });
    await notified;
    try {
      const listed = (await client.listTools()).tools;
      expect(listed.map(t => t.name)).toContain('schemaLessTool');
      expect(listed.find(t => t.name === 'schemaLessTool')?.inputSchema).toEqual({ type: 'object', properties: {} });
    } finally {
      const removed = nextChange();
      await server.toolActions.remove(['schemaLessTool']);
      await removed;
    }
  });

  it('removing a tool notifies the client and the tool is no longer listed', async () => {
    const notified = nextChange();
    await server.toolActions.remove(['dynamicTool']);
    await notified;
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(['initialTool']);
  });

  it('removing an unknown tool does not throw and does not notify', async () => {
    const notify = vi.spyOn(server.toolActions, 'notifyListChanged');
    await expect(server.toolActions.remove(['nope'])).resolves.toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps the Mastra tool registry in sync with dynamic add/remove', async () => {
    const syncTool = createTool({
      id: 'sync-tool-id',
      description: 'Verifies Mastra registry sync',
      inputSchema: z.object({}),
      execute: async () => 'sync',
    });
    const standalone = new MCPServer({ name: 'RegistrySyncTestServer', version: '1.0.0', tools: {} });
    const mastra = new Mastra({ logger: false, mcpServers: { registrySyncServer: standalone } });

    expect(mastra.listTools()['sync-tool-id']).toBeUndefined();
    await standalone.toolActions.add({ syncToolKey: syncTool });
    expect(mastra.listTools()['sync-tool-id']).toBe(syncTool);
    expect(standalone.tools().syncToolKey).toBe(syncTool);

    // MCP-side removal is by record key; the registry entry keyed by tool.id goes too.
    await standalone.toolActions.remove(['syncToolKey']);
    expect(standalone.tools()).not.toHaveProperty('syncToolKey');
    expect(mastra.listTools()['sync-tool-id']).toBeUndefined();
    await standalone.close();
  });
});
