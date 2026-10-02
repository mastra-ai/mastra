import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

describe('Built-in Studio MCP endpoint', () => {
  const app = new Hono();
  beforeAll(async () => {
    const mastra = new Mastra({
      server: { auth: new SimpleAuth({ tokens: { 'test-token': { id: 'user-1' } } }) },
    });
    await new MastraServer({ app, mastra }).init();
  });

  it('serves the launch tool through the adapter without authentication', async () => {
    const response = await app.request('https://mastra.example.com/api/studio/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': 'tools/list',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': { name: 'studio-test', version: '1.0.0' },
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).result.tools).toMatchObject([{ name: 'open_studio' }]);
  });

  it('continues to require authentication for trace data', async () => {
    const response = await app.request('https://mastra.example.com/api/observability/traces/light');
    expect(response.status).toBe(401);
  });
});
