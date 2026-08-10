import { describe, expect, it, vi } from 'vitest';

import { ScorerDefinitionsOracle } from '.';

function createScorerDefinitionsOracle(): ScorerDefinitionsOracle {
  return new ScorerDefinitionsOracle({ poolManager: {} as any });
}

describe('ScorerDefinitionsOracle pagination tie-breaker', () => {
  it('adds an id ASC tie-breaker to the scorer definitions list ORDER BY', async () => {
    const scorerDefinitions = createScorerDefinitionsOracle();
    let capturedSql = '';
    const oneOrNone = vi.fn(async () => ({ count: 1 }));
    const manyOrNone = vi.fn(async (sql: string) => {
      capturedSql = sql;
      return [];
    });
    (scorerDefinitions as any).db = { oneOrNone, manyOrNone };

    await scorerDefinitions.list();

    expect(capturedSql).toMatch(/ORDER BY .*, id ASC OFFSET/);
  });

  it('adds an id ASC tie-breaker to the scorer definition versions list ORDER BY', async () => {
    const scorerDefinitions = createScorerDefinitionsOracle();
    let capturedSql = '';
    const oneOrNone = vi.fn(async () => ({ count: 1 }));
    const manyOrNone = vi.fn(async (sql: string) => {
      capturedSql = sql;
      return [];
    });
    (scorerDefinitions as any).db = { oneOrNone, manyOrNone };

    await scorerDefinitions.listVersions({ scorerDefinitionId: 'scorer-1' });

    expect(capturedSql).toMatch(/ORDER BY .*, id ASC OFFSET/);
  });
});
