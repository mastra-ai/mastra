import http from 'node:http';
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MCPServer } from '../server/server';
import { InternalMastraMCPClient } from './client';
import { MCPClientServerProxy } from './server-proxy';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const listenOnFreePort = async (server: http.Server): Promise<number> => {
  const port = await getPort();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });
  return port;
};

const UI_RESOURCE_URI = 'ui://weather/widget';
const UI_META = { ui: { csp: { connectDomains: ['https://api.example.com'] } } };

const resources: Resource[] = [
  {
    uri: UI_RESOURCE_URI,
    name: 'Weather UI Widget',
    mimeType: 'text/html',
    _meta: UI_META,
  },
  {
    uri: 'weather://current',
    name: 'Current Weather Data',
    mimeType: 'application/json',
  },
];

const resourceContents: Record<string, { text: string }> = {
  [UI_RESOURCE_URI]: { text: '<html><body>widget</body></html>' },
  'weather://current': { text: JSON.stringify({ temp: 20 }) },
};

describe('MCPClientServerProxy', () => {
  let upstreamServer: MCPServer;
  let httpServer: http.Server;
  let client: InternalMastraMCPClient;
  let proxy: MCPClientServerProxy;

  beforeAll(async () => {
    upstreamServer = new MCPServer({
      name: 'UpstreamResourceServer',
      version: '1.0.0',
      tools: {},
      resources: {
        listResources: async () => resources,
        getResourceContent: async ({ uri }) => {
          const content = resourceContents[uri];
          if (!content) throw new Error(`No content for ${uri}`);
          return content;
        },
      },
    });

    httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost`);
      await upstreamServer.startHTTP({
        url,
        httpPath: '/http',
        req,
        res,
        options: { sessionIdGenerator: undefined },
      });
    });
    const port = await listenOnFreePort(httpServer);

    client = new InternalMastraMCPClient({
      name: 'proxy-test-client',
      server: { url: new URL(`http://localhost:${port}/http`) },
    });
    await client.connect();

    proxy = new MCPClientServerProxy({ name: 'proxied-server' }, async () => client);
  });

  afterAll(async () => {
    await client.disconnect();
    httpServer.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => {
      httpServer.close(err => (err ? reject(err) : resolve()));
    });
    await upstreamServer.close();
  });

  describe('readResource', () => {
    it('preserves mimeType and _meta from the upstream server', async () => {
      const result = await proxy.readResource(UI_RESOURCE_URI);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual(
        expect.objectContaining({
          uri: UI_RESOURCE_URI,
          mimeType: 'text/html',
          _meta: UI_META,
          text: '<html><body>widget</body></html>',
        }),
      );
    });

    it('reports the same metadata listResources() does for the same resource', async () => {
      const listed = (await proxy.listResources()).resources.find(r => r.uri === UI_RESOURCE_URI);
      const [read] = (await proxy.readResource(UI_RESOURCE_URI)).contents;

      expect(read!.mimeType).toBe(listed!.mimeType);
      expect(read!._meta).toEqual(listed!._meta);
    });

    it('omits _meta for a resource that declares none', async () => {
      const [content] = (await proxy.readResource('weather://current')).contents;

      expect(content).not.toHaveProperty('_meta');
      expect(content!.mimeType).toBe('application/json');
    });
  });
});
