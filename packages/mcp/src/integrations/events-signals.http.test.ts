import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MCPClient } from '../client/configuration';
import { createEventsFixture } from '../client/events/__fixtures__/events-server';
import { EVENTS_EXTENSION_ID } from '../shared/events';
import { createAgent, settle } from './__tests__/fake-events-client';
import { InMemoryMCPEventCursorStore } from './events-cursor-store';
import { MCPEventsSignalProvider } from './events-signals';

async function startEventsServer() {
  const fixture = createEventsFixture();
  const handler = toNodeHandler(
    createMcpHandler(
      () => {
        const mcpServer = new McpServer(
          { name: 'events-test-server', version: '1.0.0' },
          { capabilities: { tools: {}, extensions: { [EVENTS_EXTENSION_ID]: {} } } },
        );
        mcpServer.registerTool('noop', { description: 'noop' }, async () => ({ content: [] }));
        fixture.install(mcpServer.server);
        return mcpServer.server;
      },
      { legacy: 'reject' },
    ),
  );
  const httpServer = createServer((req, res) => void handler(req, res));
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const { port } = httpServer.address() as AddressInfo;
  return { httpServer, fixture, url: new URL(`http://127.0.0.1:${port}/mcp`) };
}

describe('MCPEventsSignalProvider with a real MCPClient over Streamable HTTP', () => {
  let httpServer: HttpServer | undefined;
  let mcp: MCPClient | undefined;
  let provider: MCPEventsSignalProvider | undefined;

  afterEach(async () => {
    provider?.stop();
    await mcp?.disconnect().catch(() => {});
    httpServer?.closeAllConnections();
    await new Promise<void>(resolve => (httpServer ? httpServer.close(() => resolve()) : resolve()));
    httpServer = mcp = provider = undefined;
  });

  it('notifies the subscribed thread only for emits matching its arguments, and persists the cursor', async () => {
    const server = await startEventsServer();
    httpServer = server.httpServer;
    mcp = new MCPClient({ id: 'events-signals-http-test', servers: { github: { url: server.url } } });
    const cursorStore = new InMemoryMCPEventCursorStore();
    provider = new MCPEventsSignalProvider({ client: mcp, cursorStore });
    const { agent, storage } = createAgent(provider);
    const send = vi.spyOn(agent, 'sendNotificationSignal');

    const thread = { resourceId: 'user-1', threadId: 'thread-1' };
    const target = { server: 'github', event: 'repo.push', args: { repo: 'a' } };
    await provider.subscribeThread(thread, target);
    expect(server.fixture.streamRequests).toHaveLength(1);

    await server.fixture.emit('repo.push', { repo: 'b' }, { sha: 'other' });
    const eventId = await server.fixture.emit('repo.push', { repo: 'a' }, { sha: 'abc' });

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![1]).toEqual(thread);
    expect(send.mock.calls[0]![0]).toMatchObject({
      kind: 'mcp-event',
      dedupeKey: `mcp-events:${MCPEventsSignalProvider.key(target)}:${eventId}`,
      payload: { occurrence: { eventId, data: { sha: 'abc' } } },
    });
    expect(send.mock.calls[0]![0].summary).toContain('"sha":"abc"');

    const notifications = await storage.getStore('notifications');
    await expect(notifications!.listNotifications({ threadId: 'thread-1' })).resolves.toHaveLength(1);
    await vi.waitFor(() => expect(cursorStore.get(MCPEventsSignalProvider.key(target))).toBeTypeOf('string'));
  });
});
