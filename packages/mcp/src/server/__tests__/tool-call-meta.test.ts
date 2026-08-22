import { createTool } from '@mastra/core/tools';
import { RESOURCE_URI_META_KEY } from '@modelcontextprotocol/ext-apps';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';

import { MCPServer } from '../server';
import { makeMockExtra } from './mock-extra';

/**
 * MCP Apps hosts resolve which app to render from the `_meta.ui.resourceUri` on the
 * `tools/call` result, not from `tools/list`. These tests pin that the server emits
 * `_meta` on call results — in both the canonical nested form and its legacy flat
 * alias — and that `_meta` returned by a tool's own `execute()` survives.
 */

const NESTED_URI = 'ui://widget/chart.html';
const LEGACY_URI = 'ui://widget/legacy.html';

const callTool = async (server: MCPServer, name: string, args: Record<string, unknown> = {}) => {
  const handler = (server.getServer() as any)._requestHandlers.get('tools/call');
  return handler(
    { jsonrpc: '2.0', id: 'test-call', method: 'tools/call', params: { name, arguments: args } },
    makeMockExtra(),
  );
};

const listTools = async (server: MCPServer) => {
  const handler = (server.getServer() as any)._requestHandlers.get('tools/list');
  const result = await handler({ jsonrpc: '2.0', id: 'test-list', method: 'tools/list' }, makeMockExtra());
  return result.tools as any[];
};

const makeServer = (tools: Record<string, any>) => new MCPServer({ name: 'MetaTestServer', version: '1.0.0', tools });

describe('MCPServer tools/call _meta', () => {
  it('emits a declared nested ui.resourceUri in both the nested and legacy forms', async () => {
    const server = makeServer({
      chart: createTool({
        id: 'chart',
        description: 'chart',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
        mcp: { _meta: { ui: { resourceUri: NESTED_URI } } },
      } as any),
    });

    const result = await callTool(server, 'chart');

    expect(result._meta).toMatchObject({
      ui: { resourceUri: NESTED_URI },
      [RESOURCE_URI_META_KEY]: NESTED_URI,
    });
  });

  it('mirrors a declared legacy flat resourceUri back onto the nested form', async () => {
    const server = makeServer({
      legacy: createTool({
        id: 'legacy',
        description: 'legacy',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
        mcp: { _meta: { [RESOURCE_URI_META_KEY]: LEGACY_URI } },
      } as any),
    });

    const result = await callTool(server, 'legacy');

    expect(result._meta).toMatchObject({
      ui: { resourceUri: LEGACY_URI },
      [RESOURCE_URI_META_KEY]: LEGACY_URI,
    });
  });

  it('omits _meta entirely for tools that declare none and return none', async () => {
    const server = makeServer({
      plain: createTool({
        id: 'plain',
        description: 'plain',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      } as any),
    });

    const result = await callTool(server, 'plain');

    expect(result._meta).toBeUndefined();
  });

  it('preserves _meta returned by execute() when the tool declares none', async () => {
    const server = makeServer({
      authored: createTool({
        id: 'authored',
        description: 'authored',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true, _meta: { ui: { resourceUri: NESTED_URI }, traceId: 'abc' } }),
      } as any),
    });

    const result = await callTool(server, 'authored');

    expect(result._meta).toMatchObject({
      ui: { resourceUri: NESTED_URI },
      [RESOURCE_URI_META_KEY]: NESTED_URI,
      traceId: 'abc',
    });
  });

  it('merges declared and author _meta, with the author winning and no stale legacy key', async () => {
    const authorUri = 'ui://widget/author.html';
    const server = makeServer({
      merged: createTool({
        id: 'merged',
        description: 'merged',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true, _meta: { ui: { resourceUri: authorUri } } }),
        mcp: { _meta: { ui: { resourceUri: NESTED_URI }, declaredOnly: true } },
      } as any),
    });

    const result = await callTool(server, 'merged');

    expect(result._meta).toMatchObject({
      ui: { resourceUri: authorUri },
      [RESOURCE_URI_META_KEY]: authorUri,
      declaredOnly: true,
    });
  });

  it('keeps the declared resourceUri when the author _meta carries an unrelated ui key', async () => {
    const server = makeServer({
      partial: createTool({
        id: 'partial',
        description: 'partial',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true, _meta: { ui: { visibility: 'hidden' } } }),
        mcp: { _meta: { ui: { resourceUri: NESTED_URI } } },
      } as any),
    });

    const result = await callTool(server, 'partial');

    expect(result._meta).toMatchObject({
      ui: { resourceUri: NESTED_URI, visibility: 'hidden' },
      [RESOURCE_URI_META_KEY]: NESTED_URI,
    });
  });

  it('keeps a declared ui.visibility when the author overrides only resourceUri', async () => {
    const authorUri = 'ui://widget/author.html';
    const server = makeServer({
      visibility: createTool({
        id: 'visibility',
        description: 'visibility',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true, _meta: { ui: { resourceUri: authorUri } } }),
        mcp: { _meta: { ui: { resourceUri: NESTED_URI, visibility: 'hidden' } } },
      } as any),
    });

    const result = await callTool(server, 'visibility');

    expect(result._meta).toMatchObject({
      ui: { resourceUri: authorUri, visibility: 'hidden' },
      [RESOURCE_URI_META_KEY]: authorUri,
    });
  });

  it('emits declared _meta for tools with an outputSchema', async () => {
    const server = makeServer({
      structured: createTool({
        id: 'structured',
        description: 'structured',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        execute: async () => ({ value: 'hello' }),
        mcp: { _meta: { ui: { resourceUri: NESTED_URI } } },
      } as any),
    });

    const result = await callTool(server, 'structured');

    expect(result.structuredContent).toEqual({ value: 'hello' });
    expect(result._meta).toMatchObject({
      ui: { resourceUri: NESTED_URI },
      [RESOURCE_URI_META_KEY]: NESTED_URI,
    });
  });

  it('advertises the same _meta on tools/list as on tools/call', async () => {
    const server = makeServer({
      chart: createTool({
        id: 'chart',
        description: 'chart',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
        mcp: { _meta: { ui: { resourceUri: NESTED_URI } } },
      } as any),
    });

    const [listed] = await listTools(server);
    const called = await callTool(server, 'chart');

    expect(listed._meta).toEqual(called._meta);
  });
});
