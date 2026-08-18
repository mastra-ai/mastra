import type { ToolsInput } from '@mastra/core/agent';
import { RESOURCE_URI_META_KEY } from '@modelcontextprotocol/ext-apps';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { MCPServer } from '../server';
import { makeMockExtra } from './mock-extra';

const RESOURCE_URI = 'ui://calculator/main';

const makeServer = (tools: ToolsInput) =>
  new MCPServer({
    name: 'ToolCallMetaTestServer',
    version: '1.0.0',
    tools,
  });

const getHandler = (server: MCPServer, method: 'tools/call' | 'tools/list') => {
  // @ts-expect-error - accessing internal for testing; the SDK keeps handlers on a private map
  const requestHandlers = server.getServer()._requestHandlers;
  const handler = requestHandlers.get(method);
  expect(handler).toBeDefined();
  return handler;
};

const callTool = async (server: MCPServer, name: string, args: Record<string, unknown> = {}) =>
  getHandler(server, 'tools/call')(
    {
      jsonrpc: '2.0' as const,
      id: 'tool-call-meta-test',
      method: 'tools/call' as const,
      params: { name, arguments: args },
    },
    makeMockExtra(),
  );

const listTools = async (server: MCPServer) =>
  getHandler(server, 'tools/list')(
    { jsonrpc: '2.0' as const, id: 'tool-list-meta-test', method: 'tools/list' as const, params: {} },
    makeMockExtra(),
  );

describe('MCPServer tools/call `_meta`', () => {
  it('returns the declared UI resource URI on the call result, in both nested and legacy form', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool',
        parameters: z.object({}),
        execute: async () => ({ value: 42 }),
        mcp: { _meta: { ui: { resourceUri: RESOURCE_URI } } },
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    expect(result._meta).toEqual({
      ui: { resourceUri: RESOURCE_URI },
      [RESOURCE_URI_META_KEY]: RESOURCE_URI,
    });
  });

  it('normalizes a legacy flat resource URI into the nested form on the call result', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool declared with only the legacy key',
        parameters: z.object({}),
        execute: async () => ({ value: 42 }),
        mcp: { _meta: { [RESOURCE_URI_META_KEY]: RESOURCE_URI } },
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    expect(result._meta).toEqual({
      ui: { resourceUri: RESOURCE_URI },
      [RESOURCE_URI_META_KEY]: RESOURCE_URI,
    });
  });

  it('omits `_meta` entirely for a tool that declares none', async () => {
    const server = makeServer({
      plain: {
        description: 'A tool with no MCP metadata',
        parameters: z.object({}),
        execute: async () => ({ value: 1 }),
      },
    } as ToolsInput);

    const result = await callTool(server, 'plain');

    expect(result).not.toHaveProperty('_meta');
  });

  it('preserves `_meta` returned by the tool execute()', async () => {
    const server = makeServer({
      reporter: {
        description: 'A tool that returns its own metadata',
        parameters: z.object({}),
        execute: async () => ({ value: 1, _meta: { 'acme/traceId': 'abc-123' } }),
      },
    } as ToolsInput);

    const result = await callTool(server, 'reporter');

    expect(result._meta).toEqual({ 'acme/traceId': 'abc-123' });
  });

  it('merges execute() `_meta` with the declared tool metadata, author wins on collision', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool that also returns metadata',
        parameters: z.object({}),
        execute: async () => ({
          value: 42,
          _meta: { ui: { resourceUri: 'ui://calculator/override' }, 'acme/traceId': 'abc-123' },
        }),
        mcp: { _meta: { ui: { resourceUri: RESOURCE_URI }, 'acme/kind': 'app' } },
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    expect(result._meta).toEqual({
      ui: { resourceUri: 'ui://calculator/override' },
      [RESOURCE_URI_META_KEY]: 'ui://calculator/override',
      'acme/kind': 'app',
      'acme/traceId': 'abc-123',
    });
  });

  it('does not leave a stale legacy resource URI when execute() overrides the declared one', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool declaring both the nested and legacy form',
        parameters: z.object({}),
        execute: async () => ({ value: 42, _meta: { ui: { resourceUri: 'ui://calculator/override' } } }),
        mcp: { _meta: { ui: { resourceUri: RESOURCE_URI }, [RESOURCE_URI_META_KEY]: RESOURCE_URI } },
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    expect(result._meta).toEqual({
      ui: { resourceUri: 'ui://calculator/override' },
      [RESOURCE_URI_META_KEY]: 'ui://calculator/override',
    });
  });

  it('keeps the declared resourceUri when execute() returns other `ui` keys', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool whose execute returns an unrelated ui key',
        parameters: z.object({}),
        execute: async () => ({ value: 42, _meta: { ui: { visibility: 'hidden' } } }),
        mcp: { _meta: { ui: { resourceUri: RESOURCE_URI } } },
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    // The nested and flat forms must not diverge: an author `ui` object without a
    // resourceUri must not knock out the declared one while the flat key survives.
    expect(result._meta).toEqual({
      ui: { resourceUri: RESOURCE_URI, visibility: 'hidden' },
      [RESOURCE_URI_META_KEY]: RESOURCE_URI,
    });
  });

  it('preserves the declared `ui.visibility` when execute() overrides resourceUri', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool declaring a visibility scope',
        parameters: z.object({}),
        execute: async () => ({ value: 42, _meta: { ui: { resourceUri: 'ui://calculator/override' } } }),
        mcp: { _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } } },
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    // `ui` is a namespace — per McpUiToolMetaSchema a tool may set `resourceUri`
    // and `visibility` — so an author-supplied `ui` must not drop the declared
    // visibility scope.
    expect(result._meta).toEqual({
      ui: { resourceUri: 'ui://calculator/override', visibility: ['app'] },
      [RESOURCE_URI_META_KEY]: 'ui://calculator/override',
    });
  });

  it('still advertises declared `_meta` for a tool that has an outputSchema', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool with an outputSchema',
        parameters: z.object({}),
        outputSchema: z.object({ value: z.number() }),
        execute: async () => ({ value: 42 }),
        mcp: { _meta: { ui: { resourceUri: RESOURCE_URI } } },
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    expect(result.structuredContent).toEqual({ value: 42 });
    expect(result._meta).toEqual({
      ui: { resourceUri: RESOURCE_URI },
      [RESOURCE_URI_META_KEY]: RESOURCE_URI,
    });
  });

  it('cannot see author `_meta` when the tool declares an outputSchema', async () => {
    // Documented limitation, not a regression: a tool's outputSchema is applied
    // inside execute(), and it strips unknown keys there, so `_meta` returned
    // alongside the structured payload never reaches the result builder. Declared
    // `mcp._meta` is resolved independently of the result and is unaffected, which
    // is what app tools rely on (covered by the test above).
    const server = makeServer({
      reporter: {
        description: 'A tool with an outputSchema that also returns _meta',
        parameters: z.object({}),
        outputSchema: z.object({ value: z.number() }),
        execute: async () => ({ value: 1, _meta: { 'acme/traceId': 'abc-123' } }),
      },
    } as ToolsInput);

    const result = await callTool(server, 'reporter');

    expect(result.structuredContent).toEqual({ value: 1 });
    expect(result).not.toHaveProperty('_meta');
  });

  it('resolves a declared conflict between the two resource URI forms in favour of the nested one', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool declaring two different resource URIs',
        parameters: z.object({}),
        execute: async () => ({ value: 42 }),
        mcp: {
          _meta: {
            ui: { resourceUri: RESOURCE_URI },
            [RESOURCE_URI_META_KEY]: 'ui://calculator/stale',
          },
        },
      },
    } as ToolsInput);

    const called = await callTool(server, 'calculator');
    const listed = await listTools(server);
    const listedTool = listed.tools.find((tool: { name: string }) => tool.name === 'calculator');

    // A tool must never advertise two different resource URIs: a host reading
    // whichever key it understands would otherwise resolve a different app.
    expect(called._meta).toEqual({
      ui: { resourceUri: RESOURCE_URI },
      [RESOURCE_URI_META_KEY]: RESOURCE_URI,
    });
    expect(listedTool._meta).toEqual(called._meta);
  });

  it('resolves a conflict in execute() metadata in favour of the nested resource URI', async () => {
    const server = makeServer({
      calculator: {
        description: 'A tool returning two different resource URIs',
        parameters: z.object({}),
        execute: async () => ({
          value: 42,
          _meta: {
            ui: { resourceUri: 'ui://calculator/fresh' },
            [RESOURCE_URI_META_KEY]: 'ui://calculator/stale',
          },
        }),
      },
    } as ToolsInput);

    const result = await callTool(server, 'calculator');

    expect(result._meta).toEqual({
      ui: { resourceUri: 'ui://calculator/fresh' },
      [RESOURCE_URI_META_KEY]: 'ui://calculator/fresh',
    });
  });

  it('keeps the call result `_meta` consistent with what tools/list advertises', async () => {
    const server = makeServer({
      calculator: {
        description: 'An app tool',
        parameters: z.object({}),
        execute: async () => ({ value: 42 }),
        mcp: { _meta: { ui: { resourceUri: RESOURCE_URI } } },
      },
    } as ToolsInput);

    const listed = await listTools(server);
    const listedTool = listed.tools.find((tool: { name: string }) => tool.name === 'calculator');
    const called = await callTool(server, 'calculator');

    expect(listedTool._meta).toEqual(called._meta);
  });
});
