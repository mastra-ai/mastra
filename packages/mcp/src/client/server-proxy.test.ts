import http from 'node:http';
import type { MCPServerBase } from '@mastra/core/mcp';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { MCPServer } from '../server/server';
import { InternalMastraMCPClient } from './client';
import { MCPClientServerProxy } from './server-proxy';

describe('MCPClientServerProxy resource reads', () => {
  const uri = 'ui://proxy/card';
  const mimeType = 'text/html;profile=mcp-app';
  const _meta = {
    ui: { csp: { connectDomains: ['https://api.example.com'] } },
    'vendor/frame': { width: 640, height: 480 },
  };
  let server: MCPServer;
  let httpServer: http.Server;
  let client: InternalMastraMCPClient;
  let proxy: MCPClientServerProxy;

  beforeAll(async () => {
    server = new MCPServer({
      name: 'proxy-resource-test',
      version: '1.0.0',
      tools: {},
      resources: {
        listResources: async () => [{ uri, name: 'Card', mimeType, _meta }],
        getResourceContent: async () => ({ text: '<html>Card</html>' }),
      },
    });
    const port = await getPort();
    httpServer = http.createServer(async (req, res) => {
      await server.startHTTP({
        url: new URL(req.url || '', `http://localhost:${port}`),
        httpPath: '/http',
        req,
        res,
        options: { sessionIdGenerator: undefined },
      });
    });
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, resolve);
    });
    client = new InternalMastraMCPClient({
      name: 'proxy-resource-client',
      server: { url: new URL(`http://localhost:${port}/http`) },
    });
    await client.connect();
    proxy = new MCPClientServerProxy({ name: 'proxy' }, async () => client);
  });

  afterAll(async () => {
    await client?.disconnect();
    httpServer?.closeAllConnections();
    if (httpServer) {
      await new Promise<void>((resolve, reject) => httpServer.close(error => (error ? reject(error) : resolve())));
    }
    await server?.close();
  });

  it('preserves MCP App metadata from the real transport, matching raw reads and resource listings', async () => {
    const raw = await client.resources.read(uri);
    expect(raw.contents).toEqual([{ uri, text: '<html>Card</html>', mimeType, _meta }]);
    expect((await proxy.listResources()).resources).toContainEqual(expect.objectContaining({ uri, mimeType, _meta }));
    const base: MCPServerBase = proxy;
    const result = await base.readResource(uri);
    expect(result).toEqual(raw);
    expectTypeOf(result.contents[0]!.mimeType).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.contents[0]!._meta).toEqualTypeOf<Record<string, unknown> | undefined>();
  });

  it('preserves each text/blob item, empty values, and URI fallback without listing resources', async () => {
    const contents = [
      { uri, text: '', mimeType: '', _meta: {} },
      { uri: 'asset://image', blob: 'aGVsbG8=', mimeType: 'image/png', _meta },
      { uri: 'asset://empty', blob: '' },
      { uri, text: 'fallback' },
      { uri: 'plain://text', text: 'plain' },
    ];
    // Simulate a malformed client response to exercise the existing URI fallback.
    Reflect.deleteProperty(contents[3]!, 'uri');
    const read = vi.spyOn(client.resources, 'read').mockResolvedValueOnce({ contents });
    const list = vi.spyOn(client.resources, 'list');
    try {
      expect(await proxy.readResource(uri)).toEqual({
        contents: contents.map(content => ({ ...content, uri: content.uri ?? uri })),
      });
      expect(read).toHaveBeenCalledWith(uri);
      expect(list).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      list.mockRestore();
    }
  });

  it('returns an empty contents array when the client omits contents', async () => {
    const response = { contents: [] };
    // Simulate a malformed response without weakening the client mock's type.
    Reflect.deleteProperty(response, 'contents');
    const read = vi.spyOn(client.resources, 'read').mockResolvedValueOnce(response);
    try {
      expect(await proxy.readResource(uri)).toEqual({ contents: [] });
    } finally {
      read.mockRestore();
    }
  });
});
