import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe } from 'vitest';
import { LibSQLStore } from '../..';
import { describeStaleDriverCases } from '../../../../../../packages/core/src/workflows/test-utils/stale-driver-cases';

// A process that stalls past its run lease must not overwrite a run another process took over:
// LibSQL refuses its saves.
describe('LibSQL default-engine run taken over by another process', () => {
  let dir: string;
  let storage: LibSQLStore;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-stale-driver-'));
    storage = new LibSQLStore({ id: 'stale-driver', url: `file:${join(dir, 'runs.db')}` });
    await storage.init();
  });
  afterAll(async () => {
    await storage.close?.();
    // Windows can hold the file a moment after the client closes.
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  describeStaleDriverCases({ getStorage: () => storage });
});
