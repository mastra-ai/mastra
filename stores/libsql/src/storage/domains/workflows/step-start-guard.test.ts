import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkflowStepGuardTests } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import { LibSQLStore } from '../..';

// COR-1596: independent workers must not replace a committed occurrence with a stale delivery.
// Two stores on one database file, as workers share one database: each holds its own
// connection, so the guards are checked under the database's write lock, not this
// process's write queue.
describe('LibSQL workflow occurrence guards', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mastra-step-guard-'));
  const url = `file:${join(dir, 'runs.db')}`;
  const stores = ['a', 'b'].map(id => new LibSQLStore({ id: `step-guard-${id}`, url }));

  beforeAll(async () => {
    for (const store of stores) {
      await store.init();
      expect((await store.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
    }
  });
  afterAll(async () => {
    await Promise.all(stores.map(store => store.close()));
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  });

  createWorkflowStepGuardTests({ storage: stores[0]!, peerStorage: stores[1]! });
});
