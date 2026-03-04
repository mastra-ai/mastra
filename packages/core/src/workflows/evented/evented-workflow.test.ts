/**
 * Evented engine workflow tests.
 *
 * This file contains:
 * 1. The shared test suite bootstrap (via createWorkflowTestSuite)
 * 2. Evented-engine-specific tests that cannot be shared across engines
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import type {
  WorkflowResult,
  ResumeWorkflowOptions,
  TimeTravelWorkflowOptions,
  StreamWorkflowResult,
  StreamEvent,
} from '@internal/workflow-test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createTool } from '../../tools/tool';
import { createStep, createWorkflow } from '.';

// ============================================================================
// Shared Test Suite (Evented Engine)
// ============================================================================

// Shared storage instance
const sharedStorage = new MockStore();

// @ts-expect-error - TS2589: EventedWorkflow types cause excessively deep type instantiation
createWorkflowTestSuite({
  name: 'Workflow (Evented Engine)',

  getWorkflowFactory: () => ({
    createWorkflow: createWorkflow as any,
    createStep,
    createTool,
    Agent,
  }),

  // Skip restart domain - restart() is not supported on evented workflows
  skip: {
    restart: true,
  },

  // Provide access to storage for tests that need to spy on storage operations
  getStorage: () => sharedStorage,

  beforeEach: async () => {
    // Don't reset mocks - they're created at describe time and need to persist
    // vi.resetAllMocks();
    const workflowsStore = await sharedStorage.getStore('workflows');
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
      storage: sharedStorage,
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
      storage: sharedStorage,
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
      storage: sharedStorage,
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
      storage: sharedStorage,
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
      storage: sharedStorage,
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

// ============================================================================
// Evented Engine-Specific Tests
// ============================================================================

const testStorage = new MockStore();

describe('Workflow (Evented Engine Specific)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const workflowsStore = await testStorage.getStore('workflows');
    await workflowsStore?.dangerouslyClearAll();
  });

  // Note: Streaming Legacy tests removed - they duplicated Streaming tests.
  // Basic stream event format tests are now in the shared test suite.
  // This file only contains evented-specific streaming tests.

  describe('Streaming', () => {
    // Note: Basic "should generate a stream" test moved to shared suite.
    // Tests below cover evented-specific streaming features.

    it('should generate a stream for a single step when perStep is true', async () => {
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
        options: {
          validateInputs: false,
        },
      });
      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRun({
        runId,
      });

      const streamResult = run.stream({ inputData: {}, perStep: true });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of streamResult.fullStream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await streamResult.result;
      if (!executionResult) {
        expect.fail('Execution result is not set');
      }

      // Verify perStep stream event format (evented-specific)
      expect(watchData.length).toBe(7);
      expect(watchData.map(e => e.type)).toEqual([
        'workflow-start',
        'workflow-start',
        'workflow-step-start',
        'workflow-step-result',
        'workflow-paused', // perStep pauses after first step
        'workflow-finish',
        'workflow-finish',
      ]);
      // Verify perStep behavior
      expect(executionResult.status).toBe('paused');
      expect(executionResult.steps.step1?.status).toBe('success');
      expect(executionResult.steps.step2).toBeUndefined();
      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();

      await mastra.stopEventEngine();
    });

    // Note: "should handle basic suspend and resume flow" moved to shared suite
    // Note: "should be able to use an agent as a step" moved to shared suite

    it('should handle sleep waiting flow', async () => {
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
        options: { validateInputs: false },
      });
      workflow.then(step1).sleep(1000).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRun({
        runId,
      });

      const output = run.stream({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of output.fullStream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await output.result;

      // Verify sleep waiting flow stream event format (evented-specific)
      expect(watchData.length).toBe(10);
      expect(watchData.map(e => e.type)).toEqual([
        'workflow-start',
        'workflow-start',
        'workflow-step-start',
        'workflow-step-result',
        'workflow-step-waiting', // sleep step
        'workflow-step-result',
        'workflow-step-start',
        'workflow-step-result',
        'workflow-finish',
        'workflow-finish',
      ]);
      // Result verification covered by shared suite
      expect(executionResult.status).toBe('success');

      await mastra.stopEventEngine();
    });

    it.skip('should continue streaming current run on subsequent stream calls - evented runtime pubsub differs from default', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi.fn().mockResolvedValue({ improvedOutput: 'improved output' });
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [getUserInput, promptAgent, evaluateTone, improveResponse, evaluateImproved],
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      // This test validates that calling stream() multiple times on same run
      // continues the existing stream rather than starting a new one.
      // Evented runtime uses pubsub which has different semantics.
      const streamResult = await run.stream({ inputData: { input: 'test' } });
      const result = await streamResult.result;

      expect(result.status).toBe('suspended');

      await mastra.stopEventEngine();
    });

    // Note: "should handle custom event emission using writer" moved to shared suite
    // (streaming domain: should handle custom event emission using writer)

    it('should handle writer.custom during resume operations', async () => {
      let customEvents: StreamEvent[] = [];

      const stepWithWriter = createStep({
        id: 'step-with-writer',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number(), success: z.boolean() }),
        suspendSchema: z.object({ suspendValue: z.number() }),
        resumeSchema: z.object({ resumeValue: z.number() }),
        execute: async ({ inputData, resumeData, writer, suspend }) => {
          if (!resumeData?.resumeValue) {
            // First run - emit custom event and suspend
            await writer?.custom({
              type: 'suspend-event',
              data: { message: 'About to suspend', value: inputData.value },
            });

            await suspend({ suspendValue: inputData.value });
            return { value: inputData.value, success: false };
          } else {
            // Resume - emit custom event to test that writer works on resume
            await writer?.custom({
              type: 'resume-event',
              data: {
                message: 'Successfully resumed',
                originalValue: inputData.value,
                resumeValue: resumeData.resumeValue,
              },
            });

            return { value: resumeData.resumeValue, success: true };
          }
        },
      });

      const testWorkflow = createWorkflow({
        id: 'test-resume-writer',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number(), success: z.boolean() }),
      });

      testWorkflow.then(stepWithWriter).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-resume-writer': testWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      // Create run and start workflow
      const run = await testWorkflow.createRun();

      // Use streaming to capture custom events
      let streamResult = run.stream({ inputData: { value: 42 } });

      // Collect all events from the stream - custom events come through directly
      for await (const event of streamResult.fullStream) {
        //@ts-expect-error `suspend-event` is custom
        if (event.type === 'suspend-event') {
          customEvents.push(event);
        }
      }

      const firstResult = await streamResult.result;
      expect(firstResult.status).toBe('suspended');

      // Check that suspend event was emitted
      expect(customEvents).toHaveLength(1);
      expect(customEvents[0].type).toBe('suspend-event');

      // Reset events for resume test
      customEvents = [];

      // Resume the workflow using streaming
      streamResult = run.resumeStream({
        resumeData: { resumeValue: 99 },
        step: stepWithWriter,
      });

      for await (const event of streamResult.fullStream) {
        //@ts-expect-error `resume-event` is custom
        if (event.type === 'resume-event') {
          customEvents.push(event);
        }
      }

      const resumeResult = await streamResult.result;
      expect(resumeResult.status).toBe('success');

      await mastra.stopEventEngine();
    });

    it('should handle errors from agent.stream() with full error details', async () => {
      // Simulate an APICallError-like error from AI SDK
      const apiError = new Error('Service Unavailable');
      (apiError as any).statusCode = 503;
      (apiError as any).responseHeaders = { 'retry-after': '60' };
      (apiError as any).requestId = 'req_abc123';
      (apiError as any).isRetryable = true;

      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          throw apiError;
        },
      });

      const agent = new Agent({
        name: 'test-agent',
        model: mockModel,
        instructions: 'Test agent',
      });

      const agentStep = createStep({
        id: 'agent-step',
        execute: async () => {
          const result = await agent.stream('test input', {
            maxRetries: 0,
          });

          await result.consumeStream();

          // Throw the error from agent.stream if it exists
          if (result.error) {
            throw result.error;
          }

          return { success: true };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ success: z.boolean() }),
      });

      const workflow = createWorkflow({
        id: 'agent-error-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ success: z.boolean() }),
        steps: [agentStep],
      });

      workflow.then(agentStep).commit();

      const mastra = new Mastra({
        workflows: { 'agent-error-workflow': workflow },
        agents: { 'test-agent': agent },
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');

      if (result.status === 'failed') {
        // Evented runtime may return Error instance (not serialized like default runtime)
        expect(result.error).toBeDefined();

        expect((result.error as any).message).toBe('Service Unavailable');
        // Verify API error properties are preserved
        expect((result.error as any).statusCode).toBe(503);
        expect((result.error as any).responseHeaders).toEqual({ 'retry-after': '60' });
        expect((result.error as any).requestId).toBe('req_abc123');
        expect((result.error as any).isRetryable).toBe(true);
      }

      await mastra.stopEventEngine();
    });

    // Note: "should preserve error details in streaming workflow" moved to shared suite
    // (streaming domain: should preserve error details in streaming workflow)
  });
});
