import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import { LibSQLStore } from '../..';
import { describeFinishedOccurrenceCases } from '../../../../../../packages/core/src/workflows/evented/test-utils/finished-occurrence-cases';

// LibSQL arbitrates some late deliveries through its workflow step guards (#28712, COR-1596).
describe('LibSQL evented finished step deliveries', () => {
  let dir: string;
  let url: string;
  let storage: LibSQLStore;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-finished-occurrence-'));
    url = `file:${join(dir, 'runs.db')}`;
    storage = new LibSQLStore({ id: 'finished-occurrence', url });
    await storage.init();
    expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
  });
  afterAll(async () => {
    await storage.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  });

  // Each replica opens its own client on the same file, as separate pods share one database.
  describeFinishedOccurrenceCases({
    getStorage: () => storage,
    stepGuards: true,
    connect: async () => {
      const replica = new LibSQLStore({ id: 'finished-occurrence', url });
      await replica.init();
      return replica;
    },
  });
});
