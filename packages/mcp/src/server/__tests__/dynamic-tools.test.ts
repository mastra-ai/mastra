import http from 'node:http';
import type { ToolsInput } from '@mastra/core/agent';
import getPort from 'get-port';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { z } from 'zod/v3';
import { InternalMastraMCPClient } from '../../client/client';
import { MCPClient } from '../../client/configuration';
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

const initialTools: ToolsInput = {
  initialTool: {
    description: 'An initial tool',
    parameters: z.object({}),
    execute: async () => ({ result: 'initial' }),
  },
};

const dynamicTools: ToolsInput = {
  dynamicTool: {
    description: 'A dynamically added tool',
    parameters: z.object({ input: z.string().optional() }),
    execute: async () => ({ result: 'dynamic' }),
  },
};

describe('MCPServer dynamic tools + tools/list_changed', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let client: InternalMastraMCPClient;

  beforeAll(async () => {
    server = new MCPServer({
      name: 'DynamicToolsTestServer',
      version: '1.0.0',
      tools: { ...initialTools },
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

    client = new InternalMastraMCPClient({
      name: 'dynamic-tools-test-client',
      server: {
        url: new URL(`http://localhost:${port}/mcp`),
      },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client?.disconnect();
    httpServer?.closeAllConnections?.();
    if (httpServer) {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    await server?.close();
  });

  it('declares the tools listChanged capability', () => {
    // Access the underlying SDK client to read negotiated server capabilities
    const capabilities = (client as any)['client'].getServerCapabilities();
    expect(capabilities?.tools?.listChanged).toBe(true);
  });

  it('adding a tool notifies the client and the new tool is listed and callable', async () => {
    const initialToolList = await client.tools();
    expect(Object.keys(initialToolList)).toContain('initialTool');
    expect(Object.keys(initialToolList)).not.toContain('dynamicTool');

    const notified = new Promise<void>(resolve => {
      client.setToolListChangedNotificationHandler(() => resolve());
    });

    await server.toolActions.add(dynamicTools);
    // add() already sent one notification; re-notify until the client's SSE stream picks it up
    await notifyUntilReceived(() => server.toolActions.notifyListChanged(), notified);
    await expect(notified).resolves.toBeUndefined();

    const updatedToolList = await client.tools();
    expect(Object.keys(updatedToolList)).toContain('dynamicTool');

    const tool = updatedToolList['dynamicTool'];
    const result = await (tool!.execute as any)({ input: 'hello' });
    expect(result.content?.[0]?.text).toContain('dynamic');
  });

  it('removing a tool notifies the client and the tool is no longer listed', async () => {
    const notified = new Promise<void>(resolve => {
      client.setToolListChangedNotificationHandler(() => resolve());
    });

    await server.toolActions.remove(['dynamicTool']);
    await notifyUntilReceived(() => server.toolActions.notifyListChanged(), notified);
    await expect(notified).resolves.toBeUndefined();

    const toolList = await client.tools();
    expect(Object.keys(toolList)).not.toContain('dynamicTool');
    expect(Object.keys(toolList)).toContain('initialTool');
  });

  it('removing an unknown tool does not throw and does not notify', async () => {
    await expect(server.toolActions.remove(['nope'])).resolves.toBeUndefined();
  });

  it('dynamically added tools survive tool re-conversion on Mastra registration', async () => {
    const standaloneServer = new MCPServer({
      name: 'ReconversionTestServer',
      version: '1.0.0',
      tools: { ...initialTools },
    });

    await standaloneServer.toolActions.add(dynamicTools);
    expect(Object.keys(standaloneServer.tools())).toContain('dynamicTool');

    // __registerMastra re-converts tools from originalTools
    standaloneServer.__registerMastra({} as any);
    expect(Object.keys(standaloneServer.tools())).toContain('dynamicTool');
    expect(Object.keys(standaloneServer.tools())).toContain('initialTool');

    await standaloneServer.toolActions.remove(['dynamicTool']);
    standaloneServer.__registerMastra({} as any);
    expect(Object.keys(standaloneServer.tools())).not.toContain('dynamicTool');

    await standaloneServer.close();
  });

  it('MCPClient.tools.onListChanged receives tool list change notifications', async () => {
    const mcpClient = new MCPClient({
      id: 'dynamic-tools-mcpclient-test',
      servers: {
        dynamicServer: {
          url: new URL((client as any)['serverConfig'].url),
        },
      },
    });

    try {
      const notified = new Promise<void>(resolve => {
        void mcpClient.tools.onListChanged('dynamicServer', () => resolve());
      });
      // Ensure connection + handler registration completed before notifying
      await mcpClient.listTools();

      await notifyUntilReceived(() => server.toolActions.notifyListChanged(), notified);
      await expect(notified).resolves.toBeUndefined();
    } finally {
      await mcpClient.disconnect();
    }
  });
});
