import { TABLE_THREADS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { OracleStore } from '.';

const runIntegration = process.env.RUN_ORACLE_STORAGE_INTEGRATION === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('OracleStore configurable schema integration', () => {
  it('creates custom memory and workflow indexes from OracleStore config', async () => {
    const suffix = Date.now();
    const threadIndexName = `IDX_ORACLE_THREADS_${suffix}`;
    const workflowIndexName = `IDX_ORACLE_WF_STATUS_${suffix}`;
    const store = new OracleStore({
      id: 'oracle-index-management-integration',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      skipDefaultIndexes: true,
      indexes: [
        {
          name: threadIndexName,
          table: TABLE_THREADS,
          columns: ["JSON_VALUE(metadata, '$.topic' RETURNING VARCHAR2(128) NULL ON ERROR)", 'createdAt DESC'],
          compress: true,
        },
        {
          name: workflowIndexName,
          table: TABLE_WORKFLOW_SNAPSHOT,
          columns: ["JSON_VALUE(snapshot, '$.status' RETURNING VARCHAR2(64) NULL ON ERROR)", 'run_id'],
        },
      ],
    });

    try {
      await store.init();
      const indexNames = await listUserIndexes(store, [threadIndexName, workflowIndexName]);
      expect(indexNames).toEqual(expect.arrayContaining([threadIndexName, workflowIndexName]));
    } finally {
      await dropIndex(store, threadIndexName);
      await dropIndex(store, workflowIndexName);
      await store.disconnect();
    }
  });
});

async function listUserIndexes(store: OracleStore, indexNames: string[]): Promise<string[]> {
  const rows = await store.db.manyOrNone<{ indexName: string }>(
    `SELECT index_name AS "indexName" FROM user_indexes WHERE index_name IN (${indexNames
      .map((_, index) => `:indexName${index}`)
      .join(', ')})`,
    Object.fromEntries(indexNames.map((indexName, index) => [`indexName${index}`, indexName])),
  );
  return rows.map(row => String(row.indexName));
}

async function dropIndex(store: OracleStore, indexName: string): Promise<void> {
  const pool = await store.getPool();
  const connection = await pool.getConnection();
  try {
    await connection.execute(`DROP INDEX "${indexName}"`);
  } catch (error) {
    if (!isMissingIndex(error)) throw error;
  } finally {
    await connection.close();
  }
}

function isMissingIndex(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorNum = 'errorNum' in error ? Number(error.errorNum) : undefined;
  if (errorNum === 1418) return true;
  const message = 'message' in error ? String(error.message) : '';
  return message.includes('ORA-01418');
}
