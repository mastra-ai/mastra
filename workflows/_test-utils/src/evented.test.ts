/**
 * Test the workflow test factory with the evented engine
 */

import { createWorkflowTestSuite } from './factory';
import { createWorkflow, createStep } from '@mastra/core/workflows/evented';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { EventEmitterPubSub } from '@mastra/core/events';
import type {
  WorkflowResult,
  ResumeWorkflowOptions,
  TimeTravelWorkflowOptions,
  StreamWorkflowResult,
  StreamEvent,
} from './types';

// Shared storage instance
const testStorage = new MockStore();

// @ts-expect-error - TS2589: EventedWorkflow types cause excessively deep type instantiation
createWorkflowTestSuite({
  name: 'Workflow (Evented Engine)',

  getWorkflowFactory: () => ({
    createWorkflow: createWorkflow as any,
    createStep,
    Agent,
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

  // Skip only tests that actually fail - updated after BUG fixes 2026-02
  skipTests: {
    // Validation - evented resolves instead of throwing
    executionFlowNotDefined: true,
    executionGraphNotCommitted: true,

    // Foreach - timing flaky, empty array timeout
    foreachPartialConcurrencyTiming: true,
    emptyForeach: true,

    // Abort - returns 'success' not 'canceled', timeout on signal wait
    abortStatus: true,
    abortDuringStep: true,

    // Suspend/resume - parallel suspend has race condition (each step publishes workflow.suspend independently)
    resumeParallelMulti: true,
    resumeMultiSuspendError: true,
    resumeBranchingStatus: true,
    // Suspend/resume - still failing (loop/foreach coordination, nested input propagation)
    resumeLoopInput: true,
    resumeForeachIndex: true,
    resumeForeachLabel: true, // Same issue as resumeForeachIndex
    resumeForeachPartial: true, // Same issue as resumeForeachIndex
    resumeForeachPartialIndex: true, // Same issue as resumeForeachIndex
    resumeNested: true, // Nested resume works but input value from previous step lost (26 vs 27)
    resumeDountil: true,

    // Time travel - different result structure
    timeTravelConditional: true,

    // Streaming - legacy API timeout issue
    streamingSuspendResumeLegacy: true,

    // Branching - nested conditions with multiple nested workflows
    branchingNestedConditions: true, // Complex nested branching not yet supported in evented

    // Foreach state tests - stateSchema with bail/setState
    foreachStateBatch: true, // State batch propagation in evented foreach not yet supported
    foreachBail: true, // bail() in evented foreach not yet supported

    // Error handling - logger test creates its own Mastra instance (default engine only)
    errorLogger: true,

    // Callback - state test uses stateSchema/setState (WIP in evented)
    callbackStateOnError: true,

    // Time travel - conditional perStep inherits timeTravelConditional issues
    timeTravelConditionalPerStep: true,

    // Resume error tests - evented engine error behavior may differ
    resumeNotSuspendedWorkflow: true,
    resumeInvalidData: true,

    // Deep nested suspend/resume not supported in evented engine
    resumeDeepNested: true,
    // Incorrect branches after resume in nested workflows - evented fails
    resumeIncorrectBranches: true,
    // Map-branch resume requires direct Mastra registration (server restart sim)
    resumeMapBranchCondition: true,
    // Abort propagation to nested workflows times out in evented engine
    abortNestedPropagation: true,
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

      // Create the run and execute using streaming API
      const run = await workflow.createRun({ runId: options.runId, resourceId: options.resourceId });
      const streamResult = run.stream({
        inputData,
        initialState: options.initialState,
        perStep: options.perStep,
        requestContext: options.requestContext as any,
        outputOptions: options.outputOptions,
      });

      // Consume the stream to ensure it completes
      for await (const _event of streamResult.fullStream) {
        // Discard events - we only care about the result
      }

      const result = await streamResult.result;

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
        inputData: options.inputData as any,
        nestedStepsContext: options.nestedStepsContext as any,
        resumeData: options.resumeData as any,
      });

      return result as WorkflowResult;
    } finally {
      // Always stop the event engine
      await mastra.stopEventEngine();
    }
  },

  streamWorkflow: async (workflow, inputData, options = {}, api = 'stream'): Promise<StreamWorkflowResult> => {
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });

    try {
      await mastra.startEventEngine();

      const run = await workflow.createRun({
        runId: options.runId,
        resourceId: options.resourceId,
      });

      const events: StreamEvent[] = [];

      if (api === 'streamLegacy') {
        const { stream, getWorkflowState } = run.streamLegacy({
          inputData,
          initialState: options.initialState as any,
          perStep: options.perStep,
          requestContext: options.requestContext as any,
        } as any);

        for await (const event of stream) {
          events.push(JSON.parse(JSON.stringify(event)));
        }

        const result = await getWorkflowState();
        return { events, result: result as WorkflowResult };
      } else {
        const streamResult = run.stream({
          inputData,
          initialState: options.initialState,
          perStep: options.perStep,
          requestContext: options.requestContext as any,
          closeOnSuspend: options.closeOnSuspend,
        });

        for await (const event of streamResult.fullStream) {
          events.push(JSON.parse(JSON.stringify(event)));
        }

        const result = await streamResult.result;
        return { events, result: result as WorkflowResult };
      }
    } finally {
      await mastra.stopEventEngine();
    }
  },

  streamResumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<StreamWorkflowResult> => {
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });

    try {
      await mastra.startEventEngine();

      const run = await workflow.createRun({ runId: options.runId });

      const events: StreamEvent[] = [];
      const streamResult = run.resumeStream({
        resumeData: options.resumeData,
        step: options.step,
        label: options.label,
      } as any);

      for await (const event of streamResult.fullStream) {
        events.push(JSON.parse(JSON.stringify(event)));
      }

      const result = await streamResult.result;
      return { events, result: result as WorkflowResult };
    } finally {
      await mastra.stopEventEngine();
    }
  },
});
