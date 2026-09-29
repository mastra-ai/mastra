import { TABLE_THREADS } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { OraclePoolManager } from '../../../shared/connection';
import { OracleStore } from '../../index';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const runIntegration = process.env.RUN_ORACLE_STORAGE_INTEGRATION === 'true';

describe.runIf(runIntegration)('OracleDB archivedAt migration', () => {
  const connection = {
    user: process.env.ORACLE_DATABASE_USER ?? 'mastra_test',
    password: process.env.ORACLE_DATABASE_PASSWORD ?? 'mastra_test_password',
    connectString: process.env.ORACLE_DATABASE_CONNECT_STRING ?? 'localhost:1521/FREEPDB1',
  };
  const poolManager = new OraclePoolManager(connection);
  const store = new OracleStore({ id: 'oracle-archived-migration', poolManager, skipDefaultIndexes: true });
  const threadId = `legacy-archive-${Date.now()}`;
  let memory: MemoryStorage;

  const hasArchivedAt = async () =>
    poolManager.withConnection(async conn => {
      const result = await conn.execute<{ COUNT: number }>(
        `SELECT COUNT(*) AS "COUNT" FROM user_tab_columns WHERE table_name = UPPER(:t) AND column_name = 'archivedAt'`,
        { t: TABLE_THREADS },
        { outFormat: 4002 },
      );
      return Number(result.rows?.[0]?.COUNT ?? 0) > 0;
    });

  beforeAll(async () => {
    await store.init();
    memory = (await store.getStore('memory'))!;
    // Simulate a pre-archiving schema, then write a legacy row into it.
    await poolManager.withConnection(async conn => {
      await conn.execute(`ALTER TABLE ${TABLE_THREADS} DROP COLUMN "archivedAt"`);
      await conn.execute(
        `INSERT INTO ${TABLE_THREADS} (id, "resourceId", title, metadata, "createdAt", "updatedAt")
         VALUES (:id, 'legacy-resource', 'Legacy', '{}', SYSTIMESTAMP, SYSTIMESTAMP)`,
        { id: threadId },
        { autoCommit: true },
      );
    });
    expect(await hasArchivedAt()).toBe(false);
    await memory.init();
  });

  afterAll(async () => {
    await memory?.deleteThread({ threadId }).catch(() => {});
    await store.close();
  });

  it('adds the archivedAt column and reads legacy rows as non-archived', async () => {
    expect(await hasArchivedAt()).toBe(true);

    const thread = await memory.getThreadById({ threadId });
    expect(thread?.archivedAt ?? null).toBeNull();

    const { threads } = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(threads.map(t => t.id)).toContain(threadId);
  });
});
