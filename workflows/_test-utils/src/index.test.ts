/**
 * Test the workflow test factory with the default engine
 */

import { createWorkflowTestSuite } from './factory';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import type { WorkflowResult, WorkflowRegistry } from './types';

// Shared Mastra instance with storage for tests that need persistence
let mastra: Mastra;
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
    mastra = new Mastra({
      storage,
      workflows,
    });
  },

  executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
    const run = await workflow.createRun({ runId: options.runId });
    const result = await run.start({
      inputData,
      initialState: options.initialState,
      perStep: options.perStep,
    });
    return result as WorkflowResult;
  },
});
