import { createRunsTableUpgradeTests } from '@internal/storage-test-utils';
import { afterAll, describe } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

describe('Postgres storage v2 runs table from an earlier alpha', () => {
  const schemaName = `runs_upgrade_${Date.now()}`;
  const stores: PostgresStore[] = [];

  afterAll(async () => {
    await stores[0]?.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await Promise.all(stores.map(store => store.close()));
  });

  createRunsTableUpgradeTests({
    openStore: async () => {
      const store = new PostgresStore({ ...TEST_CONFIG, id: `runs-upgrade-${stores.length}`, schemaName });
      stores.push(store);
      await store.init();
      return (await store.getStore('workflows'))!;
    },
    dropStateColumns: async () => {
      await stores[0]!.db.none(
        `ALTER TABLE "${schemaName}".mastra_workflow_runs
           DROP COLUMN "stateSeq", DROP COLUMN "statePatchCount", DROP COLUMN "statePatchBytes", DROP COLUMN "stateBytes"`,
      );
    },
  });
});
