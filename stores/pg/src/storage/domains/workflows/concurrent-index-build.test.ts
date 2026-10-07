import { randomUUID } from 'node:crypto';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { Client } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresStore } from '../../index';
import { workflowSnapshotStatusIndexName, workflowSnapshotThreadIdIndexName } from './index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

/**
 * init() builds the workflow snapshot expression indexes on a table that other processes may
 * be writing to (for example the previous release during a rolling deploy). The build must
 * not lock those writers out while it waits for or scans existing rows.
 */
describe('workflow snapshot expression index build on an existing table', () => {
  const schemaName = `wf_concurrent_idx_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const table = `"${schemaName}".${TABLE_WORKFLOW_SNAPSHOT}`;
  const indexNames = [workflowSnapshotStatusIndexName(schemaName), workflowSnapshotThreadIdIndexName(schemaName)];
  let admin: Client;

  const insertRunSQL = `INSERT INTO ${table} (workflow_name, run_id, snapshot, "createdAt", "updatedAt")
    VALUES ($1, $2, '{"status":"running","context":{}}'::jsonb, now(), now())`;

  const connect = async () => {
    const client = new Client({ connectionString });
    await client.connect();
    return client;
  };

  beforeAll(async () => {
    const seed = new PostgresStore({ id: 'wf-concurrent-idx-seed', connectionString, schemaName });
    await seed.init();
    await seed.close();

    admin = await connect();
    for (const name of indexNames) {
      await admin.query(`DROP INDEX "${schemaName}"."${name}"`);
    }
    await admin.query(insertRunSQL, ['existing', randomUUID()]);
  }, 60000);

  afterAll(async () => {
    await admin?.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await admin?.end();
  });

  it('keeps the table writable while init waits to build the indexes, and leaves them valid', async () => {
    const openWriter = await connect();
    const lateWriter = await connect();
    const store = new PostgresStore({ id: 'wf-concurrent-idx-store', connectionString, schemaName });

    try {
      // A writer with an open transaction: the index build has to wait for it to finish.
      await openWriter.query('BEGIN');
      await openWriter.query(insertRunSQL, ['open-writer', randomUUID()]);

      const init = store.init();

      let waitingOnBuild = false;
      for (let attempt = 0; attempt < 100 && !waitingOnBuild; attempt++) {
        const { rowCount } = await admin.query(
          `SELECT 1 FROM pg_stat_activity WHERE query LIKE 'CREATE INDEX%' AND query LIKE $1`,
          [`%${indexNames[0]}%`],
        );
        waitingOnBuild = (rowCount ?? 0) > 0;
        if (!waitingOnBuild) await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(waitingOnBuild).toBe(true);

      // A writer arriving while the build waits must not queue behind it.
      await lateWriter.query(`SET lock_timeout = '2s'`);
      await expect(lateWriter.query(insertRunSQL, ['late-writer', randomUUID()])).resolves.toMatchObject({
        rowCount: 1,
      });

      await openWriter.query('COMMIT');
      await init;

      const { rows } = await admin.query<{ indexname: string; indisvalid: boolean }>(
        `SELECT c.relname AS indexname, i.indisvalid
           FROM pg_index i
           JOIN pg_class c ON c.oid = i.indexrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = ANY($2)
          ORDER BY c.relname`,
        [schemaName, indexNames],
      );
      expect(rows).toEqual([...indexNames].sort().map(indexname => ({ indexname, indisvalid: true })));
    } finally {
      await openWriter.query('ROLLBACK').catch(() => {});
      await openWriter.end();
      await lateWriter.end();
      await store.close();
    }
  }, 60000);
});
