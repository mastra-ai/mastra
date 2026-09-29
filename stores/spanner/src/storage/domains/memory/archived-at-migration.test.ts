import { Spanner } from '@google-cloud/spanner';
import { TABLE_THREADS } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SpannerStore } from '../../index';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const PROJECT_ID = process.env.SPANNER_PROJECT_ID || 'test-project';
const INSTANCE_ID = process.env.SPANNER_INSTANCE_ID || 'test-instance';
const EMULATOR_HOST = process.env.SPANNER_EMULATOR_HOST || 'localhost:9010';
const DATABASE_ID = `db-archmig-${Math.floor(Date.now() / 1000) % 100000}`;

const spannerOptions = {
  servicePath: EMULATOR_HOST.split(':')[0],
  port: Number(EMULATOR_HOST.split(':')[1] ?? 9010),
  sslCreds: undefined,
};

describe.runIf(process.env.ENABLE_TESTS === 'true')('Spanner archivedAt migration', () => {
  let client: Spanner;
  let store: SpannerStore;
  let memory: MemoryStorage;

  const columnNames = async () => {
    const [rows] = await client
      .instance(INSTANCE_ID)
      .database(DATABASE_ID)
      .run({
        sql: `SELECT column_name FROM information_schema.columns WHERE table_name = @t`,
        params: { t: TABLE_THREADS },
        json: true,
      });
    return (rows as Array<{ column_name: string }>).map(r => r.column_name);
  };

  beforeAll(async () => {
    process.env.SPANNER_EMULATOR_HOST = EMULATOR_HOST;
    client = new Spanner({ projectId: PROJECT_ID, ...spannerOptions });
    const instance = client.instance(INSTANCE_ID);
    const [instanceExists] = await instance.exists();
    if (!instanceExists) {
      const [, op] = await client.createInstance(INSTANCE_ID, { config: 'emulator-config', nodes: 1 });
      await (op as any).promise();
    }

    // A threads table as it existed before archiving support.
    const [, op] = await instance.createDatabase(DATABASE_ID, {
      extraStatements: [
        `CREATE TABLE ${TABLE_THREADS} (
          id STRING(MAX) NOT NULL,
          resourceId STRING(MAX) NOT NULL,
          title STRING(MAX),
          metadata JSON,
          createdAt TIMESTAMP NOT NULL,
          updatedAt TIMESTAMP NOT NULL
        ) PRIMARY KEY (id)`,
      ],
    });
    await (op as any).promise();
    await instance.database(DATABASE_ID).runTransactionAsync(async tx => {
      await tx.runUpdate({
        sql: `INSERT INTO ${TABLE_THREADS} (id, resourceId, title, metadata, createdAt, updatedAt)
                VALUES ('legacy-thread', 'legacy-resource', 'Legacy', JSON '{}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())`,
      });
      await tx.commit();
    });
    expect(await columnNames()).not.toContain('archivedAt');

    store = new SpannerStore({
      id: 'spanner-archived-migration',
      projectId: PROJECT_ID,
      instanceId: INSTANCE_ID,
      databaseId: DATABASE_ID,
      spannerOptions,
    });
    await store.init();
    memory = (await store.getStore('memory'))!;
  });

  afterAll(async () => {
    await store?.close();
    await client?.instance(INSTANCE_ID).database(DATABASE_ID).delete();
    client?.close();
  });

  it('adds the archivedAt column and reads legacy rows as non-archived', async () => {
    expect(await columnNames()).toContain('archivedAt');

    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(thread?.archivedAt ?? null).toBeNull();

    const { threads } = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(threads.map(t => t.id)).toEqual(['legacy-thread']);
  });
});
