/**
 * Streaming tests for workflows
 * Note: Basic streaming tests that don't require full stream consumption
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { simulateReadableStream } from '@internal/ai-sdk-v4';
// @ts-ignore - module resolution for test utilities
import { MockLanguageModelV1, MockLanguageModelV2 } from '@internal/ai-sdk-v4/test';
import { Mastra } from '@mastra/core/mastra';
import type { StreamEvent } from '@mastra/core/workflows';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for streaming tests.
 */
export function createStreamingWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep, Agent } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should execute workflow that could be streamed
  {
    // Register mock factories
    mockRegistry.register('streaming-test-workflow:step1Action', () =>
      vi.fn().mockResolvedValue({ result: 'success1' }),
    );
    mockRegistry.register('streaming-test-workflow:step2Action', () =>
      vi.fn().mockResolvedValue({ result: 'success2' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-test-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-test-workflow:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'streaming-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1, step2],
      options: {
        validateInputs: false,
      },
    });
    workflow.then(step1).then(step2).commit();

    workflows['streaming-test-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-test-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-test-workflow:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should track step execution order in workflow result
  {
    // Use a mock to track execution order
    mockRegistry.register('execution-order-workflow:order', () => vi.fn());

    const step1 = createStep({
      id: 'step1',
      execute: async () => {
        mockRegistry.get('execution-order-workflow:order')('step1');
        return { value: 'step1-done' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async () => {
        mockRegistry.get('execution-order-workflow:order')('step2');
        return { value: 'step2-done' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async () => {
        mockRegistry.get('execution-order-workflow:order')('step3');
        return { result: 'complete' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'execution-order-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['execution-order-workflow'] = {
      workflow,
      mocks: {},
      getExecutionOrder: () => {
        const mock = mockRegistry.get('execution-order-workflow:order');
        return mock.mock.calls.map((call: any[]) => call[0]);
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute workflow with state that could be streamed
  {
    mockRegistry.register('streaming-with-state-workflow:step1Action', () =>
      vi.fn().mockImplementation(async ({ state, setState }) => {
        await setState({ ...state, counter: (state?.counter || 0) + 1 });
        return { value: 'step1-done' };
      }),
    );
    mockRegistry.register('streaming-with-state-workflow:step2Action', () =>
      vi.fn().mockImplementation(async ({ state, setState }) => {
        await setState({ ...state, counter: (state?.counter || 0) + 1 });
        return { value: 'step2-done', finalCounter: state?.counter };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-with-state-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      stateSchema: z.object({ counter: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-with-state-workflow:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string(), finalCounter: z.number().optional() }),
      stateSchema: z.object({ counter: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'streaming-with-state-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string(), finalCounter: z.number().optional() }),
      stateSchema: z.object({ counter: z.number() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['streaming-with-state-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-with-state-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-with-state-workflow:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute workflow with parallel steps that could be streamed
  {
    mockRegistry.register('streaming-parallel-workflow:step1Action', () =>
      vi.fn().mockResolvedValue({ result: 'parallel-1' }),
    );
    mockRegistry.register('streaming-parallel-workflow:step2Action', () =>
      vi.fn().mockResolvedValue({ result: 'parallel-2' }),
    );
    mockRegistry.register('streaming-parallel-workflow:step3Action', () =>
      vi.fn().mockResolvedValue({ result: 'parallel-3' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-parallel-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-parallel-workflow:step2Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('streaming-parallel-workflow:step3Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'streaming-parallel-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.parallel([step1, step2, step3]).commit();

    workflows['streaming-parallel-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-parallel-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-parallel-workflow:step2Action');
        },
        get step3Action() {
          return mockRegistry.get('streaming-parallel-workflow:step3Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute workflow that suspends (could be streamed without closing)
  {
    mockRegistry.register('streaming-suspend-workflow:step1Action', () =>
      vi.fn().mockResolvedValue({ value: 'step1-done' }),
    );
    mockRegistry.register('streaming-suspend-workflow:step2Action', () =>
      vi.fn().mockImplementation(async ({ suspend }) => {
        return suspend({ reason: 'waiting for input' });
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-suspend-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-suspend-workflow:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'streaming-suspend-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['streaming-suspend-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-suspend-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-suspend-workflow:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Note: Agent streaming tests remain in engine-specific files because they require
  // MockLanguageModel which has module resolution issues when imported from shared suite.

  // Test: should handle streaming suspend and resume flow
  {
    mockRegistry.register('streaming-suspend-resume-workflow:getUserInputAction', () =>
      vi.fn().mockResolvedValue({ userInput: 'test input' }),
    );
    mockRegistry.register('streaming-suspend-resume-workflow:promptAgentAction', () =>
      vi
        .fn()
        .mockImplementationOnce(async ({ suspend }: any) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' })),
    );
    mockRegistry.register('streaming-suspend-resume-workflow:evaluateToneAction', () =>
      vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      }),
    );

    const getUserInput = createStep({
      id: 'getUserInput',
      execute: async ctx => mockRegistry.get('streaming-suspend-resume-workflow:getUserInputAction')(ctx),
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ userInput: z.string() }),
    });
    const promptAgent = createStep({
      id: 'promptAgent',
      execute: async ctx => mockRegistry.get('streaming-suspend-resume-workflow:promptAgentAction')(ctx),
      inputSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ modelOutput: z.string() }),
    });
    const evaluateTone = createStep({
      id: 'evaluateToneConsistency',
      execute: async ctx => mockRegistry.get('streaming-suspend-resume-workflow:evaluateToneAction')(ctx),
      inputSchema: z.object({ modelOutput: z.string() }),
      outputSchema: z.object({
        toneScore: z.any(),
        completenessScore: z.any(),
      }),
    });

    const workflow = createWorkflow({
      id: 'streaming-suspend-resume-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({}),
      steps: [getUserInput, promptAgent, evaluateTone],
    });

    workflow.then(getUserInput).then(promptAgent).then(evaluateTone).commit();

    workflows['streaming-suspend-resume-workflow'] = {
      workflow,
      promptAgentStep: promptAgent,
      mocks: {
        get getUserInputAction() {
          return mockRegistry.get('streaming-suspend-resume-workflow:getUserInputAction');
        },
        get promptAgentAction() {
          return mockRegistry.get('streaming-suspend-resume-workflow:promptAgentAction');
        },
        get evaluateToneAction() {
          return mockRegistry.get('streaming-suspend-resume-workflow:evaluateToneAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should handle custom event emission using writer
  {
    const getUserInput = createStep({
      id: 'getUserInput',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ userInput: z.string() }),
      execute: async ({ inputData }) => {
        return { userInput: inputData.input };
      },
    });

    const stepWithWriter = createStep({
      id: 'stepWithWriter',
      inputSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ modelOutput: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
      execute: async ({ suspend, writer, inputData, resumeData }) => {
        await writer.write({
          type: 'custom-event',
          payload: {
            input: resumeData?.userInput || inputData.userInput,
          },
        });

        if (!resumeData) {
          await suspend({});
        }

        return { modelOutput: 'test output' };
      },
    });

    const workflow = createWorkflow({
      id: 'writer-custom-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({}),
      steps: [getUserInput, stepWithWriter],
    });

    workflow.then(getUserInput).then(stepWithWriter).commit();

    workflows['writer-custom-workflow'] = {
      workflow,
      stepWithWriter,
      mocks: {},
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should preserve error details in streaming workflow
  {
    mockRegistry.register('error-preserve-workflow:failingStepAction', () =>
      vi.fn().mockImplementation(() => {
        const testError = new Error('Rate limit exceeded');
        (testError as any).statusCode = 429;
        (testError as any).responseHeaders = {
          'x-ratelimit-reset': '1234567890',
          'retry-after': '30',
        };
        throw testError;
      }),
    );

    const failingStep = createStep({
      id: 'failing-step',
      execute: async ctx => mockRegistry.get('error-preserve-workflow:failingStepAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-preserve-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(failingStep).commit();

    workflows['error-preserve-workflow'] = {
      workflow,
      mocks: {
        get failingStepAction() {
          return mockRegistry.get('error-preserve-workflow:failingStepAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should be able to use an agent as a step
  if (Agent) {
    const agent1 = new Agent({
      id: 'test-agent-1',
      name: 'test-agent-1',
      instructions: 'test agent instructions',
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'Paris' },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    });

    const agent2 = new Agent({
      id: 'test-agent-2',
      name: 'test-agent-2',
      instructions: 'test agent instructions',
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'London' },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    });

    const startStep = createStep({
      id: 'start',
      inputSchema: z.object({
        prompt1: z.string(),
        prompt2: z.string(),
      }),
      outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
      execute: async ({ inputData }) => {
        return {
          prompt1: inputData.prompt1,
          prompt2: inputData.prompt2,
        };
      },
    });

    const agentStep1 = createStep(agent1);
    const agentStep2 = createStep(agent2);

    const workflow = createWorkflow({
      id: 'agent-streaming-workflow',
      inputSchema: z.object({
        prompt1: z.string(),
        prompt2: z.string(),
      }),
      outputSchema: z.object({}),
    });

    workflow
      .then(startStep)
      .map({
        prompt: {
          step: startStep,
          path: 'prompt1',
        },
      })
      .then(agentStep1)
      .map({
        prompt: {
          step: startStep,
          path: 'prompt2',
        },
      })
      .then(agentStep2)
      .commit();

    workflows['agent-streaming-workflow'] = {
      workflow,
      mocks: {},
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should pass agentOptions when wrapping agent with createStep
  if (Agent) {
    // Track what options were received
    let receivedOptions: any = null;
    const doStreamSpy = vi.fn(async ({ prompt, temperature }: any) => {
      // Capture options that were passed
      receivedOptions = { temperature };

      // Check if instructions were overridden in the messages
      const systemMessage = prompt?.find((m: any) => m.role === 'system');
      if (systemMessage?.content) {
        receivedOptions.instructionsOverridden = systemMessage.content.includes('overridden instructions');
      }

      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Response' },
            {
              type: 'finish',
              finishReason: 'stop',
              logprobs: undefined,
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    });

    const agentWithOptions = new Agent({
      id: 'test-agent-with-options',
      name: 'test-agent-with-options',
      instructions: 'original instructions',
      model: new MockLanguageModelV1({
        doStream: doStreamSpy,
      }),
    });

    const agentOptionsWorkflow = createWorkflow({
      id: 'streaming-agent-options-workflow',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    });

    // Create step with agent options
    const agentStep = createStep(agentWithOptions, {
      instructions: 'overridden instructions',
      temperature: 0.7,
    });

    agentOptionsWorkflow
      .map({ prompt: { value: 'test', schema: z.string() } })
      .then(agentStep)
      .commit();

    workflows['streaming-agent-options-workflow'] = {
      workflow: agentOptionsWorkflow,
      agentWithOptions,
      mocks: {
        get doStreamSpy() {
          return doStreamSpy;
        },
      },
      getReceivedOptions: () => receivedOptions,
      resetMocks: () => {
        mockRegistry.reset();
        receivedOptions = null;
        doStreamSpy.mockClear();
      },
    };
  }

  return workflows;
}

export function createStreamingTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Streaming', () => {
    it('should execute workflow that could be streamed', async () => {
      const { workflow } = registry!['streaming-test-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'success2' },
        payload: { result: 'success1' },
      });
    });

    it.skipIf(skipTests.stepExecutionOrder)('should track step execution order in workflow result', async () => {
      const { workflow, getExecutionOrder } = registry!['execution-order-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(getExecutionOrder()).toEqual(['step1', 'step2', 'step3']);

      // Verify all steps are in the result
      expect(result.steps.step1).toMatchObject({ status: 'success' });
      expect(result.steps.step2).toMatchObject({ status: 'success' });
      expect(result.steps.step3).toMatchObject({ status: 'success' });
    });

    it.skipIf(skipTests.state)('should execute workflow with state that could be streamed', async () => {
      const { workflow, resetMocks } = registry!['streaming-with-state-workflow']!;
      resetMocks?.();

      const result = await execute(workflow, {}, { initialState: { counter: 0 } });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
      });
      // Verify state was updated
      expect((result.steps.step2 as any).output?.finalCounter).toBe(1);
    });

    it('should execute workflow with parallel steps that could be streamed', async () => {
      const { workflow, resetMocks } = registry!['streaming-parallel-workflow']!;
      resetMocks?.();

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'parallel-1' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'parallel-2' },
      });
      expect(result.steps.step3).toMatchObject({
        status: 'success',
        output: { result: 'parallel-3' },
      });
    });

    it('should execute workflow that suspends (streamable without closing)', async () => {
      const { workflow, resetMocks } = registry!['streaming-suspend-workflow']!;
      resetMocks?.();

      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { reason: 'waiting for input' },
      });
    });

    // Note: Agent streaming tests remain in engine-specific files due to MockLanguageModel import issues

    // Stream event format tests - verify streaming APIs work and produce correct events
    describe('Stream Events', () => {
      it('should produce correct streamLegacy events', async () => {
        const { workflow } = registry!['streaming-test-workflow']!;
        const { stream } = ctx;

        if (!stream) {
          // Skip if streaming not implemented
          return;
        }

        const { events, result } = await stream(workflow, {}, {}, 'streamLegacy');

        expect(result.status).toBe('success');

        // Verify streamLegacy event format
        const eventTypes = events.map(e => e.type);
        expect(eventTypes).toContain('start');
        expect(eventTypes).toContain('step-start');
        expect(eventTypes).toContain('step-result');
        expect(eventTypes).toContain('step-finish');
        expect(eventTypes).toContain('finish');

        // Verify event structure
        const startEvent = events.find(e => e.type === 'start');
        expect(startEvent?.payload).toBeDefined();

        const stepStartEvents = events.filter(e => e.type === 'step-start');
        expect(stepStartEvents.length).toBe(2); // step1 and step2

        const stepResultEvents = events.filter(e => e.type === 'step-result');
        expect(stepResultEvents.length).toBe(2);
        expect(stepResultEvents[0]?.payload?.status).toBe('success');
      });

      it.skipIf(skipTests.streamingDetailedEvents)(
        'should generate stream with detailed event structure (streamLegacy)',
        async () => {
          const { workflow } = registry!['streaming-test-workflow']!;
          const { stream } = ctx;

          if (!stream) {
            return;
          }

          const { events, result } = await stream(workflow, {}, { runId: 'test-run-id' }, 'streamLegacy');

          expect(result.status).toBe('success');

          // Detailed event structure verification (8 events total)
          expect(events.length).toBe(8);
          expect(events).toMatchObject([
            {
              payload: { runId: 'test-run-id' },
              type: 'start',
            },
            {
              payload: {
                id: 'step1',
                payload: {},
                startedAt: expect.any(Number),
              },
              type: 'step-start',
            },
            {
              payload: {
                id: 'step1',
                output: { result: 'success1' },
                endedAt: expect.any(Number),
                status: 'success',
              },
              type: 'step-result',
            },
            {
              payload: {
                id: 'step1',
                metadata: {},
              },
              type: 'step-finish',
            },
            {
              payload: {
                id: 'step2',
                payload: { result: 'success1' },
                startedAt: expect.any(Number),
              },
              type: 'step-start',
            },
            {
              payload: {
                id: 'step2',
                output: { result: 'success2' },
                endedAt: expect.any(Number),
                status: 'success',
              },
              type: 'step-result',
            },
            {
              payload: {
                id: 'step2',
                metadata: {},
              },
              type: 'step-finish',
            },
            {
              payload: { runId: 'test-run-id' },
              type: 'finish',
            },
          ]);

          // Verify execution result
          expect(result.steps.step1).toEqual({
            status: 'success',
            output: { result: 'success1' },
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          });
          expect(result.steps.step2).toEqual({
            status: 'success',
            output: { result: 'success2' },
            payload: { result: 'success1' },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          });
        },
      );

      it('should produce correct stream() events', async () => {
        const { workflow } = registry!['streaming-test-workflow']!;
        const { stream } = ctx;

        if (!stream) {
          // Skip if streaming not implemented
          return;
        }

        const { events, result } = await stream(workflow, {}, {}, 'stream');

        expect(result.status).toBe('success');

        // Verify stream() event format (workflow-prefixed)
        const eventTypes = events.map(e => e.type);
        expect(eventTypes).toContain('workflow-start');
        expect(eventTypes).toContain('workflow-step-start');
        expect(eventTypes).toContain('workflow-step-result');
        expect(eventTypes).toContain('workflow-finish');

        // Verify events have 'from' property
        const workflowEvents = events.filter(e => e.type.startsWith('workflow-'));
        expect(workflowEvents.every(e => e.from === 'WORKFLOW')).toBe(true);
      });

      it.skipIf(skipTests.streamingSuspendResume)('should handle streaming suspend and resume flow', async () => {
        const { workflow, promptAgentStep, mocks, resetMocks } = registry!['streaming-suspend-resume-workflow']!;
        const { stream, streamResume } = ctx;
        resetMocks?.();

        if (!stream || !streamResume) {
          // Skip if streaming or streaming resume not implemented
          return;
        }

        // Stream workflow with closeOnSuspend - stream should close when workflow suspends
        const { events: suspendEvents, result: suspendResult } = await stream(
          workflow,
          { input: 'test' },
          { closeOnSuspend: true },
          'stream',
        );

        // Verify workflow suspended
        expect(suspendResult.status).toBe('suspended');

        // Verify suspend events were emitted
        const eventTypes = suspendEvents.map(e => e.type);
        expect(eventTypes).toContain('workflow-start');
        expect(eventTypes).toContain('workflow-step-start');
        // Should have suspended event (workflow-step-suspended or step-suspended depending on API)
        const hasSuspendEvent = eventTypes.some(t => t.includes('suspend'));
        expect(hasSuspendEvent).toBe(true);

        // Verify first step ran but third step didn't
        expect(mocks.getUserInputAction).toHaveBeenCalled();
        expect(mocks.promptAgentAction).toHaveBeenCalledTimes(1);
        expect(mocks.evaluateToneAction).not.toHaveBeenCalled();

        // Resume via streaming
        const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
        const { events: resumeEvents, result: resumeResult } = await streamResume(workflow, {
          runId: suspendResult.steps.input ? (suspendEvents.find(e => e.runId)?.runId as string) : 'test-run-id',
          step: promptAgentStep,
          resumeData,
        });

        // Verify resume completed successfully
        expect(resumeResult.status).toBe('success');

        // Verify resume events
        const resumeEventTypes = resumeEvents.map(e => e.type);
        expect(resumeEventTypes).toContain('workflow-finish');

        // Verify all steps ran after resume
        expect(mocks.evaluateToneAction).toHaveBeenCalled();
      });

      it.skipIf(skipTests.streamingSuspendResumeLegacy)(
        'should handle basic suspend and resume flow (streamLegacy)',
        async () => {
          const { workflow, promptAgentStep, mocks, resetMocks } = registry!['streaming-suspend-resume-workflow']!;
          resetMocks?.();

          // Use the workflow's createRun directly for resume-during-iteration pattern
          const run = await workflow.createRun();
          const { stream, getWorkflowState } = run.streamLegacy({ inputData: { input: 'test' } });

          for await (const data of stream) {
            if (data.type === 'step-suspended') {
              expect(mocks.promptAgentAction).toHaveBeenCalledTimes(1);

              // Resume asynchronously during iteration
              setImmediate(() => {
                const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
                run.resume({ resumeData: resumeData as any, step: promptAgentStep });
              });
              expect(mocks.evaluateToneAction).not.toHaveBeenCalled();
            }
          }

          expect(mocks.evaluateToneAction).toHaveBeenCalledTimes(1);

          const resumeResult = await getWorkflowState();

          expect(resumeResult.steps).toMatchObject({
            input: { input: 'test' },
            getUserInput: {
              status: 'success',
              output: { userInput: 'test input' },
              payload: { input: 'test' },
              startedAt: expect.any(Number),
              endedAt: expect.any(Number),
            },
            promptAgent: {
              status: 'success',
              output: { modelOutput: 'test output' },
              payload: { userInput: 'test input' },
              startedAt: expect.any(Number),
              endedAt: expect.any(Number),
              resumePayload: { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } },
              resumedAt: expect.any(Number),
              suspendedAt: expect.any(Number),
            },
            evaluateToneConsistency: {
              status: 'success',
              output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
              payload: { modelOutput: 'test output' },
              startedAt: expect.any(Number),
              endedAt: expect.any(Number),
            },
          });
        },
      );

      it.skipIf(skipTests.streamingSuspendResume)('should handle custom event emission using writer', async () => {
        const { workflow, stepWithWriter } = registry!['writer-custom-workflow']!;
        const { stream, streamResume } = ctx;

        if (!stream || !streamResume) {
          return;
        }

        // Stream workflow with closeOnSuspend - custom event should be emitted before suspend
        const { events: initialEvents, result: initialResult } = await stream(
          workflow,
          { input: 'test input for stream' },
          { closeOnSuspend: true },
          'stream',
        );

        // Verify custom event was emitted during initial stream (via workflow-step-output)
        const customEvent = initialEvents.find(
          e => e.type === 'workflow-step-output' && (e.payload as any)?.output?.type === 'custom-event',
        );
        expect(customEvent).toBeDefined();
        expect((customEvent?.payload as any)?.output?.payload?.input).toBe('test input for stream');

        // Verify workflow suspended
        expect(initialResult.status).toBe('suspended');

        // Resume and verify it completes successfully
        const { result: resumeResult } = await streamResume(workflow, {
          runId: initialEvents.find(e => e.runId)?.runId as string,
          step: stepWithWriter,
          resumeData: { userInput: 'test input for resumption' },
        });

        // Resume should complete successfully (custom event during resume is optional)
        expect(resumeResult.status).toBe('success');
      });

      it.skipIf(skipTests.streamingErrorPreservation)(
        'should preserve error details in streaming workflow',
        async () => {
          const { workflow, resetMocks } = registry!['error-preserve-workflow']!;
          const { stream } = ctx;
          resetMocks?.();

          if (!stream) {
            return;
          }

          const { result } = await stream(workflow, {}, {}, 'stream');

          expect(result.status).toBe('failed');

          if (result.status === 'failed') {
            expect(result.error).toBeDefined();
            // Error message should be preserved
            expect((result.error as any).message).toBe('Rate limit exceeded');
            // Custom error properties should be preserved
            expect((result.error as any).statusCode).toBe(429);
            expect((result.error as any).responseHeaders).toEqual({
              'x-ratelimit-reset': '1234567890',
              'retry-after': '30',
            });
          }
        },
      );

      it('should be able to use an agent as a step with detailed events (streamLegacy)', async () => {
        const { createWorkflow, createStep, Agent } = ctx;

        if (!Agent) {
          // Skip if Agent not provided
          return;
        }

        const workflow = createWorkflow({
          id: 'agent-detailed-streaming-test',
          inputSchema: z.object({
            prompt1: z.string(),
            prompt2: z.string(),
          }),
          outputSchema: z.object({}),
        });

        const agent = new Agent({
          id: 'test-agent-1',
          name: 'test-agent-1',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'Paris' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
        });

        const agent2 = new Agent({
          id: 'test-agent-2',
          name: 'test-agent-2',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'London' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
        });

        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({
            prompt1: z.string(),
            prompt2: z.string(),
          }),
          outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          execute: async ({ inputData }) => ({
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          }),
        });

        new Mastra({
          workflows: { 'agent-detailed-streaming-test': workflow },
          agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
          idGenerator: () => randomUUID(),
        });

        const agentStep1 = createStep(agent);
        const agentStep2 = createStep(agent2);

        workflow
          .then(startStep)
          .map({
            prompt: {
              step: startStep,
              path: 'prompt1',
            },
          })
          .then(agentStep1)
          .map({
            prompt: {
              step: startStep,
              path: 'prompt2',
            },
          })
          .then(agentStep2)
          .commit();

        const run = await workflow.createRun({
          runId: 'test-run-id',
        });
        const { stream } = run.streamLegacy({
          inputData: {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
        });

        const values: StreamEvent[] = [];
        for await (const value of stream.values()) {
          values.push(value);
        }

        expect(values).toMatchObject([
          {
            payload: { runId: 'test-run-id' },
            type: 'start',
          },
          {
            payload: {
              id: 'start',
              payload: {
                prompt1: 'Capital of France, just the name',
                prompt2: 'Capital of UK, just the name',
              },
              startedAt: expect.any(Number),
              stepCallId: expect.any(String),
              status: 'running',
            },
            type: 'step-start',
          },
          {
            payload: {
              id: 'start',
              output: {
                prompt1: 'Capital of France, just the name',
                prompt2: 'Capital of UK, just the name',
              },
              endedAt: expect.any(Number),
              status: 'success',
            },
            type: 'step-result',
          },
          {
            payload: {
              id: 'start',
              stepCallId: expect.any(String),
              metadata: {},
            },
            type: 'step-finish',
          },
          {
            payload: {
              id: expect.stringMatching(/^mapping_/),
              payload: {
                prompt1: 'Capital of France, just the name',
                prompt2: 'Capital of UK, just the name',
              },
              startedAt: expect.any(Number),
              stepCallId: expect.any(String),
              status: 'running',
            },
            type: 'step-start',
          },
          {
            payload: {
              id: expect.stringMatching(/^mapping_/),
              endedAt: expect.any(Number),
              output: {
                prompt: 'Capital of France, just the name',
              },
              status: 'success',
            },
            type: 'step-result',
          },
          {
            payload: {
              id: expect.stringMatching(/^mapping_/),
              metadata: {},
              stepCallId: expect.any(String),
            },
            type: 'step-finish',
          },
          {
            payload: {
              id: 'test-agent-1',
              payload: {
                prompt: 'Capital of France, just the name',
              },
              startedAt: expect.any(Number),
              stepCallId: expect.any(String),
              status: 'running',
            },
            type: 'step-start',
          },
          {
            args: {
              prompt: 'Capital of France, just the name',
            },
            name: 'test-agent-1',
            type: 'tool-call-streaming-start',
          },
          {
            args: {
              prompt: 'Capital of France, just the name',
            },
            argsTextDelta: 'Paris',
            name: 'test-agent-1',
            type: 'tool-call-delta',
          },
          {
            args: {
              prompt: 'Capital of France, just the name',
            },
            name: 'test-agent-1',
            type: 'tool-call-streaming-finish',
          },
          {
            payload: {
              id: 'test-agent-1',
              output: {
                text: 'Paris',
              },
              endedAt: expect.any(Number),
              status: 'success',
            },
            type: 'step-result',
          },
          {
            payload: {
              id: 'test-agent-1',
              metadata: {},
              stepCallId: expect.any(String),
            },
            type: 'step-finish',
          },
          {
            payload: {
              id: expect.stringMatching(/^mapping_/),
              payload: {
                text: 'Paris',
              },
              startedAt: expect.any(Number),
              stepCallId: expect.any(String),
              status: 'running',
            },
            type: 'step-start',
          },
          {
            payload: {
              id: expect.stringMatching(/^mapping_/),
              endedAt: expect.any(Number),
              output: {
                prompt: 'Capital of UK, just the name',
              },
              status: 'success',
            },
            type: 'step-result',
          },
          {
            payload: {
              id: expect.stringMatching(/^mapping_/),
              metadata: {},
              stepCallId: expect.any(String),
            },
            type: 'step-finish',
          },
          {
            payload: {
              id: 'test-agent-2',
              payload: {
                prompt: 'Capital of UK, just the name',
              },
              startedAt: expect.any(Number),
              stepCallId: expect.any(String),
              status: 'running',
            },
            type: 'step-start',
          },
          {
            args: {
              prompt: 'Capital of UK, just the name',
            },
            name: 'test-agent-2',
            type: 'tool-call-streaming-start',
          },
          {
            args: {
              prompt: 'Capital of UK, just the name',
            },
            argsTextDelta: 'London',
            name: 'test-agent-2',
            type: 'tool-call-delta',
          },
          {
            args: {
              prompt: 'Capital of UK, just the name',
            },
            name: 'test-agent-2',
            type: 'tool-call-streaming-finish',
          },
          {
            payload: {
              id: 'test-agent-2',
              endedAt: expect.any(Number),
              output: {
                text: 'London',
              },
              status: 'success',
            },
            type: 'step-result',
          },
          {
            payload: {
              id: 'test-agent-2',
              metadata: {},
              stepCallId: expect.any(String),
            },
            type: 'step-finish',
          },
          {
            payload: {
              runId: 'test-run-id',
            },
            type: 'finish',
          },
        ]);
      });

      it('should be able to use an agent as a step (stream)', async () => {
        const entry = registry!['agent-streaming-workflow']!;
        const { stream } = ctx;

        if (!entry || !stream) {
          // Skip if Agent not provided or streaming not implemented
          return;
        }

        const { workflow } = entry;

        const { events, result } = await stream(
          workflow,
          {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
          {},
          'stream',
        );

        expect(result.status).toBe('success');

        // Filter out tool-call streaming events for cleaner comparison
        const workflowEvents = events.filter(
          e => !['tool-call-streaming-start', 'tool-call-delta', 'tool-call-streaming-finish'].includes(e.type),
        );

        // Verify workflow events structure
        const eventTypes = workflowEvents.map(e => e.type);
        expect(eventTypes).toContain('workflow-start');
        expect(eventTypes).toContain('workflow-step-start');
        expect(eventTypes).toContain('workflow-step-result');
        expect(eventTypes).toContain('workflow-finish');

        // Verify agent outputs are correct
        expect(result.steps['test-agent-1']).toMatchObject({
          status: 'success',
          output: { text: 'Paris' },
        });
        expect(result.steps['test-agent-2']).toMatchObject({
          status: 'success',
          output: { text: 'London' },
        });
      });

      it.skipIf(skipTests.agentOptions)('should pass agentOptions when wrapping agent with createStep', async () => {
        const entry = registry!['streaming-agent-options-workflow']!;
        const { execute } = ctx;

        if (!entry) {
          // Skip if Agent not provided
          return;
        }

        const { workflow, mocks, resetMocks, getReceivedOptions } = entry;
        resetMocks?.();

        const result = await execute(workflow, { prompt: 'Test prompt' });

        expect(result.status).toBe('success');
        expect(result.steps['test-agent-with-options']).toMatchObject({
          status: 'success',
          output: { text: 'Response' },
        });

        // Verify doStream was called
        expect(mocks.doStreamSpy).toHaveBeenCalled();

        // Verify options were passed through
        const receivedOptions = getReceivedOptions?.();
        expect(receivedOptions?.temperature).toBe(0.7);
        expect(receivedOptions?.instructionsOverridden).toBe(true);
      });

      it('should pass agentOptions with callbacks when wrapping agent with createStep', async () => {
        const { createWorkflow, createStep, Agent } = ctx;

        if (!Agent) {
          return;
        }

        const onFinishSpy = vi.fn();
        const onChunkSpy = vi.fn();
        const maxSteps = 5;

        const doStreamSpy = vi.fn<any>(async ({ prompt, temperature }: { prompt: any; temperature: any }) => {
          const systemMessage = prompt?.find((m: any) => m.role === 'system');
          expect(systemMessage?.content).toContain('overridden instructions');
          expect(systemMessage?.content).not.toContain('original instructions');
          expect(temperature).toBe(0.7);

          return {
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'Response' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          };
        });

        const agent = new Agent({
          id: 'test-agent-with-options',
          name: 'Test Agent With Options',
          instructions: 'original instructions',
          model: new MockLanguageModelV1({
            doStream: doStreamSpy,
          }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow-agent-options-callbacks',
          inputSchema: z.object({ prompt: z.string() }),
          outputSchema: z.object({ text: z.string() }),
        });

        new Mastra({
          workflows: { 'test-workflow-agent-options-callbacks': workflow },
          agents: { 'test-agent-with-options': agent },
          idGenerator: () => randomUUID(),
        });

        const agentStep = createStep(agent, {
          maxSteps,
          onFinish: onFinishSpy,
          onChunk: onChunkSpy,
          instructions: 'overridden instructions',
          temperature: 0.7,
        });

        workflow
          .map({ prompt: { value: 'test', schema: z.string() } })
          .then(agentStep)
          .commit();

        const run = await workflow.createRun({ runId: 'test-run-id-options' });
        const result = await run.start({ inputData: { prompt: 'Test prompt' } });

        expect(result.status).toBe('success');
        if (result.status === 'success') {
          expect(result.result).toEqual({ text: 'Response' });
        }

        expect(doStreamSpy).toHaveBeenCalled();
        expect(onFinishSpy).toHaveBeenCalled();
        expect(onChunkSpy).toHaveBeenCalled();
      });

      it('should be able to use an agent as a step with detailed events (stream vNext)', async () => {
        const { createWorkflow, createStep, Agent } = ctx;

        if (!Agent) {
          return;
        }

        const workflow = createWorkflow({
          id: 'agent-vnext-streaming-test',
          inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          outputSchema: z.object({}),
        });

        const agent = new Agent({
          id: 'test-agent-1',
          name: 'test-agent-1',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV2({
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Paris' },
                  { type: 'text-start', id: 'text-1' },
                  {
                    type: 'finish',
                    id: '2',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
        });

        const agent2 = new Agent({
          id: 'test-agent-2',
          name: 'test-agent-2',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV2({
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'London' },
                  { type: 'text-start', id: 'text-1' },
                  {
                    type: 'finish',
                    id: '2',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
        });

        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          execute: async ({ inputData }) => ({
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          }),
        });

        new Mastra({
          workflows: { 'agent-vnext-streaming-test': workflow },
          agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
          idGenerator: () => randomUUID(),
        });

        const agentStep1 = createStep(agent);
        const agentStep2 = createStep(agent2);

        workflow
          .then(startStep)
          .map({ prompt: { step: startStep, path: 'prompt1' } })
          .then(agentStep1)
          .map({ prompt: { step: startStep, path: 'prompt2' } })
          .then(agentStep2)
          .commit();

        const run = await workflow.createRun({ runId: 'test-run-id' });
        const streamResult = run.stream({
          inputData: {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
        });

        const values: any[] = [];
        for await (const value of streamResult.fullStream) {
          values.push(value);
        }

        const workflowEvents = values.filter(value => value.type !== 'workflow-step-output');
        const agentEvents = values.filter(value => value.type === 'workflow-step-output');

        expect(agentEvents.map(event => event?.payload?.output?.type)).toEqual([
          'start',
          'step-start',
          'text-start',
          'text-delta',
          'text-start',
          'step-finish',
          'finish',
          'start',
          'step-start',
          'text-start',
          'text-delta',
          'text-start',
          'step-finish',
          'finish',
        ]);

        // Verify workflow events have correct structure
        expect(workflowEvents[0]).toMatchObject({
          type: 'workflow-start',
          runId: 'test-run-id',
        });
        expect(workflowEvents[workflowEvents.length - 1]).toMatchObject({
          type: 'workflow-finish',
          runId: 'test-run-id',
        });
      });

      it('should be able to use an agent as a step (non-streaming)', async () => {
        const { createWorkflow, createStep, Agent } = ctx;

        if (!Agent) {
          return;
        }

        const workflow = createWorkflow({
          id: 'agent-nonstreaming-test',
          inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          outputSchema: z.object({}),
        });

        const agent = new Agent({
          id: 'test-agent-1',
          name: 'test-agent-1',
          instructions: 'test agent instructions',
          description: 'test-agent-1 description',
          model: new MockLanguageModelV1({
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'Paris' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
        });

        const agent2 = new Agent({
          id: 'test-agent-2',
          name: 'test-agent-2',
          instructions: 'test agent instructions',
          description: 'test-agent-2 description',
          model: new MockLanguageModelV1({
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'London' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
        });

        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          execute: async ({ inputData }) => ({
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          }),
        });

        new Mastra({
          workflows: { 'agent-nonstreaming-test': workflow },
          agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
          idGenerator: () => randomUUID(),
        });

        const agentStep1 = createStep(agent);
        const agentStep2 = createStep(agent2);

        workflow
          .then(startStep)
          .map({ prompt: { step: startStep, path: 'prompt1' } })
          .then(agentStep1)
          .map({ prompt: { step: startStep, path: 'prompt2' } })
          .then(agentStep2)
          .commit();

        const run = await workflow.createRun();
        const result = await run.start({
          inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
        });

        expect(result.steps['test-agent-1']).toEqual({
          status: 'success',
          output: { text: 'Paris' },
          payload: { prompt: 'Capital of France, just the name' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(result.steps['test-agent-2']).toEqual({
          status: 'success',
          output: { text: 'London' },
          payload: { prompt: 'Capital of UK, just the name' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(workflow.steps['test-agent-1']?.description).toBe('test-agent-1 description');
        expect(workflow.steps['test-agent-2']?.description).toBe('test-agent-2 description');
        expect(workflow.steps['test-agent-1']?.component).toBe('AGENT');
        expect(workflow.steps['test-agent-2']?.component).toBe('AGENT');
      });

      it('should be able to use an agent as a step via mastra instance', async () => {
        const { createWorkflow, createStep, Agent } = ctx;

        if (!Agent) {
          return;
        }

        const workflow = createWorkflow({
          id: 'agent-mastra-instance-test',
          inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          outputSchema: z.object({}),
        });

        const agent = new Agent({
          id: 'test-agent-1',
          name: 'test-agent-1',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'Paris',
            }),
          }),
        });

        const agent2 = new Agent({
          id: 'test-agent-2',
          name: 'test-agent-2',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'London',
            }),
          }),
        });

        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          execute: async ({ inputData }) => ({
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          }),
        });

        new Mastra({
          logger: false,
          workflows: { 'agent-mastra-instance-test': workflow },
          agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        });

        workflow
          .then(startStep)
          .map({ prompt: { step: startStep, path: 'prompt1' } })
          .then(
            createStep({
              id: 'agent-step-1',
              inputSchema: z.object({ prompt: z.string() }),
              outputSchema: z.object({ text: z.string() }),
              execute: async ({ inputData, mastra }) => {
                const agent = mastra.getAgent('test-agent-1');
                const result = await agent.generateLegacy([{ role: 'user', content: inputData.prompt }]);
                return { text: result.text };
              },
            }),
          )
          .map({ prompt: { step: startStep, path: 'prompt2' } })
          .then(
            createStep({
              id: 'agent-step-2',
              inputSchema: z.object({ prompt: z.string() }),
              outputSchema: z.object({ text: z.string() }),
              execute: async ({ inputData, mastra }) => {
                const agent = mastra.getAgent('test-agent-2');
                const result = await agent.generateLegacy([{ role: 'user', content: inputData.prompt }]);
                return { text: result.text };
              },
            }),
          )
          .commit();

        const run = await workflow.createRun();
        const result = await run.start({
          inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
        });

        expect(result.steps['agent-step-1']).toEqual({
          status: 'success',
          output: { text: 'Paris' },
          payload: { prompt: 'Capital of France, just the name' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(result.steps['agent-step-2']).toEqual({
          status: 'success',
          output: { text: 'London' },
          payload: { prompt: 'Capital of UK, just the name' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });
      });

      it.skipIf(skipTests.streamingTripwireInput)(
        'should bubble up tripwire from agent input processor to workflow result',
        async () => {
          const { createWorkflow, createStep, Agent } = ctx;

          if (!Agent) {
            return;
          }

          const tripwireProcessor = {
            id: 'tripwire-processor',
            name: 'Tripwire Processor',
            processInput: async ({ messages, abort }: any) => {
              const hasBlockedContent = messages.some((msg: any) =>
                msg.content?.parts?.some((part: any) => part.type === 'text' && part.text?.includes('blocked')),
              );

              if (hasBlockedContent) {
                abort('Content blocked by policy', { retry: true, metadata: { severity: 'high' } });
              }
              return messages;
            },
          };

          const mockModel = new MockLanguageModelV2({
            doStream: async () => ({
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  });
                  controller.enqueue({ type: 'text-start', id: '1' });
                  controller.enqueue({ type: 'text-delta', id: '1', delta: 'Response' });
                  controller.enqueue({ type: 'text-end', id: '1' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  });
                  controller.close();
                },
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            }),
          });

          const agent = new Agent({
            id: 'Tripwire Test Agent',
            name: 'Tripwire Test Agent',
            instructions: 'You are helpful',
            model: mockModel,
            inputProcessors: [tripwireProcessor],
          });

          const workflow = createWorkflow({
            id: 'agent-tripwire-workflow',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ text: z.string() }),
          });

          const agentStep = createStep(agent);
          workflow.then(agentStep).commit();

          const run = await workflow.createRun();
          const result = await run.start({
            inputData: { prompt: 'This message contains blocked content' },
          });

          expect(result.status).toBe('tripwire');
          if (result.status === 'tripwire') {
            expect(result.tripwire.reason).toBe('Content blocked by policy');
            expect(result.tripwire.retry).toBe(true);
            expect(result.tripwire.processorId).toBe('tripwire-processor');
          }
        },
      );

      it.skipIf(skipTests.streamingTripwireStreaming)(
        'should return tripwire status when streaming agent in workflow',
        async () => {
          const { createWorkflow, createStep, Agent } = ctx;

          if (!Agent) {
            return;
          }

          const tripwireProcessor = {
            id: 'stream-tripwire-processor',
            name: 'Stream Tripwire Processor',
            processInput: async ({ messages, abort }: any) => {
              const hasBlockedContent = messages.some((msg: any) =>
                msg.content?.parts?.some((part: any) => part.type === 'text' && part.text?.includes('forbidden')),
              );

              if (hasBlockedContent) {
                abort('Forbidden content detected', { retry: false, metadata: { type: 'forbidden' } });
              }
              return messages;
            },
          };

          const mockModel = new MockLanguageModelV2({
            doStream: async () => ({
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  });
                  controller.enqueue({ type: 'text-start', id: '1' });
                  controller.enqueue({ type: 'text-delta', id: '1', delta: 'Hello' });
                  controller.enqueue({ type: 'text-end', id: '1' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  });
                  controller.close();
                },
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            }),
          });

          const agent = new Agent({
            id: 'Stream Tripwire Agent',
            name: 'Stream Tripwire Agent',
            instructions: 'You are helpful',
            model: mockModel,
            inputProcessors: [tripwireProcessor],
          });

          const workflow = createWorkflow({
            id: 'stream-tripwire-workflow',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ text: z.string() }),
          });

          const agentStep = createStep(agent);
          workflow.then(agentStep).commit();

          const run = await workflow.createRun();

          // Use streaming to verify workflow returns tripwire status
          const chunks: any[] = [];
          const streamResult = run.stream({ inputData: { prompt: 'This has forbidden content' } });

          // Collect all chunks
          for await (const chunk of streamResult.fullStream) {
            chunks.push(chunk);
          }

          const result = await streamResult.result;

          // Workflow should return tripwire status even when streaming
          expect(result.status).toBe('tripwire');
          if (result.status === 'tripwire') {
            expect(result.tripwire.reason).toBe('Forbidden content detected');
            expect(result.tripwire.retry).toBe(false);
            expect(result.tripwire.metadata).toEqual({ type: 'forbidden' });
            expect(result.tripwire.processorId).toBe('stream-tripwire-processor');
          }
        },
      );

      it.skipIf(skipTests.streamingTripwireOutputStream)(
        'should handle tripwire from output stream processor in agent within workflow',
        async () => {
          const { createWorkflow, createStep, Agent } = ctx;

          if (!Agent) {
            return;
          }

          const outputStreamTripwireProcessor = {
            id: 'output-stream-tripwire-processor',
            name: 'Output Stream Tripwire Processor',
            processOutputStream: async ({ part, abort }: any) => {
              // Check if the text delta contains inappropriate content
              if (part?.type === 'text-delta' && part?.payload?.text?.includes('inappropriate')) {
                abort('Output contains inappropriate content', { retry: true });
              }
              return part;
            },
          };

          const mockModel = new MockLanguageModelV2({
            doStream: async () => ({
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  });
                  controller.enqueue({ type: 'text-start', id: '1' });
                  controller.enqueue({ type: 'text-delta', id: '1', delta: 'This is inappropriate content' });
                  controller.enqueue({ type: 'text-end', id: '1' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  });
                  controller.close();
                },
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            }),
          });

          const agent = new Agent({
            id: 'Output Tripwire Agent',
            name: 'Output Tripwire Agent',
            instructions: 'You are helpful',
            model: mockModel,
            outputProcessors: [outputStreamTripwireProcessor],
          });

          const workflow = createWorkflow({
            id: 'output-tripwire-workflow',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ text: z.string() }),
          });

          const agentStep = createStep(agent);
          workflow.then(agentStep).commit();

          const run = await workflow.createRun();

          const result = await run.start({
            inputData: { prompt: 'Tell me something' },
          });

          // Workflow should return tripwire status
          expect(result.status).toBe('tripwire');
          if (result.status === 'tripwire') {
            expect(result.tripwire.reason).toBe('Output contains inappropriate content');
            expect(result.tripwire.retry).toBe(true);
            expect(result.tripwire.processorId).toBe('output-stream-tripwire-processor');
          }
        },
      );

      it.skipIf(skipTests.schemaStructuredOutput)(
        'should pass structured output from agent step to next step with correct types',
        async () => {
          const { createWorkflow, createStep, Agent } = ctx;

          if (!Agent) {
            return;
          }

          const articleSchema = z.object({
            title: z.string(),
            summary: z.string(),
            tags: z.array(z.string()),
          });

          const articleJson = JSON.stringify({
            title: 'Test Article',
            summary: 'This is a test summary',
            tags: ['test', 'article'],
          });

          const agent = new Agent({
            id: 'article-generator',
            name: 'Article Generator',
            instructions: 'Generate an article with title, summary, and tags',
            model: new MockLanguageModelV2({
              doGenerate: async () => ({
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                content: [{ type: 'text', text: articleJson }],
                warnings: [],
              }),
              doStream: async () => ({
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] });
                    controller.enqueue({
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    });
                    controller.enqueue({ type: 'text-start', id: 'text-1' });
                    controller.enqueue({ type: 'text-delta', id: 'text-1', delta: articleJson });
                    controller.enqueue({ type: 'text-end', id: 'text-1' });
                    controller.enqueue({
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                    });
                    controller.close();
                  },
                }),
              }),
            }),
          });

          // @ts-expect-error - Type instantiation is excessively deep
          const agentStep = createStep(agent, {
            structuredOutput: { schema: articleSchema },
          });

          const processArticleStep = createStep({
            id: 'process-article',
            description: 'Process the generated article',
            inputSchema: articleSchema,
            outputSchema: z.object({ processed: z.boolean(), tagCount: z.number() }),
            execute: async ({ inputData }: any) => ({
              processed: true,
              tagCount: inputData.tags.length,
            }),
          });

          const workflow = createWorkflow({
            id: 'article-workflow',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ processed: z.boolean(), tagCount: z.number() }),
          });

          new Mastra({
            workflows: { 'article-workflow': workflow },
            agents: { 'article-generator': agent },
            idGenerator: () => randomUUID(),
          });

          workflow
            .then(agentStep)
            .then(processArticleStep as any)
            .commit();

          const run = await workflow.createRun({ runId: 'structured-output-test' });
          const result = await run.start({
            inputData: { prompt: 'Generate an article about testing' },
          });

          expect(result.status).toBe('success');
          if (result.status === 'success') {
            expect(result.result).toEqual({ processed: true, tagCount: 2 });
          }
        },
      );
    });
  });
}
