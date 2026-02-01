/**
 * Test the workflow test factory with the evented engine
 */

import { createWorkflowTestSuite } from './factory';
import { createWorkflow, createStep } from '@mastra/core/workflows/evented';
import type { Workflow } from '@mastra/core/workflows';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { EventEmitterPubSub } from '@mastra/core/events';
import type { WorkflowResult, ResumeWorkflowOptions, TimeTravelWorkflowOptions } from './types';
import { vi } from 'vitest';

// Shared storage instance
const testStorage = new MockStore();

createWorkflowTestSuite({
  name: 'Workflow (Evented Engine)',

  getWorkflowFactory: () => ({
    createWorkflow,
    createStep,
  }),

  // Skip restart domain - restart() is not supported on evented workflows
  skip: {
    restart: true,
  },

  // Provide access to storage for tests that need to spy on storage operations
  getStorage: () => testStorage,

  beforeEach: async () => {
    // Don't reset mocks - they're created at describe time and need to persist
    // vi.resetAllMocks();
    const workflowsStore = await testStorage.getStore('workflows');
    await workflowsStore?.dangerouslyClearAll();
  },

  // Skip only tests that actually fail - verified by running without skips
  skipTests: {
    // State management - state not properly propagated in evented engine
    state: true,

    // Error handling differences
    errorIdentity: true, // Error properties lost in serialization
    schemaValidationThrows: true, // Different validation behavior

    // Abort behavior
    abortStatus: true, // Returns 'failed' not 'canceled'
    abortDuringStep: true, // 5s timeout waiting for abort signal

    // Foreach
    emptyForeach: true, // Empty array causes timeout
    foreachPartialConcurrencyTiming: true, // Timing assertions are flaky in evented engine

    // Resume tests - verified after core rebuild
    // These now pass after rebuild:
    resumeWithLabel: false,
    resumeWithState: false,
    resumeAutoDetect: false,
    resumeForeach: false,
    resumeForeachConcurrent: false,
    // These still have issues:
    resumeNested: true, // Still suspended after resume
    resumeBranchingStatus: true, // branch-step-2 is undefined
    resumeLoopInput: true, // Timeout - loop resume not working
    resumeForeachIndex: true, // Wrong status - forEachIndex resume broken
    resumeParallelMulti: true, // Only one parallel step getting suspended path
    resumeMultiSuspendError: true, // Only 1 suspended step found, expects >1

    // Storage
    storageWithNestedWorkflows: true, // Different nested step naming

    // Callbacks
    callbackResourceId: true, // resourceId not passed to callbacks

    // Validation - evented throws different errors
    executionFlowNotDefined: true,
    executionGraphNotCommitted: true,

    // Time travel conditional - different result structure
    timeTravelConditional: true,
  },

  executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
    // Create a fresh Mastra instance for each test execution
    // This ensures proper isolation between tests
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });

    try {
      // Start the event engine
      await mastra.startEventEngine();

      // Create the run and execute
      const run = await workflow.createRun({ runId: options.runId, resourceId: options.resourceId });
      const result = await run.start({
        inputData,
        initialState: options.initialState,
        perStep: options.perStep,
        requestContext: options.requestContext as any,
      });

      return result as WorkflowResult;
    } finally {
      // Always stop the event engine
      await mastra.stopEventEngine();
    }
  },

  resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
    // Create a fresh Mastra instance with the same storage
    // This allows us to resume workflows from persisted state
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });

    try {
      // Start the event engine
      await mastra.startEventEngine();

      // Get the workflow run by ID
      const run = await workflow.createRun({ runId: options.runId });

      // Resume with the provided options
      const result = await run.resume({
        resumeData: options.resumeData,
        step: options.step,
        label: options.label,
      } as any);

      return result as WorkflowResult;
    } finally {
      // Always stop the event engine
      await mastra.stopEventEngine();
    }
  },

  timetravelWorkflow: async (workflow, options: TimeTravelWorkflowOptions): Promise<WorkflowResult> => {
    // Create a fresh Mastra instance with the same storage
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });

    try {
      // Start the event engine
      await mastra.startEventEngine();

      // Create a run and use timeTravel API
      const run = await workflow.createRun({ runId: options.runId });

      const result = await run.timeTravel({
        step: options.step as any,
        context: options.context as any,
        perStep: options.perStep,
      });

      return result as WorkflowResult;
    } finally {
      // Always stop the event engine
      await mastra.stopEventEngine();
    }
  },
});
