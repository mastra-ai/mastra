import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../index';

// `@mastra/core` versions inside this package's peer range predate `supersededBy` in
// `OBSERVATIONAL_MEMORY_TABLE_SCHEMA`. Simulate one: the adapter must still create the column.
vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  const tables = actual.OBSERVATIONAL_MEMORY_TABLE_SCHEMA as Record<string, Record<string, unknown>>;
  const olderSchema = Object.fromEntries(
    Object.entries(tables).map(([table, columns]) => {
      const { supersededBy: _omitted, ...rest } = columns;
      return [table, rest];
    }),
  );
  return { ...actual, OBSERVATIONAL_MEMORY_TABLE_SCHEMA: olderSchema };
});

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('LibSQL observational memory with a @mastra/core whose schema lacks supersededBy', () => {
  it('creates the supersededBy column and fences writes to retired generations', async () => {
    const { OBSERVATIONAL_MEMORY_TABLE_SCHEMA } = await import('@mastra/core/storage');
    expect(Object.values(OBSERVATIONAL_MEMORY_TABLE_SCHEMA)[0]).not.toHaveProperty('supersededBy');

    const dir = mkdtempSync(join(tmpdir(), 'om-older-core-'));
    dirs.push(dir);
    const url = `file:${join(dir, 'om.db')}`;
    const store = new LibSQLStore({ id: 'older-core', url });
    await store.init();
    const memory = (await store.getStore('memory')) as MemoryStorage;

    const client = createClient({ url });
    const columns = await client.execute(`PRAGMA table_info("mastra_observational_memory")`);
    client.close();
    expect(columns.rows.map(row => row.name)).toContain('supersededBy');

    const gen0 = await memory.initializeObservationalMemory({
      threadId: 't1',
      resourceId: 'r1',
      scope: 'thread',
      config: {},
    });
    const gen1 = await memory.createReflectionGeneration({
      currentRecord: gen0,
      reflection: '- reflected',
      tokenCount: 1,
    });

    await expect(
      memory.commitActiveObservations({
        id: gen0.id,
        observations: '- stale',
        tokenCount: 1,
        lastObservedAt: new Date(),
      }),
    ).resolves.toEqual({ applied: false, reason: 'retired' });
    expect((await memory.getObservationalMemory('t1', 'r1'))?.id).toBe(gen1.id);
  });
});
