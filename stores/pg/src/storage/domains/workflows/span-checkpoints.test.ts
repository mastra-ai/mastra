import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { afterAll, beforeAll, describe } from 'vitest';
import { PostgresStore } from '../..';
import { createWorkflowSpanCheckpointTests } from '../../../../../_test-utils/src/domains/workflows/span-checkpoints';
import { TEST_CONFIG } from '../../test-utils';

for (const columnType of ['jsonb', 'json', 'text'] as const) {
  describe(`checkpoint persistence with ${columnType} snapshots`, () => {
    const schemaName = `span_checkpoints_${columnType}_${Date.now()}`;
    const admin = new PostgresStore({ ...TEST_CONFIG, id: 'checkpoint-cleanup', schemaName });
    beforeAll(async () => {
      await admin.init();
      if (columnType !== 'jsonb') {
        const indexes = await admin.db.manyOrNone<{ name: string }>(
          `SELECT i.relname AS name FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
           JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
           WHERE n.nspname = $1 AND t.relname = $2 AND x.indexprs IS NOT NULL`,
          [schemaName, TABLE_WORKFLOW_SNAPSHOT],
        );
        for (const index of indexes) await admin.db.none(`DROP INDEX "${schemaName}"."${index.name}"`);
        await admin.db.none(
          `ALTER TABLE "${schemaName}"."${TABLE_WORKFLOW_SNAPSHOT}" ALTER COLUMN snapshot TYPE ${columnType} USING snapshot::${columnType}`,
        );
      }
    });
    createWorkflowSpanCheckpointTests(async () => {
      // A new connection also verifies the actual legacy column type, without an init-time cache.
      const store = new PostgresStore({ ...TEST_CONFIG, id: 'checkpoint-test', schemaName });
      await store.init();
      return store;
    });
    afterAll(async () => {
      await admin.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await admin.close();
    });
  });
}
