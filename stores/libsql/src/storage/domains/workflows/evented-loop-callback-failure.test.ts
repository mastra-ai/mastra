import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import { LibSQLStore } from '../..';
import { describeLoopCallbackFailures } from '../../../../../../packages/core/src/workflows/evented/test-utils/loop-callback-failure-cases';

// Step guards move loop-condition evaluation to the guarded completion path (COR-1466).
describe('LibSQL evented loop callback failures', () => {
  let dir: string;
  let storage: LibSQLStore;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-loop-callback-'));
    storage = new LibSQLStore({ id: 'loop-callback', url: `file:${join(dir, 'runs.db')}` });
    await storage.init();
    expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
  });
  afterAll(async () => {
    await storage.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  });

  describeLoopCallbackFailures({ getStorage: () => storage });
});
