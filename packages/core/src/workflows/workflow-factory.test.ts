/**
 * Test the workflow test factory with the Default Engine
 *
 * This test validates the shared test suite against the reference implementation.
 * The Default Engine is the standard workflow execution engine in @mastra/core.
 */

import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import type { WorkflowResult, ResumeWorkflowOptions, TimeTravelWorkflowOptions } from '@internal/workflow-test-utils';
import { vi } from 'vitest';

import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createTool } from '../tools/tool';
import type { Workflow } from './types';
import { createWorkflow, createStep } from './workflow';

// Shared storage for all tests - provides persistence for resume tests
const testStorage = new MockStore();

// Create a shared Mastra instance for tests that need it
let _mastra: Mastra;

createWorkflowTestSuite({
  name: 'Workflow (Default Engine)',

  getWorkflowFactory: () => {
    return { createWorkflow, createStep, createTool };
  },

  // Register workflows with Mastra for storage/resume support
  registerWorkflows: async registry => {
    // Collect all workflows
    const workflows: Record<string, any> = {};
    for (const [id, entry] of Object.entries(registry)) {
      workflows[id] = entry.workflow;
    }

    // Create Mastra with all workflows - this automatically binds mastra to each workflow
    _mastra = new Mastra({
      logger: false,
      storage: testStorage,
      workflows,
    });
  },

  getStorage: () => testStorage,

  beforeAll: async () => {
    // Nothing special needed for default engine
  },

  afterAll: async () => {
    // Nothing to cleanup
  },

  beforeEach: async () => {
    vi.clearAllMocks();
  },

  // ============================================================================
  // Domain-level skips
  // ============================================================================
  skip: {
    // All domains should work on Default Engine
    restart: false, // Default engine supports restart
  },

  // ============================================================================
  // Individual test skips
  // ============================================================================
  skipTests: {
    // Enable all tests - Default Engine is the reference implementation
    // Enable opt-in tests that require storage
    errorStorageRoundtrip: false,
    errorPersistWithoutStack: false,
    errorPersistMastraError: false,
  },

  executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({
      runId: options.runId,
      resourceId: options.resourceId,
    });

    const result = await run.start({
      inputData,
      initialState: options.initialState,
      perStep: options.perStep,
      requestContext: options.requestContext as any,
    });

    return result as WorkflowResult;
  },

  resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({ runId: options.runId });
    const result = await run.resume({
      step: options.step as any,
      label: options.label,
      resumeData: options.resumeData,
      forEachIndex: options.forEachIndex,
    });

    return result as WorkflowResult;
  },

  timetravelWorkflow: async (workflow, options: TimeTravelWorkflowOptions): Promise<WorkflowResult> => {
    const wf = workflow as Workflow<any, any, any, any, any, any, any>;

    const run = await wf.createRun({ runId: options.runId });
    const result = await run.timeTravel({
      step: options.step as any,
      context: options.context as any,
      perStep: options.perStep,
    });

    return result as WorkflowResult;
  },
});
