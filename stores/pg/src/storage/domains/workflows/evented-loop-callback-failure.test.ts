import { afterAll, beforeAll, describe, expect } from 'vitest';
import { PostgresStore } from '../..';
import { describeLoopCallbackFailures } from '../../../../../../packages/core/src/workflows/evented/test-utils/loop-callback-failure-cases';
import { TEST_CONFIG } from '../../test-utils';

// Step guards move loop-condition evaluation to the guarded completion path (COR-1466).
describe('Postgres evented loop callback failures', () => {
  const schemaName = `loop_callback_${Date.now()}`;
  const storage = new PostgresStore({ ...TEST_CONFIG, id: 'loop-callback', schemaName });
  beforeAll(async () => {
    await storage.init();
    expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
  });
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  describeLoopCallbackFailures({ getStorage: () => storage });
});
