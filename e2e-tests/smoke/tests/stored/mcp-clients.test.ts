import { afterAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

const TEST_ID = `smoke-stored-mcp-${Date.now()}`;

describe('stored MCP clients — CRUD', () => {
  afterAll(async () => {
    await fetchApi(`/api/stored/mcp-clients/${TEST_ID}`, { method: 'DELETE' }).catch(() => {});
  });

  it('lists stored MCP clients', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/mcp-clients');
    expect(status).toBe(200);
    expect(Array.isArray(data.mcpClients)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('creates a stored MCP client (stdio)', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/mcp-clients', {
      method: 'POST',
      body: JSON.stringify({
        id: TEST_ID,
        name: 'smoke-mcp',
        servers: {
          test: { type: 'stdio', command: 'echo', args: ['hi'] },
        },
      }),
    });
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.servers.test.type).toBe('stdio');
  });

  it('gets the stored MCP client', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/mcp-clients/${TEST_ID}`);
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
  });

  it('updates the stored MCP client', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/mcp-clients/${TEST_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: 'updated by smoke' }),
    });
    expect(status).toBe(200);
    expect(data.description).toBe('updated by smoke');
  });

  it('deletes the stored MCP client', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/mcp-clients/${TEST_ID}`, {
      method: 'DELETE',
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 404 for deleted stored MCP client', async () => {
    const res = await fetchApi(`/api/stored/mcp-clients/${TEST_ID}`);
    expect(res.status).toBe(404);
  });
});
