/**
 * Regression test for #21277: `tools/call` results must carry `_meta` so MCP Apps
 * hosts can detect the app (`_meta.ui.resourceUri`) from the call result, and so
 * `_meta` returned by an MCP-aware tool alongside `structuredContent` is preserved.
 */
import http from 'node:http';
import { createTool } from '@mastra/core/tools';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { z } from 'zod/v3';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const APP_URI = 'ui://weather/app.html';
const LEGACY_URI = 'ui://legacy/app.html';

describe('MCPServer tools/call result _meta (Issue #21277)', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let client: Client;
  const PORT = 9900 + Math.floor(Math.random() * 100);

  beforeAll(async () => {
    const outputSchema = z.object({ temperature: z.number() });

    const appTool = createTool({
      id: 'app-tool',
      description: 'Tool linked to an MCP App via nested ui.resourceUri',
      inputSchema: z.object({}),
      outputSchema,
      mcp: { _meta: { ui: { resourceUri: APP_URI }, customField: 'descriptor-only' } },
      execute: async () => ({ temperature: 21 }),
    });

    const legacyAppTool = createTool({
      id: 'legacy-app-tool',
      description: 'Tool linked to an MCP App via the legacy flat key',
      inputSchema: z.object({}),
      outputSchema,
      mcp: { _meta: { 'ui/resourceUri': LEGACY_URI } },
      execute: async () => ({ temperature: 22 }),
    });

    const authorMetaTool = createTool({
      id: 'author-meta-tool',
      description: 'MCP-aware tool returning its own _meta',
      inputSchema: z.object({}),
      outputSchema,
      mcp: { _meta: { ui: { resourceUri: APP_URI } } },
      execute: async () => ({ temperature: 0 }),
    });

    const plainTool = createTool({
      id: 'plain-tool',
      description: 'Tool with no _meta anywhere',
      inputSchema: z.object({}),
      outputSchema,
      execute: async () => ({ temperature: 24 }),
    });

    server = new MCPServer({
      name: 'CallResultMetaTestServer',
      version: '1.0.0',
      tools: { appTool, legacyAppTool, authorMetaTool, plainTool },
    });

    // The MCP-aware return shape ({ structuredContent, _meta }) bypasses core's output
    // validation only when returned by the converted tool, so mock it there (as server.test.ts does).
    vi.spyOn(server.convertedTools.authorMetaTool!, 'execute').mockResolvedValue({
      structuredContent: { temperature: 23 },
      _meta: { ui: { resourceUri: 'ui://author/override.html' }, requestId: 'abc' },
    });

    httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      await server.startHTTP({ url, httpPath: '/http', req, res, options: { sessionIdGenerator: undefined } });
    });
    await new Promise<void>(resolve => httpServer.listen(PORT, resolve));

    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/http`)));
  });

  afterAll(async () => {
    await client?.close();
    await server?.close();
    await new Promise<void>((resolve, reject) => httpServer?.close(err => (err ? reject(err) : resolve())));
  });

  it('mirrors the tool descriptor ui.resourceUri onto the call result in both forms', async () => {
    const result = await client.callTool({ name: 'appTool', arguments: {} });
    expect(result.structuredContent).toEqual({ temperature: 21 });
    expect(result._meta).toEqual({ ui: { resourceUri: APP_URI }, 'ui/resourceUri': APP_URI });
  });

  it('normalizes the legacy flat key into ui.resourceUri on the call result', async () => {
    const result = await client.callTool({ name: 'legacyAppTool', arguments: {} });
    expect(result._meta).toEqual({ ui: { resourceUri: LEGACY_URI }, 'ui/resourceUri': LEGACY_URI });
  });

  it('preserves _meta returned by an MCP-aware tool, letting the author override the descriptor', async () => {
    const result = await client.callTool({ name: 'authorMetaTool', arguments: {} });
    expect(result.structuredContent).toEqual({ temperature: 23 });
    // Author's linkage replaces the descriptor's in BOTH forms — never split-brain.
    expect(result._meta).toEqual({
      ui: { resourceUri: 'ui://author/override.html' },
      'ui/resourceUri': 'ui://author/override.html',
      requestId: 'abc',
    });
  });

  it('normalizes an author-supplied legacy-only key and drops the descriptor linkage', async () => {
    vi.spyOn(server.convertedTools.authorMetaTool!, 'execute').mockResolvedValueOnce({
      structuredContent: { temperature: 25 },
      _meta: { 'ui/resourceUri': 'ui://author/legacy.html' },
    });
    const result = await client.callTool({ name: 'authorMetaTool', arguments: {} });
    expect(result._meta).toEqual({
      ui: { resourceUri: 'ui://author/legacy.html' },
      'ui/resourceUri': 'ui://author/legacy.html',
    });
  });

  it('keeps other author ui.* fields when the resourceUri comes from the descriptor', async () => {
    vi.spyOn(server.convertedTools.authorMetaTool!, 'execute').mockResolvedValueOnce({
      structuredContent: { temperature: 26 },
      _meta: { ui: { visibility: ['model'] } },
    });
    const result = await client.callTool({ name: 'authorMetaTool', arguments: {} });
    expect(result._meta).toEqual({
      ui: { visibility: ['model'], resourceUri: APP_URI },
      'ui/resourceUri': APP_URI,
    });
  });

  it('does not copy descriptor-only _meta keys onto the call result, and leaves tools/list unchanged', async () => {
    const result = await client.callTool({ name: 'appTool', arguments: {} });
    expect(result._meta).not.toHaveProperty('customField');

    const { tools } = await client.listTools();
    const listed = tools.find(t => t.name === 'appTool');
    expect(listed?._meta).toEqual({
      ui: { resourceUri: APP_URI },
      'ui/resourceUri': APP_URI,
      customField: 'descriptor-only',
    });
  });

  it('omits _meta when neither the descriptor nor the tool provides one', async () => {
    const result = await client.callTool({ name: 'plainTool', arguments: {} });
    expect(result.structuredContent).toEqual({ temperature: 24 });
    expect(result._meta).toBeUndefined();
  });
});
