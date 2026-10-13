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

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('InternalMastraMCPClient in a blob worker location', () => {
  it('loads and still lists tools when the schema validator cannot be imported', async () => {
    const client = new InternalMastraMCPClient({
      name: 'blob-worker-server',
      server: { url: new URL('http://localhost:1/mcp') },
    });
    vi.spyOn((client as any).client as Client, 'listTools').mockResolvedValue({
      tools: [
        { name: 'get_candles', inputSchema: { type: 'object', properties: { coin: { type: 'string' } } } },
        { name: 'get_l2_book', inputSchema: { type: 'object', properties: { required: ['coin'] } } as any },
      ],
    });

    // Without the validator the schema is left to call-time validation, as before the check existed.
    expect(Object.keys(await client.tools())).toEqual(['get_candles', 'get_l2_book']);
  });
});
