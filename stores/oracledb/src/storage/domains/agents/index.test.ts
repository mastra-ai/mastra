import { describe, expect, it, vi } from 'vitest';

import { AgentsOracle } from '.';

function createAgentsOracle(): AgentsOracle {
  return new AgentsOracle({ poolManager: {} as any });
}

describe('AgentsOracle pagination tie-breaker', () => {
  it('keeps the id ASC tie-breaker in the agents list ORDER BY', async () => {
    const agents = createAgentsOracle();
    let capturedSql = '';
    const oneOrNone = vi.fn(async () => ({ count: 1 }));
    const manyOrNone = vi.fn(async (sql: string) => {
      capturedSql = sql;
      return [];
    });
    (agents as any).db = { oneOrNone, manyOrNone };

    await agents.list();

    expect(capturedSql).toMatch(/ORDER BY .*a\.id ASC OFFSET/);
  });

  it('adds an id ASC tie-breaker to the agent versions list ORDER BY', async () => {
    const agents = createAgentsOracle();
    let capturedSql = '';
    const oneOrNone = vi.fn(async () => ({ count: 1 }));
    const manyOrNone = vi.fn(async (sql: string) => {
      capturedSql = sql;
      return [];
    });
    (agents as any).db = { oneOrNone, manyOrNone };

    await agents.listVersions({ agentId: 'agent-1' });

    expect(capturedSql).toMatch(/ORDER BY .*, id ASC OFFSET/);
  });
});
