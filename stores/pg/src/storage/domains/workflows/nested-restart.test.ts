import { afterAll, afterEach, describe } from 'vitest';
import { PostgresStore } from '../..';
import { describeNestedRestartCases } from '../../../../../../packages/core/src/workflows/test-utils/nested-restart-cases';
import { TEST_CONFIG } from '../../test-utils';

// Postgres stores snapshots as JSON: an `undefined` value doesn't survive it.
describe('Postgres nested workflow restart', () => {
  const prefix = `nested_restart_${Date.now()}`;
  let count = 0;
  const open: PostgresStore[] = [];
  const schemas: string[] = [];
  afterEach(async () => {
    await Promise.all(open.splice(0).map(storage => storage.close()));
  });
  afterAll(async () => {
    const admin = new PostgresStore({ ...TEST_CONFIG, id: 'nested-restart-cleanup' });
    for (const schema of schemas) await admin.db.none(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.close();
  });

  describeNestedRestartCases({
    createStorage: async () => {
      // One schema per case, so each starts from an empty store.
      const schemaName = `${prefix}_${++count}`;
      schemas.push(schemaName);
      const storage = new PostgresStore({ ...TEST_CONFIG, id: 'nested-restart', schemaName });
      await storage.init();
      open.push(storage);
      return storage;
    },
  });
});
