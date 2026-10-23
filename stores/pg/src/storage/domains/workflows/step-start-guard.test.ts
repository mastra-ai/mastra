import { createWorkflowStepGuardTests } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

// COR-1469: independent workers must not replace a committed occurrence with a stale delivery.
describe('Postgres workflow occurrence guards', () => {
  const schemaName = `step_guard_${Date.now()}`;
  const stores = ['a', 'b'].map(id => new PostgresStore({ ...TEST_CONFIG, id: `step-guard-${id}`, schemaName }));

  beforeAll(async () => {
    for (const store of stores) {
      await store.init();
      expect((await store.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
    }
  });
  afterAll(async () => {
    await stores[0]!.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await Promise.all(stores.map(store => store.close()));
  });

  createWorkflowStepGuardTests({ storage: stores[0]!, peerStorage: stores[1]! });
});
