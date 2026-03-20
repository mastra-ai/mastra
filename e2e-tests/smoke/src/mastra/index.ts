import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { sequentialSteps, schemaValidation, mapBetweenSteps } from './workflows/basic.js';
import {
  branchWorkflow,
  parallelWorkflow,
  dowhileWorkflow,
  dountilWorkflow,
  foreachWorkflow,
} from './workflows/control-flow.js';
import { basicSuspend, parallelSuspend, loopSuspend } from './workflows/suspend-resume.js';
import { statefulWorkflow, initialStateWorkflow } from './workflows/state.js';
import { innerWorkflow, outerWorkflow } from './workflows/nested.js';
import { retryWorkflow, failureWorkflow, cancelableWorkflow } from './workflows/error-handling.js';
import { sleepWorkflow } from './workflows/sleep.js';

export const mastra = new Mastra({
  workflows: {
    'sequential-steps': sequentialSteps,
    'schema-validation': schemaValidation,
    'map-between-steps': mapBetweenSteps,
    'branch-workflow': branchWorkflow,
    'parallel-workflow': parallelWorkflow,
    'dowhile-workflow': dowhileWorkflow,
    'dountil-workflow': dountilWorkflow,
    'foreach-workflow': foreachWorkflow,
    'basic-suspend': basicSuspend,
    'parallel-suspend': parallelSuspend,
    'loop-suspend': loopSuspend,
    'stateful-workflow': statefulWorkflow,
    'initial-state': initialStateWorkflow,
    'inner-workflow': innerWorkflow,
    'outer-workflow': outerWorkflow,
    'retry-workflow': retryWorkflow,
    'failure-workflow': failureWorkflow,
    'cancelable-workflow': cancelableWorkflow,
    'sleep-workflow': sleepWorkflow,
  },
  storage: new LibSQLStore({
    id: 'smoke-test',
    url: 'file:test.db',
  }),
});
