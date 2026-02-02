/**
 * Evented-engine-specific tests for workflows.
 *
 * These tests cover evented-specific APIs and behaviors that are NOT covered
 * by the shared test suite in workflows/_test-utils/. Tests for general workflow
 * behavior (basic execution, conditions, loops, etc.) are in the shared suite.
 *
 * Tests in this file cover:
 * - Streaming Legacy API (streamLegacy with evented-specific events)
 * - Streaming API (stream/resumeStream with evented-specific events)
 * - writer.custom for custom event emission
 * - Error preservation in evented streaming
 */

import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import type { StreamEvent } from '../types';
import { createStep, createWorkflow } from '.';

const testStorage = new MockStore();

describe('Workflow (Evented Engine Specific)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const workflowsStore = await testStorage.getStore('workflows');
    await workflowsStore?.dangerouslyClearAll();
  });

  describe('Streaming Legacy', () => {
    it('should generate a stream', async () => {
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

      const { stream, getWorkflowState } = run.streamLegacy({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of stream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await getWorkflowState();

      // console.log('executionResult===', JSON.stringify(executionResult, null, 2));

      expect(watchData.length).toBe(8);
      expect(watchData).toMatchObject([
        {
          payload: {
            runId: 'test-run-id',
          },
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
            output: {
              result: 'success1',
            },
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
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step2',
            output: {
              result: 'success2',
            },
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
          payload: {
            runId: 'test-run-id',
          },
          type: 'finish',
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toEqual({
        status: 'success',
        output: { result: 'success2' },
        payload: {
          result: 'success1',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should handle basic suspend and resume flow', async () => {
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

      const { stream, getWorkflowState } = run.streamLegacy({ inputData: { input: 'test' } });

      for await (const data of stream) {
        if (data.type === 'step-suspended') {
          expect(promptAgentAction).toHaveBeenCalledTimes(1);

          // make it async to show that execution is not blocked
          setImmediate(() => {
            const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
            run.resume({ resumeData: resumeData as any, step: promptAgent });
          });
          expect(evaluateToneAction).not.toHaveBeenCalledTimes(1);
        }
      }

      expect(evaluateToneAction).toHaveBeenCalledTimes(1);

      const resumeResult = await getWorkflowState();
      await mastra.stopEventEngine();

      expect(resumeResult.steps).toEqual({
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
          suspendPayload: {},
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
        improveResponse: {
          status: 'success',
          output: { improvedOutput: 'improved output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
          payload: { improvedOutput: 'improved output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    it('should be able to use an agent as a step', async () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({}),
      });

      const agent = new Agent({
        id: 'test-agent-1',
        name: 'test-agent-1',
        instructions: 'test agent instructions"',
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

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

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
      const { stream } = await run.streamLegacy({
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
          payload: {
            runId: 'test-run-id',
          },
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
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            id: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
          },
          type: 'step-start',
        },
        {
          payload: {
            id: expect.any(String),
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
            id: expect.any(String),
            metadata: {},
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
          },
          type: 'step-finish',
        },
        {
          payload: {
            id: expect.any(String),
            payload: {
              text: 'Paris',
            },
            startedAt: expect.any(Number),
          },
          type: 'step-start',
        },
        {
          payload: {
            id: expect.any(String),
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
            id: expect.any(String),
            metadata: {},
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

      await mastra.stopEventEngine();
    });

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

      const { stream, getWorkflowState } = run.streamLegacy({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of stream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await getWorkflowState();

      expect(watchData.length).toBe(11);
      expect(watchData).toMatchObject([
        {
          payload: {
            runId: 'test-run-id',
          },
          type: 'start',
        },
        {
          payload: {
            id: 'step1',
            startedAt: expect.any(Number),
            status: 'running',
            payload: {},
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step1',
            output: {
              result: 'success1',
            },
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
            id: expect.any(String),
            startedAt: expect.any(Number),
            status: 'waiting',
            payload: {
              result: 'success1',
            },
          },
          type: 'step-waiting',
        },
        {
          payload: {
            id: expect.any(String),
            endedAt: expect.any(Number),
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'success1',
            },
          },
          type: 'step-result',
        },
        {
          type: 'step-finish',
          payload: {
            id: expect.any(String),
            metadata: {},
          },
        },
        {
          payload: {
            id: 'step2',
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step2',
            output: {
              result: 'success2',
            },
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
          payload: {
            runId: 'test-run-id',
          },
          type: 'finish',
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toEqual({
        status: 'success',
        output: { result: 'success2' },
        payload: {
          result: 'success1',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });
  });

  describe('Streaming', () => {
    it('should generate a stream', async () => {
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

      const output = await run.stream({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of output.fullStream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await output.result;

      expect(watchData.length).toBe(8);
      expect(watchData).toMatchObject([
        {
          type: 'workflow-start',
          from: 'WORKFLOW',
          payload: {
            workflowId: 'test-workflow',
          },
        },
        {
          type: 'workflow-start',
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },
        },
        {
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          payload: {
            id: 'step1',
          },
        },
        {
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          payload: {
            id: 'step1',
          },
        },
        {
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          payload: {
            id: 'step2',
          },
        },
        {
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          payload: {
            id: 'step2',
          },
        },
        {
          type: 'workflow-finish',
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },
        },
        {
          type: 'workflow-finish',
          from: 'WORKFLOW',
          payload: {
            workflowStatus: 'success',
          },
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toEqual({
        status: 'success',
        output: { result: 'success2' },
        payload: {
          result: 'success1',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

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

      expect(watchData.length).toBe(7);
      expect(watchData).toMatchObject([
        {
          type: 'workflow-start',
          from: 'WORKFLOW',
          payload: {
            workflowId: 'test-workflow',
          },
        },
        {
          type: 'workflow-start',
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },
        },
        {
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          payload: {
            id: 'step1',
          },
        },
        {
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          payload: {
            id: 'step1',
          },
        },
        {
          type: 'workflow-paused',
          payload: {},
          runId,
          from: 'WORKFLOW',
        },
        {
          type: 'workflow-finish',
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },
        },
        {
          type: 'workflow-finish',
          from: 'WORKFLOW',
          payload: {
            workflowStatus: 'paused',
          },
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(executionResult.steps.step2).toBeUndefined();
      expect((executionResult as any).result).toBeUndefined();
      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(executionResult.status).toBe('paused');
      await mastra.stopEventEngine();
    });

    it('should handle basic suspend and resume flow', async () => {
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

      let output = await run.stream({ inputData: { input: 'test' }, closeOnSuspend: true });

      for await (const data of output.fullStream) {
        if (data.type === 'workflow-step-suspended') {
          expect(promptAgentAction).toHaveBeenCalledTimes(1);
          expect(evaluateToneAction).not.toHaveBeenCalledTimes(1);
        }
      }

      const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };

      output = await run.resumeStream({ resumeData, step: promptAgent });
      for await (const _data of output.fullStream) {
      }

      expect(evaluateToneAction).toHaveBeenCalledTimes(1);

      const resumeResult = await output.result;
      await mastra.stopEventEngine();

      expect(resumeResult.steps).toEqual({
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
          suspendPayload: {},
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
        improveResponse: {
          status: 'success',
          output: { improvedOutput: 'improved output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
          payload: { improvedOutput: 'improved output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    it('should be able to use an agent as a step', async () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({}),
      });

      const agent = new Agent({
        id: 'test-agent-1',
        name: 'test-agent-1',
        instructions: 'test agent instructions"',
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

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

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
      const output = await run.stream({
        inputData: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
      });

      const values: StreamEvent[] = [];
      for await (const value of output.fullStream) {
        values.push(value);
      }

      // Filter out tool-call streaming events for comparison
      const filteredValues = values.filter(
        v => !['tool-call-streaming-start', 'tool-call-delta', 'tool-call-streaming-finish'].includes(v.type),
      );

      expect(filteredValues).toMatchObject([
        {
          from: 'WORKFLOW',
          payload: {
            workflowId: 'test-workflow',
          },
          runId: 'test-run-id',
          type: 'workflow-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },
          runId: 'test-run-id',
          type: 'workflow-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: 'start',
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
            stepName: expect.any(String),
          },
          runId: 'test-run-id',
          type: 'workflow-step-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: 'start',
            output: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'success',
            stepName: expect.any(String),
          },
          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
            stepName: expect.any(String),
          },
          runId: 'test-run-id',
          type: 'workflow-step-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: expect.any(String),
            output: {
              prompt: 'Capital of France, just the name',
            },
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'success',
            stepName: expect.any(String),
          },

          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: expect.any(String),

            payload: {
              prompt: 'Capital of France, just the name',
            },

            startedAt: expect.any(Number),
            status: 'running',
            stepName: expect.any(String),
          },

          runId: 'test-run-id',
          type: 'workflow-step-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: 'test-agent-1',
            output: {
              text: 'Paris',
            },

            payload: {
              prompt: 'Capital of France, just the name',
            },

            startedAt: expect.any(Number),
            status: 'success',
            stepName: expect.any(String),
          },
          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: expect.any(String),
            payload: {
              text: 'Paris',
            },

            startedAt: expect.any(Number),
            status: 'running',
            stepName: expect.any(String),
          },

          runId: 'test-run-id',
          type: 'workflow-step-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: expect.any(String),
            output: {
              prompt: 'Capital of UK, just the name',
            },
            payload: {
              text: 'Paris',
            },
            startedAt: expect.any(Number),
            status: 'success',
            stepName: expect.any(String),
          },

          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: 'test-agent-2',
            payload: {
              prompt: 'Capital of UK, just the name',
            },

            startedAt: expect.any(Number),
            status: 'running',
            stepName: expect.any(String),
          },

          runId: 'test-run-id',
          type: 'workflow-step-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: 'test-agent-2',
            output: {
              text: 'London',
            },
            payload: {
              prompt: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'success',
            stepName: expect.any(String),
          },

          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },

          runId: 'test-run-id',
          type: 'workflow-finish',
        },
        {
          from: 'WORKFLOW',
          payload: {
            metadata: {},
            output: {
              usage: {
                cachedInputTokens: 0,
                inputTokens: 0,
                outputTokens: 0,
                reasoningTokens: 0,
                totalTokens: 0,
              },
            },
            workflowStatus: 'success',
          },
          runId: 'test-run-id',
          type: 'workflow-finish',
        },
      ]);

      await mastra.stopEventEngine();
    });

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

      expect(watchData.length).toBe(10);
      expect(watchData).toMatchObject([
        {
          from: 'WORKFLOW',
          payload: {
            workflowId: 'test-workflow',
          },
          runId: 'test-run-id',
          type: 'workflow-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },
          runId: 'test-run-id',
          type: 'workflow-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: 'step1',
            payload: {},
            startedAt: expect.any(Number),
            status: 'running',
            stepName: 'step1',
          },
          runId: 'test-run-id',
          type: 'workflow-step-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: 'step1',
            output: {
              result: 'success1',
            },
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            stepName: 'step1',
          },
          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: expect.any(String),
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
            status: 'waiting',
            stepName: expect.any(String),
          },
          runId: 'test-run-id',
          type: 'workflow-step-waiting',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: expect.any(String),
            output: {
              result: 'success1',
            },
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
            status: 'success',
            stepName: expect.any(String),
          },
          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            id: 'step2',
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
            status: 'running',
            stepName: 'step2',
          },
          runId: 'test-run-id',
          type: 'workflow-step-start',
        },
        {
          from: 'WORKFLOW',
          payload: {
            endedAt: expect.any(Number),
            id: 'step2',
            output: {
              result: 'success2',
            },
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
            status: 'success',
            stepName: 'step2',
          },
          runId: 'test-run-id',
          type: 'workflow-step-result',
        },
        {
          from: 'WORKFLOW',
          payload: {
            runId: 'test-run-id',
          },
          runId: 'test-run-id',
          type: 'workflow-finish',
        },
        {
          from: 'WORKFLOW',
          payload: {
            workflowStatus: 'success',
            metadata: {},
            output: {
              usage: {
                cachedInputTokens: 0,
                inputTokens: 0,
                outputTokens: 0,
                reasoningTokens: 0,
                totalTokens: 0,
              },
            },
          },
          runId: 'test-run-id',
          type: 'workflow-finish',
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toEqual({
        status: 'success',
        output: { result: 'success2' },
        payload: {
          result: 'success1',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

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

    it('should handle custom event emission using writer', async () => {
      const getUserInput = createStep({
        id: 'getUserInput',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
        execute: async ({ inputData }) => {
          return {
            userInput: inputData.input,
          };
        },
      });

      const promptAgent = createStep({
        id: 'promptAgent',
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

      const resumableWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [getUserInput, promptAgent],
      });

      resumableWorkflow.then(getUserInput).then(promptAgent).commit();

      const mastra = new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': resumableWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await resumableWorkflow.createRun();

      let streamResult = run.stream({ inputData: { input: 'test input for stream' } });

      for await (const data of streamResult.fullStream) {
        if (data.type === 'workflow-step-output') {
          expect(data.payload.output).toMatchObject({
            type: 'custom-event',
            payload: {
              input: 'test input for stream',
            },
          });
        }
      }

      let result = await streamResult.result;

      const resumeData = { userInput: 'test input for resumption' };
      streamResult = run.resumeStream({ resumeData, step: promptAgent });
      for await (const data of streamResult.fullStream) {
        if (data.type === 'workflow-step-output') {
          expect(data.payload.output).toMatchObject({
            type: 'custom-event',
            payload: {
              input: 'test input for resumption',
            },
          });
        }
      }

      result = await streamResult.result;
      if (!result) {
        expect.fail('Resume result is not set');
      }

      await mastra.stopEventEngine();
    });

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

    it('should preserve error details in streaming workflow', async () => {
      const customErrorProps = {
        statusCode: 429,
        responseHeaders: {
          'x-ratelimit-reset': '1234567890',
          'retry-after': '30',
        },
      };
      const testError = new Error('Rate limit exceeded');
      (testError as any).statusCode = customErrorProps.statusCode;
      (testError as any).responseHeaders = customErrorProps.responseHeaders;

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockImplementation(() => {
          throw testError;
        }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'streaming-error-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'streaming-error-workflow': workflow },
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const streamOutput = run.stream({ inputData: {} });
      const result = await streamOutput.result;

      expect(result.status).toBe('failed');

      if (result.status === 'failed') {
        // Evented runtime may return Error instance (not serialized like default runtime)
        expect(result.error).toBeDefined();

        expect((result.error as any).message).toBe('Rate limit exceeded');
        expect((result.error as any).statusCode).toBe(429);
        expect((result.error as any).responseHeaders).toEqual(customErrorProps.responseHeaders);
      }

      await mastra.stopEventEngine();
    });
  });
});
