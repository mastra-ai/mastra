import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe } from 'vitest';
import { LibSQLStore } from '../..';
import { describeNestedRestartCases } from '../../../../../../packages/core/src/workflows/test-utils/nested-restart-cases';

// A real file database, which stores snapshots as JSON: an `undefined` value doesn't survive it.
describe('LibSQL nested workflow restart', () => {
  let dir: string;
  let count = 0;
  const open: LibSQLStore[] = [];
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-nested-restart-'));
  });
  afterEach(async () => {
    await Promise.all(open.splice(0).map(storage => storage.close?.()));
  });
  afterAll(async () => {
    // A crashed run's parked write can keep a connection to its file open, which Windows won't
    // let go of. The directory is under the OS temp dir, so a failed cleanup is left to it.
    await rm(dir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  });

  describeNestedRestartCases({
    createStorage: async () => {
      const storage = new LibSQLStore({ id: 'nested-restart', url: `file:${join(dir, `runs-${++count}.db`)}` });
      await storage.init();
      open.push(storage);
      return storage;
    },
  });
});
