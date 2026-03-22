import { Mastra } from '@mastra/core/mastra';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter } from '@mastra/observability';

import { testAgent, approvalAgent } from './agents/index.js';
import { calculatorTool, stringTool, failingTool, noInputTool, approvalTool } from './tools/index.js';
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
import { stateSuspendWorkflow, stateLoopWorkflow, stateParallelWorkflow } from './workflows/state-suspend.js';
import {
  deepInnerWorkflow,
  deepMiddleWorkflow,
  deepNestedWorkflow,
  nestedSuspendInner,
  nestedSuspendWorkflow,
} from './workflows/nested-advanced.js';
import { foreachErrorWorkflow, foreachRetryWorkflow } from './workflows/foreach-errors.js';
import { scoredWorkflow } from './workflows/scored.js';
import { testMcpServer } from './mcp/index.js';
import { uppercaseProcessor, suffixProcessor, tripwireProcessor } from './processors/index.js';
import { completenessScorer, lengthScorer } from './scorers/index.js';

const testWorkspace = new Workspace({
  id: 'test-workspace',
  name: 'Test Workspace',
  filesystem: new LocalFilesystem({ basePath: './test-workspace' }),
  skills: ['skills'],
});

// Initialize the workspace so filesystem and skills are ready.
// Wrapped in try/catch so a missing basePath doesn't crash the entire server.
try {
  await testWorkspace.init();
} catch (err) {
  console.error('[workspace] Failed to initialize:', err);
}

export const mastra = new Mastra({
  workspace: testWorkspace,
  agents: {
    'test-agent': testAgent,
    'approval-agent': approvalAgent,
  },
  mcpServers: {
    'test-mcp': testMcpServer,
  },
  tools: {
    calculator: calculatorTool,
    'string-transform': stringTool,
    'always-fails': failingTool,
    timestamp: noInputTool,
    'needs-approval': approvalTool,
  },
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
    'state-suspend-workflow': stateSuspendWorkflow,
    'state-loop-workflow': stateLoopWorkflow,
    'state-parallel-workflow': stateParallelWorkflow,
    'deep-inner-workflow': deepInnerWorkflow,
    'deep-middle-workflow': deepMiddleWorkflow,
    'deep-nested-workflow': deepNestedWorkflow,
    'nested-suspend-inner': nestedSuspendInner,
    'nested-suspend-workflow': nestedSuspendWorkflow,
    'foreach-error-workflow': foreachErrorWorkflow,
    'foreach-retry-workflow': foreachRetryWorkflow,
    'scored-workflow': scoredWorkflow,
  },
  scorers: {
    completeness: completenessScorer,
    'length-check': lengthScorer,
  },
  processors: {
    uppercase: uppercaseProcessor,
    suffix: suffixProcessor,
    'tripwire-test': tripwireProcessor,
  },
  storage: new LibSQLStore({
    id: 'smoke-test',
    url: 'file:test.db',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'smoke-test',
        exporters: [new DefaultExporter()],
      },
    },
  }),
});
