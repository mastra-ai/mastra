/**
 * Test the workflow test factory with the default engine
 */

import { createWorkflowTestSuite } from './factory';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import type { WorkflowResult, WorkflowRegistry, ResumeWorkflowOptions, TimeTravelWorkflowOptions } from './types';

// Shared Mastra instance with storage for tests that need persistence
// Mastra instance created for side-effect (registers workflows)
let storage: DefaultStorage;

createWorkflowTestSuite({
  name: 'Workflow (Default Engine)',

  getWorkflowFactory: () => ({
    createWorkflow,
    createStep,
  }),

  // Skip restart domain - requires Mastra integration for state persistence
  // restart() is only tested in packages/core/src/workflows/workflow.test.ts
  skip: {
    restart: true,
  },

  // Skip specific tests
  skipTests: {
    // Abort during step test has 5s timeout waiting for abort signal
    abortDuringStep: true,
  },

  registerWorkflows: async (registry: WorkflowRegistry) => {
    // Create storage for persistence tests
    storage = new DefaultStorage({
      id: 'default-engine-test-storage',
      url: ':memory:',
    });

    // Collect all workflows from registry
    const workflows: Record<string, any> = {};
    for (const [id, entry] of Object.entries(registry)) {
      workflows[id] = entry.workflow;
    }

    // Create Mastra with all workflows and storage
    new Mastra({
      storage,
      workflows,
    });
  },

  // Provide access to storage for tests that need it
  getStorage: () => storage,

  executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
    const run = await workflow.createRun({ runId: options.runId, resourceId: options.resourceId });
    const result = await run.start({
      inputData,
      initialState: options.initialState,
      perStep: options.perStep,
      requestContext: options.requestContext as any,
    });
    return result as WorkflowResult;
  },

  resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
    // Get the workflow run by ID and resume it
    const run = await workflow.createRun({ runId: options.runId });
    const result = await run.resume({
      resumeData: options.resumeData,
      step: options.step,
      label: options.label,
      forEachIndex: options.forEachIndex,
    } as any);
    return result as WorkflowResult;
  },

  timetravelWorkflow: async (workflow, options: TimeTravelWorkflowOptions): Promise<WorkflowResult> => {
    // Create a run and use timeTravel API
    const run = await workflow.createRun({ runId: options.runId });

    const result = await run.timeTravel({
      step: options.step as any,
      context: options.context as any,
      perStep: options.perStep,
      inputData: options.inputData as any,
      nestedStepsContext: options.nestedStepsContext as any,
      resumeData: options.resumeData as any,
    });
    return result as WorkflowResult;
  },
});
