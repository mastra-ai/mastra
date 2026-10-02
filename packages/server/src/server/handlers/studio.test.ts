import { createServer } from 'node:http';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVER_ROUTES } from '../server-adapter/routes';
import { createStudioMcpServer } from '../studio/mcp-app';
import { STUDIO_MCP_ROUTE } from './studio';

describe('Studio MCP App', () => {
  beforeEach(() => vi.stubEnv('MASTRA_STUDIO_PUBLIC_URL', ''));
  afterEach(() => vi.unstubAllEnvs());
  let baseUrl: string;
  const mastra = new Mastra({});
  const httpServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', baseUrl);
      const { server, httpPath } = await STUDIO_MCP_ROUTE.handler({
        mastra,
        request: new Request(url),
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
        routePrefix: '/custom/api',
      });
      await server.startHTTP({ url, httpPath: `/custom/api${httpPath}`, req, res });
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });

  beforeAll(async () => {
    await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Expected a listening HTTP server');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    httpServer.closeAllConnections();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  async function rpc(method: string, params: Record<string, unknown> = {}) {
    const response = await fetch(`${baseUrl}/custom/api/studio/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': method,
        ...(typeof params.uri === 'string'
          ? { 'mcp-name': params.uri }
          : typeof params.name === 'string'
            ? { 'mcp-name': params.name }
            : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: {
          ...params,
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': { name: 'studio-test', version: '1.0.0' },
            'io.modelcontextprotocol/clientCapabilities': { extensions: { 'io.modelcontextprotocol/ui': {} } },
          },
        },
      }),
    });
    const text = await response.text();
    expect(response.status, text).toBe(200);
    const data = response.headers.get('content-type')?.includes('text/event-stream')
      ? text
          .split('\n')
          .find(line => line.startsWith('data: '))
          ?.slice(6)
      : text;
    if (!data) throw new Error('Missing MCP response');
    return JSON.parse(data);
  }

  it('registers a public UI shell alongside the existing protected trace routes', () => {
    expect(SERVER_ROUTES).toContain(STUDIO_MCP_ROUTE);
    expect(STUDIO_MCP_ROUTE.requiresAuth).toBe(false);
    expect(
      SERVER_ROUTES.find(route => route.path === '/observability/traces/query' && route.method === 'POST')
        ?.requiresAuth,
    ).toBe(true);
  });

  it('advertises one read-only ChatGPT global entry point over HTTP', async () => {
    const response = await rpc('tools/list');
    expect(response.result.tools).toHaveLength(1);
    expect(response.result.tools[0]).toMatchObject({
      name: 'open_studio',
      annotations: { readOnlyHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: expect.stringMatching(/^ui:\/\/mastra-studio\/traces-/) },
        'openai/ui': { entrypoints: [{ type: 'global' }] },
      },
    });
  });

  it('serves a self-contained UI with the request origin and custom API prefix', async () => {
    const listing = await rpc('resources/list');
    const resource = listing.result.resources[0];
    const response = await rpc('resources/read', { uri: resource.uri });
    const content = response.result.contents[0];
    expect(content.mimeType).toBe('text/html;profile=mcp-app');
    expect(content._meta.ui.csp).toEqual({ connectDomains: [baseUrl], resourceDomains: [] });
    expect(content.text).toContain(`{"baseUrl":"${baseUrl}","apiPrefix":"/custom/api"}`);
    expect(content.text).toContain('Mastra instance URL');
    expect(content.text.match(/<style>([\s\S]*?)<\/style>/)?.[1].length).toBeGreaterThan(1000);
    expect(content.text.slice(0, content.text.indexOf('<script>'))).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    expect(content.text).not.toContain('__MASTRA_STUDIO_MCP_CONFIG__');
  });

  it('opens the UI without reading traces or exposing project tools', async () => {
    const response = await rpc('tools/call', { name: 'open_studio', arguments: {} });
    expect(response.error).toBeUndefined();
    expect(response.result.isError).not.toBe(true);
    expect(JSON.stringify(response.result)).toContain('Connect to the public Mastra server');
  });

  it('uses the configured public URL behind an HTTPS proxy', async () => {
    vi.stubEnv('MASTRA_STUDIO_PUBLIC_URL', 'https://agents.example.com/project');
    const listing = await rpc('resources/list');
    const response = await rpc('resources/read', { uri: listing.result.resources[0].uri });
    expect(response.result.contents[0]._meta.ui.csp.connectDomains).toEqual(['https://agents.example.com']);
    expect(response.result.contents[0].text).toContain(
      '{"baseUrl":"https://agents.example.com/project","apiPrefix":"/custom/api"}',
    );
  });

  it('preserves an explicitly empty API prefix', async () => {
    const { server } = await STUDIO_MCP_ROUTE.handler({
      mastra,
      request: new Request('https://agents.example.com/studio/mcp'),
      requestContext: new RequestContext(),
      abortSignal: new AbortController().signal,
      routePrefix: '',
    });
    const resource = (await server.listResources()).resources[0];
    if (!resource) throw new Error('Missing UI resource');
    expect((await server.readResource(resource.uri)).contents[0]?.text).toContain('"apiPrefix":""');
    await server.close();
  });

  it('changes the resource identity when the server configuration changes', async () => {
    const first = createStudioMcpServer({ baseUrl: 'https://first.example.com', apiPrefix: '/api' });
    const second = createStudioMcpServer({ baseUrl: 'https://second.example.com', apiPrefix: '/v2' });
    expect((await first.listResources()).resources[0]?.uri).not.toBe((await second.listResources()).resources[0]?.uri);
    await first.close();
    await second.close();
  });
});
