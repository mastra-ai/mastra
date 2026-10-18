import type { MCPServerBase } from '@mastra/core/mcp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { serveHTTP } from '../server/__tests__/harness.mock';
import type { ServedHTTP } from '../server/__tests__/harness.mock';
import { MCPServer } from '../server/server';
import { InternalMastraMCPClient } from './client';
import { MCPClientServerProxy } from './server-proxy';

describe('MCPClientServerProxy.readResource', () => {
  const uri = 'ui://proxy/card';
  let served: ServedHTTP;
  let client: InternalMastraMCPClient;
  let proxy: MCPClientServerProxy;

  beforeAll(async () => {
    const server = new MCPServer({
      name: 'proxy-resource-test',
      version: '1.0.0',
      tools: {},
      appResources: {
        [uri]: {
          name: 'Card',
          html: '<html>Card</html>',
          meta: { csp: { connectDomains: ['https://api.example.com'] } },
        },
      },
    });
    served = await serveHTTP(server);
    client = new InternalMastraMCPClient({ name: 'proxy-resource-client', server: { url: served.url } });
    await client.connect();
    proxy = new MCPClientServerProxy({ name: 'proxy' }, async () => client);
  });

  afterAll(async () => {
    await client?.disconnect();
    await served?.close();
  });

  it('preserves mimeType and _meta from the remote server, matching the raw client read', async () => {
    const raw = await client.resources.read(uri);
    const base: MCPServerBase = proxy;
    const result = await base.readResource(uri);

    expect(result.contents).toEqual([
      {
        uri,
        mimeType: 'text/html;profile=mcp-app',
        _meta: { ui: { csp: { connectDomains: ['https://api.example.com'] } } },
        text: '<html>Card</html>',
      },
    ]);
    expect(result).toEqual({ contents: raw.contents });
  });

  it('preserves metadata on text and blob items, keeps empty values, and omits absent fields', async () => {
    const contents = [
      { uri, text: '', mimeType: '', _meta: {} },
      { uri: 'asset://image', blob: 'aGVsbG8=', mimeType: 'image/png', _meta: { size: 5 } },
      { uri: 'plain://text', text: 'plain' },
    ];
    const read = vi.spyOn(client.resources, 'read').mockResolvedValueOnce({ contents });
    try {
      expect(await proxy.readResource(uri)).toStrictEqual({ contents });
    } finally {
      read.mockRestore();
    }
  });
});
