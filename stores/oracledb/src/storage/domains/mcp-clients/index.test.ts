import { describe, expect, it, vi } from 'vitest';

import { MCPClientsOracle } from '.';

function createMCPClientsOracle(): MCPClientsOracle {
  return new MCPClientsOracle({ poolManager: {} as any });
}

describe('MCPClientsOracle pagination tie-breaker', () => {
  it('adds an id ASC tie-breaker to the MCP clients list ORDER BY', async () => {
    const mcpClients = createMCPClientsOracle();
    let capturedSql = '';
    const oneOrNone = vi.fn(async () => ({ count: 1 }));
    const manyOrNone = vi.fn(async (sql: string) => {
      capturedSql = sql;
      return [];
    });
    (mcpClients as any).db = { oneOrNone, manyOrNone };

    await mcpClients.list();

    expect(capturedSql).toMatch(/ORDER BY .*, id ASC OFFSET/);
  });

  it('adds an id ASC tie-breaker to the MCP client versions list ORDER BY', async () => {
    const mcpClients = createMCPClientsOracle();
    let capturedSql = '';
    const oneOrNone = vi.fn(async () => ({ count: 1 }));
    const manyOrNone = vi.fn(async (sql: string) => {
      capturedSql = sql;
      return [];
    });
    (mcpClients as any).db = { oneOrNone, manyOrNone };

    await mcpClients.listVersions({ mcpClientId: 'mcp-client-1' });

    expect(capturedSql).toMatch(/ORDER BY .*, id ASC OFFSET/);
  });
});
