import http from 'node:http';
import type { Prompt } from '@modelcontextprotocol/server';
import getPort from 'get-port';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { InternalMastraMCPClient } from '../../client/client';
import { MCPServer } from '../server';
import type { MCPServerResources } from '../types';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const listenOnFreePort = async (server: http.Server): Promise<number> => {
  const port = await getPort();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });
  return port;
};

/**
 * Repeatedly triggers `notify` until `received` resolves, to avoid races between
 * the client's standalone SSE stream being established and the server sending
 * the notification.
 */
const notifyUntilReceived = async (notify: () => Promise<void>, received: Promise<void>): Promise<void> => {
  let done = false;
  void received.then(() => {
    done = true;
  });
  const deadline = Date.now() + 15000;
  while (!done && Date.now() < deadline) {
    await notify();
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  await received;
};

describe('Notification broadcast to streamable HTTP sessions', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let client: InternalMastraMCPClient;

  const resources: MCPServerResources = {
    listResources: async () => [{ uri: 'test://resource/1', name: 'Resource One', mimeType: 'text/plain' }],
    getResourceContent: async () => ({ text: 'hello' }),
  };

  const prompts: Prompt[] = [{ name: 'test-prompt', description: 'A test prompt' }];

  beforeAll(async () => {
    server = new MCPServer({
      name: 'BroadcastTestServer',
      version: '1.0.0',
      tools: {},
      resources,
      prompts: {
        listPrompts: async () => prompts,
        getPromptMessages: async () => [{ role: 'user', content: { type: 'text', text: 'hi' } }],
      },
    });

    let port = 0;
    httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      // Stateful streamable HTTP: each session gets its own server instance
      await server.startHTTP({
        url,
        httpPath: '/mcp',
        req,
        res,
      });
    });
    port = await listenOnFreePort(httpServer);

    client = new InternalMastraMCPClient({
      name: 'broadcast-test-client',
      server: {
        url: new URL(`http://localhost:${port}/mcp`),
      },
    });
    await client.connect();
    // Sanity: the client must be connected via a streamable HTTP session,
    // which means notifications go through an httpServerInstances entry.
    expect(client.sessionId).toBeDefined();
  });

  afterAll(async () => {
    await client?.disconnect();
    httpServer?.closeAllConnections?.();
    if (httpServer) {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    await server?.close();
  });

  it('delivers resources/list_changed to a streamable HTTP client', async () => {
    const received = new Promise<void>(resolve => {
      client.setResourceListChangedNotificationHandler(() => resolve());
    });

    await notifyUntilReceived(() => server.resources.notifyListChanged(), received);
    await expect(received).resolves.toBeUndefined();
  });

  it('delivers prompts/list_changed to a streamable HTTP client', async () => {
    const received = new Promise<void>(resolve => {
      client.setPromptListChangedNotificationHandler(() => resolve());
    });

    await notifyUntilReceived(() => server.prompts.notifyListChanged(), received);
    await expect(received).resolves.toBeUndefined();
  });

  it('delivers resources/updated to a subscribed streamable HTTP client', async () => {
    const uri = 'test://resource/1';
    const received = new Promise<void>(resolve => {
      client.setResourceUpdatedNotificationHandler((params: { uri: string }) => {
        if (params.uri === uri) resolve();
      });
    });

    await client.subscribeResource(uri);

    await notifyUntilReceived(() => server.resources.notifyUpdated({ uri }), received);
    await expect(received).resolves.toBeUndefined();

    await client.unsubscribeResource(uri);
  });
});

describe('Per-session resource subscriptions', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let clientA: InternalMastraMCPClient;
  let clientB: InternalMastraMCPClient;

  const uri = 'test://resource/1';
  const resources: MCPServerResources = {
    listResources: async () => [{ uri, name: 'Resource One', mimeType: 'text/plain' }],
    getResourceContent: async () => ({ text: 'hello' }),
  };

  beforeAll(async () => {
    server = new MCPServer({
      name: 'SubscriptionIsolationTestServer',
      version: '1.0.0',
      tools: {},
      resources,
    });

    let port = 0;
    httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      await server.startHTTP({ url, httpPath: '/mcp', req, res });
    });
    port = await listenOnFreePort(httpServer);

    const makeClient = (name: string) =>
      new InternalMastraMCPClient({ name, server: { url: new URL(`http://localhost:${port}/mcp`) } });
    clientA = makeClient('subscriber-client');
    clientB = makeClient('non-subscriber-client');
    await clientA.connect();
    await clientB.connect();
    expect(clientA.sessionId).toBeDefined();
    expect(clientB.sessionId).toBeDefined();
    expect(clientA.sessionId).not.toBe(clientB.sessionId);
  });

  afterAll(async () => {
    await clientA?.disconnect();
    await clientB?.disconnect();
    httpServer?.closeAllConnections?.();
    if (httpServer) {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    await server?.close();
  });

  it('only delivers resources/updated to the session that subscribed', async () => {
    let bNotified = 0;
    clientB.setResourceUpdatedNotificationHandler(() => {
      bNotified++;
    });
    const aReceived = new Promise<void>(resolve => {
      clientA.setResourceUpdatedNotificationHandler((params: { uri: string }) => {
        if (params.uri === uri) resolve();
      });
    });

    await clientA.subscribeResource(uri);

    await notifyUntilReceived(() => server.resources.notifyUpdated({ uri }), aReceived);
    await expect(aReceived).resolves.toBeUndefined();

    // Give any in-flight notification to B time to arrive before asserting it never did.
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(bNotified).toBe(0);

    await clientA.unsubscribeResource(uri);
  });

  it('one session unsubscribing does not remove another session subscription', async () => {
    const aReceived = new Promise<void>(resolve => {
      clientA.setResourceUpdatedNotificationHandler((params: { uri: string }) => {
        if (params.uri === uri) resolve();
      });
    });

    await clientA.subscribeResource(uri);
    await clientB.subscribeResource(uri);
    // Previously subscriptions were global, so B unsubscribing clobbered A's subscription.
    await clientB.unsubscribeResource(uri);

    await notifyUntilReceived(() => server.resources.notifyUpdated({ uri }), aReceived);
    await expect(aReceived).resolves.toBeUndefined();

    await clientA.unsubscribeResource(uri);
  });
});
