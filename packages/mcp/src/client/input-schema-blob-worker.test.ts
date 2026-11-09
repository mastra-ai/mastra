import type { Client } from '@modelcontextprotocol/client';
import { afterAll, describe, expect, it, vi } from 'vitest';

// A browser worker created from a blob URL reports its full URL as `location.pathname`.
// `@cfworker/json-schema` turns that into an invalid URL as soon as it is imported, so this must be
// in place before `./client` is loaded.
vi.hoisted(() => {
  const location = { origin: 'http://localhost:5173', pathname: 'http://localhost:5173/abc', search: '' };
  vi.stubGlobal('self', { location });
  vi.stubGlobal('location', location);
});

import { InternalMastraMCPClient } from './client';
import { MALFORMED_INPUT_SCHEMAS, VALID_INPUT_SCHEMAS } from './input-schema-test-cases';

afterAll(() => {
  vi.unstubAllGlobals();
});

function createClientWithTools(tools: unknown[]) {
  const client = new InternalMastraMCPClient({
    name: 'blob-worker-server',
    server: { url: new URL('http://localhost:1/mcp') },
  });
  vi.spyOn((client as any).client as Client, 'listTools').mockResolvedValue({ tools } as any);
  const warn = vi.spyOn((client as any).logger, 'warn');
  return { client, warn };
}

const validTool = { name: 'get_candles', inputSchema: { type: 'object', properties: { coin: { type: 'string' } } } };

describe('InternalMastraMCPClient in a blob worker location (cf-worker validator cannot load)', () => {
  it('skips the reporter tool and keeps its sibling', async () => {
    const { client, warn } = createClientWithTools([
      validTool,
      { name: 'get_l2_book', inputSchema: { type: 'object', properties: { required: ['coin'] } } },
    ]);

    expect(Object.keys(await client.tools())).toEqual(['get_candles']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping MCP tool "get_l2_book"'),
      expect.objectContaining({ reason: '#/properties/required: must be a JSON Schema object or boolean' }),
    );
  });

  it.each(MALFORMED_INPUT_SCHEMAS)('skips a tool with a %s input schema', async (_, inputSchema) => {
    const { client } = createClientWithTools([validTool, { name: 'bad', inputSchema }]);

    expect(Object.keys(await client.tools())).toEqual(['get_candles']);
  });

  it.each(VALID_INPUT_SCHEMAS)('keeps a tool whose input schema uses %s', async (_, inputSchema) => {
    const { client, warn } = createClientWithTools([{ name: 'ok', inputSchema }]);

    expect(Object.keys(await client.tools())).toEqual(['ok']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('rejects explicit hydration of an invalid definition', () => {
    const { client } = createClientWithTools([]);

    expect(() =>
      client.toolFromDefinition({
        definition: {
          name: 'bad',
          inputSchema: { type: 'object', properties: { required: ['coin'] } },
          server: { name: 'blob-worker-server' },
        } as any,
      }),
    ).toThrow(expect.objectContaining({ id: 'MCP_CLIENT_INVALID_TOOL_INPUT_SCHEMA' }));
  });
});
