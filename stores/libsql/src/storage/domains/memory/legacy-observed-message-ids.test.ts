import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../index';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('LibSQL observational memory on a database where observedMessageIds was added later', () => {
  it('reads a reflection generation back without an object in observedMessageIds', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'om-legacy-ids-'));
    dirs.push(dir);
    const url = `file:${join(dir, 'om.db')}`;
    await new LibSQLStore({ id: 'legacy-ids-setup', url }).init();

    // Databases created before `observedMessageIds` existed gained it through an older migration
    // that gave it a `'{}'` default. Recreate that column.
    const client = createClient({ url });
    await client.execute(`ALTER TABLE "mastra_observational_memory" DROP COLUMN "observedMessageIds"`);
    await client.execute(`ALTER TABLE "mastra_observational_memory" ADD COLUMN "observedMessageIds" TEXT DEFAULT '{}'`);

    const store = new LibSQLStore({ id: 'legacy-ids', url });
    await store.init();
    const memory = (await store.getStore('memory')) as MemoryStorage;

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

    const stored = await client.execute({
      sql: `SELECT "observedMessageIds" FROM "mastra_observational_memory" WHERE id = ?`,
      args: [gen1.id],
    });
    client.close();
    expect(stored.rows[0]?.observedMessageIds).toBe('{}');

    const head = await memory.getObservationalMemory('t1', 'r1');
    expect(head?.id).toBe(gen1.id);
    expect(head?.observedMessageIds).toBeUndefined();
  });
});
