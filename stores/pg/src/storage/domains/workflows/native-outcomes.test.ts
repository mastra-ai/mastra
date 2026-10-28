import { afterAll, describe, expect } from 'vitest';
import { PostgresStore } from '../..';
import {
  createControlFlowOutcomeTests,
  createEventedCancelCompletionRaceTests,
  createEventedRemoteTracingTests,
  createEventedNestedDispatchCancellationTests,
  createEventedStaleTerminationTests,
  createConcurrentBranchOutcomeTests,
  createGuardedLoopReplayOutcomeTests,
  createNestedForeachResumeOutcomeTests,
} from '../../../../../../observability/mastra/src/test-utils/workflow-control-flow-suite';
import { TEST_CONFIG } from '../../test-utils';

describe('Postgres guarded workflow native outcomes', () => {
  const schemaName = `native_outcomes_${Date.now()}`;
  const admin = new PostgresStore({ ...TEST_CONFIG, id: 'native-outcomes-cleanup', schemaName });
  let counter = 0;

  const createStorage = async () => {
    const store = new PostgresStore({ ...TEST_CONFIG, id: `native-outcomes-${counter++}`, schemaName });
    await store.init();
    expect((await store.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
    return store;
  };
  createControlFlowOutcomeTests({ engines: ['evented', 'evented-async'], createStorage });
  createEventedRemoteTracingTests(createStorage);
  createEventedNestedDispatchCancellationTests(createStorage);
  createEventedStaleTerminationTests(createStorage);
  createEventedCancelCompletionRaceTests(createStorage);
  createConcurrentBranchOutcomeTests({ engines: ['evented', 'evented-async'], createStorage });
  createGuardedLoopReplayOutcomeTests(createStorage);
  createNestedForeachResumeOutcomeTests({ createStorage, engines: ['evented', 'evented-async'] });

  afterAll(async () => {
    await admin.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await admin.close();
  });
});
