/**
 * Test the workflow test factory with the evented engine
 */

import { createWorkflowTestSuite } from './factory';
import { createWorkflow, createStep } from '@mastra/core/workflows/evented';
import type { Workflow } from '@mastra/core/workflows';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { EventEmitterPubSub } from '@mastra/core/events';
import type { WorkflowResult, ResumeWorkflowOptions } from './types';
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

  // Skip specific tests for features not yet fully implemented in evented engine
  skipTests: {
    // State management is work in progress
    state: true,
    // Error identity is lost due to serialization
    errorIdentity: true,
    // Schema validation doesn't throw errors
    schemaValidationThrows: true,
    // Abort doesn't return 'canceled' status
    abortStatus: true,
    // Empty arrays in foreach cause timeout
    emptyForeach: true,
    // Resume tests - skip until verified working
    resumeBasic: true,
    resumeWithLabel: true,
    resumeWithState: true,
    resumeNested: true,
    // Storage tests - skip until verified working
    storageListRuns: true,
    storageGetDelete: true,
    storageResourceId: true,
    // Run count tests - skip until verified working
    runCount: true,
    retryCount: true,
    // Error persistence tests - skip until verified working
    errorPersistWithoutStack: true,
    errorPersistMastraError: true,
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
});
