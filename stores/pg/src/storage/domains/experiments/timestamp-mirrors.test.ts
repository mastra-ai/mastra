import { describe, expect, it, vi } from 'vitest';

import { ExperimentsPG } from '.';

// Every timestamp column has a timezone-aware `"<column>Z"` mirror created with
// `DEFAULT NOW()` (see db/index.ts). Reads prefer the mirror, so a write that
// sets `startedAt`/`completedAt` without the mirror makes the row read back as
// "started and completed at insert time" — i.e. a zero-duration result.
const startedAt = new Date('2026-09-07T10:00:00.000Z');
const completedAt = new Date('2026-09-07T10:02:30.000Z');

const resultRow = {
  id: 'result-1',
  experimentId: 'experiment-1',
  itemId: 'item-1',
  itemDatasetVersion: 1,
  startedAt,
  completedAt,
  startedAtZ: startedAt,
  completedAtZ: completedAt,
  createdAt: new Date('2026-09-07T10:00:00.000Z'),
  createdAtZ: new Date('2026-09-07T10:00:00.000Z'),
};

function highestPlaceholder(sql: string) {
  return Math.max(...[...(sql.match(/\$(\d+)/g) ?? [])].map(match => Number(match.slice(1))));
}

function assertBindingsMatchPlaceholders(sql: string, params: unknown[]) {
  const placeholders = sql.match(/\$\d+/g) ?? [];
  expect(new Set(placeholders).size).toBe(highestPlaceholder(sql));
  expect(params.length).toBe(highestPlaceholder(sql));
}

function createUpsertHarness(existingRow: { id: string } | null) {
  const oneOrNone = vi.fn().mockResolvedValueOnce({ datasetId: null }).mockResolvedValueOnce(existingRow);
  const one = vi.fn(async (sql: string, params: unknown[]) => {
    assertBindingsMatchPlaceholders(sql, params);
    return existingRow ? { ...resultRow, id: existingRow.id } : resultRow;
  });
  const client = { tx: vi.fn(async callback => callback({ oneOrNone, one })) };
  return { experiments: new ExperimentsPG({ client: client as never }), one };
}

describe('ExperimentsPG timestamp mirror columns', () => {
  it('writes startedAtZ/completedAtZ when adding a result', async () => {
    const one = vi.fn(async (sql: string, params: unknown[]) => {
      assertBindingsMatchPlaceholders(sql, params);
      return resultRow;
    });
    const oneOrNone = vi.fn().mockResolvedValueOnce({ datasetId: null });
    const client = { tx: vi.fn(async callback => callback({ oneOrNone, one })) };
    const experiments = new ExperimentsPG({ client: client as never });

    const result = await experiments.addExperimentResult({
      experimentId: 'experiment-1',
      itemId: 'item-1',
      input: { prompt: 'hi' },
      output: { text: 'hello' },
      startedAt,
      completedAt,
      retryCount: 0,
      attempt: 0,
    } as never);

    const [sql, params] = one.mock.calls[0]!;
    expect(sql).toContain('"startedAtZ"');
    expect(sql).toContain('"completedAtZ"');
    const values = params as string[];
    expect(values.filter(value => value === startedAt.toISOString())).toHaveLength(2);
    expect(values.filter(value => value === completedAt.toISOString())).toHaveLength(2);
    expect(result.startedAt).toEqual(startedAt);
  });

  it('writes the mirrors when upserting a new result', async () => {
    const { experiments, one } = createUpsertHarness(null);

    await experiments.upsertExperimentResult({
      experimentId: 'experiment-1',
      itemId: 'item-1',
      startedAt,
      completedAt,
      retryCount: 0,
      attempt: 0,
    } as never);

    const [sql, params] = one.mock.calls[0]!;
    expect(sql).toContain('"startedAtZ"');
    expect(sql).toContain('"completedAtZ"');
    const values = params as string[];
    expect(values.filter(value => value === startedAt.toISOString())).toHaveLength(2);
    expect(values.filter(value => value === completedAt.toISOString())).toHaveLength(2);
  });

  it('writes the mirrors when upserting over an existing result', async () => {
    const { experiments, one } = createUpsertHarness({ id: 'result-1' });

    await experiments.upsertExperimentResult({
      experimentId: 'experiment-1',
      itemId: 'item-1',
      startedAt,
      completedAt,
      retryCount: 1,
      attempt: 1,
    } as never);

    const [sql] = one.mock.calls[0]!;
    expect(sql).toContain('"startedAtZ" = $18');
    expect(sql).toContain('"completedAtZ" = $19');
  });

  it('writes the mirrors when an experiment starts and finishes', async () => {
    const updatedRow = {
      id: 'experiment-1',
      status: 'completed',
      totalItems: 1,
      succeededCount: 1,
      failedCount: 0,
      skippedCount: 0,
      startedAt,
      completedAt,
      startedAtZ: startedAt,
      completedAtZ: completedAt,
      createdAt: startedAt,
      createdAtZ: startedAt,
      updatedAt: completedAt,
      updatedAtZ: completedAt,
    };
    const none = vi.fn(async (sql: string, params: unknown[]) => {
      assertBindingsMatchPlaceholders(sql, params);
    });
    const one = vi.fn(async () => updatedRow);
    const oneOrNone = vi.fn(async () => ({
      id: 'experiment-1',
      status: 'running',
      totalItems: 1,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      startedAtZ: null,
      completedAtZ: null,
      createdAtZ: startedAt,
      updatedAtZ: startedAt,
    }));
    const client = { none, one, oneOrNone };
    const experiments = new ExperimentsPG({ client: client as never });

    const experiment = await experiments.updateExperiment({
      id: 'experiment-1',
      status: 'completed',
      startedAt,
      completedAt,
    });

    const [sql, params] = none.mock.calls[0]!;
    // A timestamp column and its timestamptz mirror need distinct placeholders:
    // Postgres rejects reusing one parameter for both types ("inconsistent types
    // deduced for parameter").
    for (const column of ['startedAt', 'completedAt']) {
      const pair = sql.match(new RegExp(`"${column}" = \\$(\\d+), "${column}Z" = \\$(\\d+)`));
      expect(pair).not.toBeNull();
      expect(pair![1]).not.toBe(pair![2]);
    }
    const values = params as unknown[];
    expect(values.filter(value => value === startedAt.toISOString())).toHaveLength(2);
    expect(values.filter(value => value === completedAt.toISOString())).toHaveLength(2);
    expect(experiment).not.toBeNull();
  });
});
