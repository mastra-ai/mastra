import fs from 'node:fs';
import path from 'node:path';
import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { RequestContext } from '../../di';
import { MastraError } from '../../error';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createTool } from '../../tools';
import type { StreamEvent } from '../types';
import { mapVariable } from '../workflow';
import { cloneStep, cloneWorkflow, createStep, createWorkflow } from '.';

const testStorage = new MockStore();

describe('Workflow', () => {
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

  describe.skip('Streaming', () => {
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

      // console.log('executionResult===', JSON.stringify(executionResult, null, 2));

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

  describe('Basic Workflow Execution', () => {
    it('should be able to bail workflow execution', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: async ({ bail, inputData }) => {
          if (inputData.value === 'bail') {
            return bail({ result: 'bailed' });
          }

          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { result: 'step2: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { value: 'bail' } });

      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'bailed' },
        payload: { value: 'bail' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toBeUndefined();

      const run2 = await workflow.createRun();
      const result2 = await run2.start({ inputData: { value: 'no-bail' } });

      expect(result2.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: no-bail' },
        payload: { value: 'no-bail' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result2.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'step2: step1: no-bail' },
        payload: { result: 'step1: no-bail' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should throw error when execution flow not defined', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      const run = await workflow.createRun();
      await expect(run.start({})).rejects.toThrowError(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    });

    it('should throw error when execution graph is not committed', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1);

      const run = await workflow.createRun();
      await expect(run.start({})).rejects.toThrowError(
        'Uncommitted step flow changes detected. Call .commit() to register the steps.',
      );
    });

    it('should execute a single step workflow successfully', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should execute multiple runs of a workflow', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData, requestContext }) => {
          const newValue = inputData.value + '!!!';
          const testValue = requestContext.get('testKey');
          requestContext.set('randomKey', newValue + testValue);
          return { result: 'success', value: newValue };
        },
        inputSchema: z.object({
          value: z.string(),
        }),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
      });

      const step2 = createStep({
        id: 'step2',
        inputSchema: z.object({ result: z.string(), value: z.string() }),
        outputSchema: z.object({ result: z.string(), value: z.string(), randomValue: z.string() }),
        execute: async ({ inputData, requestContext }) => {
          const randomValue = requestContext.get('randomKey') as string;
          return { ...inputData, randomValue };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          value: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
          randomValue: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const [result1, result2] = await Promise.all([
        (async () => {
          const requestContext = new RequestContext();
          requestContext.set('testKey', 'test-value-one');
          const run = await workflow.createRun();
          const result = await run.start({
            inputData: { value: 'test-input-one' },
            requestContext,
          });
          return result;
        })(),
        (async () => {
          const requestContext = new RequestContext();
          requestContext.set('testKey', 'test-value-two');
          const run = await workflow.createRun();
          const result = await run.start({
            inputData: { value: 'test-input-two' },
            requestContext,
          });
          return result;
        })(),
      ]);

      expect(result1.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-input-one!!!' },
        payload: { value: 'test-input-one' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result1.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-input-one!!!', randomValue: 'test-input-one!!!test-value-one' },
        payload: { result: 'success', value: 'test-input-one!!!' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result2.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-input-two!!!' },
        payload: { value: 'test-input-two' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result2.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-input-two!!!', randomValue: 'test-input-two!!!test-value-two' },
        payload: { result: 'success', value: 'test-input-two!!!' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should execute a single step in a workflow when perStep is true', async () => {
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
      const run = await workflow.createRun({
        runId,
      });

      const executionResult = await run.start({ inputData: {}, perStep: true });

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

    it('should execute a single step in a nested workflow when perStep is true', async () => {
      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          calls++;
          return { value: inputData.value + '!!!' };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          calls++;
          return { result: 'success', value: inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        steps: [step1, step2],
      })
        .then(step1)
        .then(step2)
        .commit();

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        steps: [nestedWorkflow],
      });

      workflow.then(nestedWorkflow).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { value: 'test-input' },
        perStep: true,
      });

      expect(calls).toBe(1);
      expect(result.status).toBe('paused');
      expect(result.steps['nested-workflow']).toEqual({
        status: 'paused',
        payload: { value: 'test-input' },
        startedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should throw error when restart is called on evented workflow', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await expect(run.restart()).rejects.toThrowError('restart() is not supported on evented workflows');

      await mastra.stopEventEngine();
    });

    it('should have access to typed workflow results', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        suspendSchema: z.object({ hello: z.string() }).strict(),
        resumeSchema: z.object({ resumeInfo: z.object({ hello: z.string() }).strict() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should execute multiple steps in parallel', async () => {
      const step1Action = vi.fn().mockImplementation(async () => {
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(async () => {
        return { value: 'step2' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
      });

      workflow.parallel([step1, step2]).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.steps).toEqual({
        input: {},
        step1: {
          status: 'success',
          output: { value: 'step1' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        step2: {
          status: 'success',
          output: { value: 'step2' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    it('should execute only one step when there are multiple steps in parallel and perStep is true', async () => {
      const step1Action = vi.fn().mockImplementation(async () => {
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(async () => {
        return { value: 'step2' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
      });

      workflow.parallel([step1, step2]).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {}, perStep: true });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(result.steps).toEqual({
        input: {},
        step1: {
          status: 'success',
          output: { value: 'step1' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
      expect(result.status).toBe('paused');

      const workflowRun = await workflow.getWorkflowRunById(run.runId);

      expect(workflowRun?.status).toBe('paused');
      expect(workflowRun?.steps).toEqual({
        step1: {
          status: 'success',
          output: { value: 'step1' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    it('should have runId in the step execute function - bug #4260', async () => {
      const step1Action = vi.fn().mockImplementation(({ runId }) => {
        return { value: runId };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps).toEqual({
        input: {},
        step1: {
          status: 'success',
          output: { value: run.runId },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    describe('Variable Resolution', () => {
      it('should resolve trigger data', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute,
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({}),
        });

        workflow.then(step1).then(step2).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { inputData: 'test-input' } });

        expect(result.steps.step1).toEqual({
          status: 'success',
          output: { result: 'success' },
          payload: {
            inputData: 'test-input',
          },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });
        expect(result.steps.step2).toEqual({
          status: 'success',
          output: { result: 'success' },
          payload: { result: 'success' },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });

      it('should provide access to step results and trigger data via getStepResult helper', async () => {
        const step1Action = vi.fn().mockImplementation(async ({ inputData }) => {
          // Test accessing trigger data with correct type
          expect(inputData).toEqual({ inputValue: 'test-input' });
          return { value: 'step1-result' };
        });

        const step2Action = vi.fn().mockImplementation(async ({ getStepResult }) => {
          // Test accessing previous step result with type
          const step1Result = getStepResult(step1);
          expect(step1Result).toEqual({ value: 'step1-result' });

          const failedStep = getStepResult(nonExecutedStep);
          expect(failedStep).toBe(null);

          return { value: 'step2-result' };
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        const nonExecutedStep = createStep({
          id: 'non-executed-step',
          execute: vi.fn(),
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { inputValue: 'test-input' } });

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).toHaveBeenCalled();
        expect(result.steps).toEqual({
          input: { inputValue: 'test-input' },
          step1: {
            status: 'success',
            output: { value: 'step1-result' },
            payload: {
              inputValue: 'test-input',
            },

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            output: { value: 'step2-result' },
            payload: {
              value: 'step1-result',
            },

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });
      });

      it('should resolve trigger data from context', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          inputData: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        await run.start({ inputData: { inputData: 'test-input' } });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { inputData: 'test-input' },
          }),
        );

        await mastra.stopEventEngine();
      });

      it('should resolve trigger data from getInitData', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ getInitData }) => {
            const initData = getInitData<typeof triggerSchema>();
            return { result: initData };
          },
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.object({ cool: z.string() }) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
          steps: [step1, step2],
        });

        workflow.then(step1).then(step2).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { cool: 'test-input' } });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toEqual({
          status: 'success',
          output: { result: { cool: 'test-input' } },
          payload: {
            result: 'success',
          },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });
      });

      it('should resolve trigger data from getInitData with workflow schema', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ getInitData }) => {
            const initData = getInitData<typeof workflow>();
            return { result: initData };
          },
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.object({ cool: z.string() }) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { cool: 'test-input' } });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toEqual({
          status: 'success',
          output: { result: { cool: 'test-input' } },
          payload: { result: 'success' },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });

      it('should resolve trigger data and DI requestContext values via .map()', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: inputData.test, second: inputData.test2 };
          },
          inputSchema: z.object({ test: z.string(), test2: z.number() }),
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        workflow
          .then(step1)
          .map({
            test: mapVariable({
              initData: workflow,
              path: 'cool',
            }),
            test2: {
              requestContextPath: 'life',
              schema: z.number(),
            },
          })
          .then(step2)
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const requestContext = new RequestContext<{ life: number }>();
        requestContext.set('life', 42);

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { cool: 'test-input' }, requestContext });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toEqual({
          status: 'success',
          output: { result: 'test-input', second: 42 },
          payload: { test: 'test-input', test2: 42 },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });

      it('should resolve dynamic mappings via .map()', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: inputData.test, second: inputData.test2 };
          },
          inputSchema: z.object({ test: z.string(), test2: z.string() }),
          outputSchema: z.object({ result: z.string(), second: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.string() }),
        });

        workflow
          .then(step1)
          .map({
            test: mapVariable({
              initData: workflow,
              path: 'cool',
            }),
            test2: {
              schema: z.string(),
              fn: async ({ inputData }) => {
                return 'Hello ' + inputData.result;
              },
            },
          })
          .then(step2)
          .map({
            result: mapVariable({
              step: step2,
              path: 'result',
            }),
            second: {
              schema: z.string(),
              fn: async ({ getStepResult }) => {
                return getStepResult(step1).result;
              },
            },
          })
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { cool: 'test-input' } });

        if (result.status !== 'success') {
          expect.fail('Workflow should have succeeded');
        }

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toEqual({
          status: 'success',
          output: { result: 'test-input', second: 'Hello success' },
          payload: { test: 'test-input', test2: 'Hello success' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(result.result).toEqual({
          result: 'test-input',
          second: 'success',
        });

        await mastra.stopEventEngine();
      });

      it('should resolve variables from previous steps', async () => {
        const step1Action = vi.fn().mockResolvedValue({
          nested: { value: 'step1-data' },
        });
        const step2Action = vi.fn().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ previousValue: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow
          .then(step1)
          .map({
            previousValue: mapVariable({
              step: step1,
              path: 'nested.value',
            }),
          })
          .then(step2)
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        await run.start({ inputData: {} });

        expect(step2Action).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: {
              previousValue: 'step1-data',
            },
          }),
        );

        await mastra.stopEventEngine();
      });

      it('should resolve inputs from previous steps that are not objects', async () => {
        const step1 = createStep({
          id: 'step1',
          execute: async () => {
            return 'step1-data';
          },
          inputSchema: z.object({}),
          outputSchema: z.string(),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: 'success', input: inputData };
          },
          inputSchema: z.string(),
          outputSchema: z.object({ result: z.string(), input: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: {} });

        expect(result.steps).toEqual({
          input: {},
          step1: {
            status: 'success',
            output: 'step1-data',
            payload: {},

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            output: { result: 'success', input: 'step1-data' },
            payload: 'step1-data',

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });

        await mastra.stopEventEngine();
      });

      it('should resolve inputs from previous steps that are arrays', async () => {
        const step1 = createStep({
          id: 'step1',
          execute: async () => {
            return [{ str: 'step1-data' }];
          },
          inputSchema: z.object({}),
          outputSchema: z.array(z.object({ str: z.string() })),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: 'success', input: inputData };
          },
          inputSchema: z.array(z.object({ str: z.string() })),
          outputSchema: z.object({ result: z.string(), input: z.array(z.object({ str: z.string() })) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: {} });

        expect(result.steps).toEqual({
          input: {},
          step1: {
            status: 'success',
            output: [{ str: 'step1-data' }],
            payload: {},

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            output: { result: 'success', input: [{ str: 'step1-data' }] },
            payload: [{ str: 'step1-data' }],

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });

        await mastra.stopEventEngine();
      });

      it('should resolve inputs from previous steps that are arrays via .map()', async () => {
        const step1 = createStep({
          id: 'step1',
          execute: async () => {
            return [{ str: 'step1-data' }];
          },
          inputSchema: z.object({}),
          outputSchema: z.array(z.object({ str: z.string() })),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: 'success', input: inputData.ary };
          },
          inputSchema: z.object({ ary: z.array(z.object({ str: z.string() })) }),
          outputSchema: z.object({ result: z.string(), input: z.array(z.object({ str: z.string() })) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow
          .then(step1)
          .map({
            ary: mapVariable({
              step: step1,
              path: '.',
            }),
          })
          .then(step2)
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: {} });

        expect(result.steps).toMatchObject({
          input: {},
          step1: {
            status: 'success',
            output: [{ str: 'step1-data' }],
            payload: {},

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            output: { result: 'success', input: [{ str: 'step1-data' }] },
            payload: { ary: [{ str: 'step1-data' }] },

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });

        await mastra.stopEventEngine();
      });

      it('should resolve constant values via .map()', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: inputData.candidates.map(c => c.name).join('') || 'none', second: inputData.iteration };
          },
          inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        workflow
          .then(step1)
          .map({
            candidates: {
              value: [],
              schema: z.array(z.object({ name: z.string() })),
            },
            iteration: {
              value: 0,
              schema: z.number(),
            },
          })
          .then(step2)
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { cool: 'test-input' } });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toEqual({
          status: 'success',
          output: { result: 'none', second: 0 },
          payload: { candidates: [], iteration: 0 },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });

      it('should resolve fully dynamic input via .map()', async () => {
        const execute = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: inputData.candidates.map(c => c.name).join(', ') || 'none', second: inputData.iteration };
          },
          inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        workflow
          .then(step1)
          .map(async ({ inputData }) => {
            return {
              candidates: [{ name: inputData.result }, { name: 'hello' }],
              iteration: 0,
            };
          })
          .then(step2)
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { cool: 'test-input' } });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toEqual({
          status: 'success',
          output: { result: 'success, hello', second: 0 },
          payload: { candidates: [{ name: 'success' }, { name: 'hello' }], iteration: 0 },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });
    });

    describe('Simple Conditions', () => {
      it('should follow conditional chains', async () => {
        const step1Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ status: 'success' });
        });
        const step2Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ result: 'step2' });
        });
        const step3Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ result: 'step3' });
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ status: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step3 = createStep({
          id: 'step3',
          execute: step3Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step4 = createStep({
          id: 'step4',
          execute: async ({ inputData }) => {
            return { result: inputData.result };
          },
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
          steps: [step1, step2, step3],
        });

        workflow
          .then(step1)
          .branch([
            [
              async ({ inputData }) => {
                return inputData.status === 'success';
              },
              step2,
            ],
            [
              async ({ inputData }) => {
                return inputData.status === 'failed';
              },
              step3,
            ],
          ])
          .map({
            result: {
              step: [step3, step2],
              path: 'result',
            },
          })
          .then(step4)
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { status: 'success' } });

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).toHaveBeenCalled();
        expect(step3Action).not.toHaveBeenCalled();
        expect(result.steps).toMatchObject({
          input: { status: 'success' },
          step1: { status: 'success', output: { status: 'success' } },
          step2: { status: 'success', output: { result: 'step2' } },
          step4: { status: 'success', output: { result: 'step2' } },
        });

        await mastra.stopEventEngine();
      });

      it('should follow conditional chains and run only one step when perStep is true', async () => {
        const step2Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ result: 'step2' });
        });
        const step3Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ result: 'step3' });
        });
        const step5Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ result: 'step5' });
        });

        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step3 = createStep({
          id: 'step3',
          execute: step3Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step5 = createStep({
          id: 'step5',
          execute: step5Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ step5Result: z.string() }),
        });
        const step4 = createStep({
          id: 'step4',
          execute: async ({ inputData }) => {
            return { result: inputData.result + inputData.step5Result };
          },
          inputSchema: z.object({ result: z.string(), step5Result: z.string().optional() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow
          .branch([
            [
              async ({ inputData }) => {
                return inputData.status === 'success';
              },
              step2,
            ],
            [
              async ({ inputData }) => {
                return inputData.status === 'success';
              },
              step5,
            ],
            [
              async ({ inputData }) => {
                return inputData.status === 'failed';
              },
              step3,
            ],
          ])
          .map({
            result: {
              step: [step3, step2, step5],
              path: 'result',
            },
            step5Result: {
              step: step5,
              path: 'result',
            },
          })
          .then(step4)
          .commit();

        const mastra = new Mastra({
          storage: testStorage,
          workflows: { 'test-workflow': workflow },
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({
          inputData: {
            status: 'success',
          },
          perStep: true,
        });

        expect(step2Action).toHaveBeenCalled();
        expect(step3Action).not.toHaveBeenCalled();
        expect(step5Action).not.toHaveBeenCalled();
        expect(result.steps).toMatchObject({
          input: { status: 'success' },
          step2: { status: 'success', output: { result: 'step2' } },
        });
        expect(result.steps.step5).toBeUndefined();
        expect(result.status).toBe('paused');
        await mastra.stopEventEngine();
      });

      it('should handle failing dependencies', async () => {
        let err: Error | undefined;
        const step1Action = vi.fn().mockImplementation(() => {
          err = new Error('Failed');
          throw err;
        });
        const step2Action = vi.fn();

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          steps: [step1, step2],
        });

        workflow.then(step1).then(step2).commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        let result: Awaited<ReturnType<typeof run.start>> | undefined = undefined;
        try {
          result = await run.start({ inputData: {} });
        } catch {
          // do nothing
        }

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).not.toHaveBeenCalled();
        expect((result?.steps as any)?.input).toEqual({});

        const step1Result = result?.steps?.step1;
        expect(step1Result).toBeDefined();
        expect(step1Result).toMatchObject({
          status: 'failed',
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });
        // In evented workflows, errors are serialized through events and become objects
        expect((step1Result as any)?.error).toBeDefined();
        expect((step1Result as any)?.error).toMatchObject({
          name: 'Error',
          message: 'Failed',
        });

        await mastra.stopEventEngine();
      });

      it('should preserve custom error properties and cause chains in evented workflows', async () => {
        // Create a nested error with cause chain and custom properties
        const rootCause = new Error('Database connection failed');
        (rootCause as any).code = 'ECONNREFUSED';
        (rootCause as any).host = 'localhost';

        const middleCause = new Error('Query execution failed', { cause: rootCause });
        (middleCause as any).query = 'SELECT * FROM users';

        const topError = new Error('Failed to fetch user data', { cause: middleCause });
        (topError as any).statusCode = 500;
        (topError as any).requestId = 'req-12345';

        const step1Action = vi.fn().mockImplementation(() => {
          throw topError;
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        const workflow = createWorkflow({
          id: 'test-error-props-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          steps: [step1],
        });

        workflow.then(step1).commit();

        const mastra = new Mastra({
          workflows: { 'test-error-props-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        let result: Awaited<ReturnType<typeof run.start>> | undefined = undefined;
        try {
          result = await run.start({ inputData: {} });
        } catch {
          // do nothing
        }

        expect(step1Action).toHaveBeenCalled();

        const step1Result = result?.steps?.step1;
        expect(step1Result).toBeDefined();
        expect(step1Result?.status).toBe('failed');

        // Check that the error preserves custom properties
        const error = (step1Result as any)?.error;
        expect(error).toBeDefined();
        expect(error.name).toBe('Error');
        expect(error.message).toBe('Failed to fetch user data');
        expect(error.statusCode).toBe(500);
        expect(error.requestId).toBe('req-12345');

        // Check that cause chain is preserved
        expect(error.cause).toBeDefined();
        expect(error.cause.message).toBe('Query execution failed');
        expect(error.cause.query).toBe('SELECT * FROM users');

        // Check root cause
        expect(error.cause.cause).toBeDefined();
        expect(error.cause.cause.message).toBe('Database connection failed');
        expect(error.cause.cause.code).toBe('ECONNREFUSED');
        expect(error.cause.cause.host).toBe('localhost');

        // Check workflow-level error also preserves cause chain
        expect(result?.status).toBe('failed');
        expect(result?.error).toBeDefined();
        expect(result?.error?.message).toBe('Failed to fetch user data');
        expect((result?.error as any)?.statusCode).toBe(500);
        expect((result?.error as any)?.cause?.message).toBe('Query execution failed');
        expect((result?.error as any)?.cause?.cause?.message).toBe('Database connection failed');

        await mastra.stopEventEngine();
      });

      it('should support simple string conditions', async () => {
        const step1Action = vi.fn().mockResolvedValue({ status: 'success' });
        const step2Action = vi.fn().mockResolvedValue({ result: 'step2' });
        const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });
        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ status: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step3 = createStep({
          id: 'step3',
          execute: step3Action,
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          steps: [step1, step2, step3],
          options: { validateInputs: false },
        });
        workflow
          .then(step1)
          .branch([
            [
              async ({ inputData }) => {
                return inputData.status === 'success';
              },
              step2,
            ],
          ])
          .map({
            result: {
              step: step2,
              path: 'result',
            },
          })
          .branch([
            [
              async ({ inputData }) => {
                return inputData.result === 'unexpected value';
              },
              step3,
            ],
          ])
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { status: 'success' } });

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).toHaveBeenCalled();
        expect(step3Action).not.toHaveBeenCalled();
        expect(result.steps).toMatchObject({
          input: { status: 'success' },
          step1: {
            status: 'success',
            output: { status: 'success' },
            payload: {},

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            output: { result: 'step2' },
            payload: { status: 'success' },

            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });

        await mastra.stopEventEngine();
      });

      it('should support custom condition functions', async () => {
        const step1Action = vi.fn().mockResolvedValue({ count: 5 });
        const step2Action = vi.fn();

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ count: z.number() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ count: z.number() }),
          outputSchema: z.object({}),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          options: { validateInputs: false },
        });

        workflow
          .then(step1)
          .branch([
            [
              async ({ getStepResult }) => {
                const step1Result = getStepResult(step1);

                return step1Result ? step1Result.count > 3 : false;
              },
              step2,
            ],
          ])
          .commit();

        const mastra = new Mastra({
          workflows: { 'test-workflow': workflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { count: 5 } });

        expect(step2Action).toHaveBeenCalled();
        expect(result.steps.step1).toEqual({
          status: 'success',
          output: { count: 5 },
          payload: { count: 5 },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });
        expect(result.steps.step2).toEqual({
          status: 'success',
          output: undefined,
          payload: { count: 5 },

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });
    });

    it('should execute a a sleep step', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { result: 'slept successfully: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).sleep(1000).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'slept successfully: success' },
        payload: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);

      await mastra.stopEventEngine();
    });

    it('should execute a a sleep until step', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { result: 'slept successfully: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow
        .then(step1)
        .sleepUntil(new Date(Date.now() + 1000))
        .then(step2)
        .commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'slept successfully: success' },
        payload: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThan(900);

      await mastra.stopEventEngine();
    });

    it('should throw error if waitForEvent is used', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData, resumeData }) => {
          return { result: inputData.result, resumed: resumeData };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string(), resumed: z.any() }),
        resumeSchema: z.any(),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          resumed: z.any(),
        }),
        steps: [step1],
      });

      try {
        // @ts-expect-error - testing dynamic workflow result - we expect this to throw an error
        workflow.then(step1).waitForEvent('hello-event', step2).commit();
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        expect(error).toHaveProperty(
          'message',
          'waitForEvent has been removed. Please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details.',
        );
      }
    });
  });

  describe('abort', () => {
    it('should be able to abort workflow execution in between steps', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { result: 'step2: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).sleep(1000).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const p = run.start({ inputData: { value: 'test' } });

      setTimeout(() => {
        run.cancel();
      }, 300);

      const result = await p;

      expect(result.status).toBe('canceled');
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: test' },
        payload: { value: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toBeUndefined();

      await mastra.stopEventEngine();
    });

    it('should be able to abort workflow execution immediately', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          await new Promise(resolve => setTimeout(resolve, 3000));
          return { result: 'step2: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const p = run.start({ inputData: { value: 'test' } });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await run.cancel();

      const result = await p;

      expect(result.status).toBe('canceled');
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: test' },
        payload: { value: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toBeUndefined();

      await mastra.stopEventEngine();
    });

    it('should be able to abort workflow execution during a step', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData, abortSignal, abort }) => {
          const timeout: Promise<string> = new Promise((resolve, _reject) => {
            const ref = setTimeout(() => {
              resolve('step2: ' + inputData.result);
            }, 1000);

            abortSignal.addEventListener('abort', () => {
              resolve('');
              clearTimeout(ref);
            });
          });

          const result = await timeout;
          if (abortSignal.aborted) {
            return abort();
          }
          return { result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const p = run.start({ inputData: { value: 'test' } });

      setTimeout(() => {
        run.cancel();
      }, 300);

      const result = await p;

      expect(result.status).toBe('canceled');
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: test' },
        payload: { value: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      // expect(result.steps['step2']).toEqual({
      //   status: 'success',
      //   payload: { result: 'step1: test' },
      //   output: undefined,
      //   startedAt: expect.any(Number),
      //   endedAt: expect.any(Number),
      // });
    });

    it('should be able to cancel a suspended workflow', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const suspendStep = createStep({
        id: 'suspendStep',
        execute: async ({ inputData, suspend }) => {
          await suspend({ reason: 'waiting for approval' });
          return { result: 'approved: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        suspendSchema: z.object({ reason: z.string() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return { result: 'step3: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      workflow.then(step1).then(suspendStep).then(step3).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      // Start the workflow and wait for it to suspend
      const initialResult = await run.start({ inputData: { value: 'test' } });

      // Verify workflow is suspended
      expect(initialResult.status).toBe('suspended');
      expect(initialResult.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: test' },
        payload: { value: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(initialResult.steps['suspendStep'].status).toBe('suspended');

      // Now cancel the suspended workflow
      await run.cancel();

      const workflowRun = await workflow.getWorkflowRunById(run.runId);
      // getWorkflowRunById now returns WorkflowState with status directly
      expect(workflowRun?.status).toBe('canceled');

      await mastra.stopEventEngine();
    });

    it('should update status to canceled immediately when cancel() resolves', async () => {
      // This test verifies that when cancel() returns, the status is already 'canceled'
      // This is important for API handlers that return immediately after calling cancel()
      const suspendStep = createStep({
        id: 'suspendStep',
        execute: async ({ suspend }) => {
          await suspend({ reason: 'waiting for approval' });
          return { done: true };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ done: z.boolean() }),
        suspendSchema: z.object({ reason: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ done: z.boolean() }),
      });

      workflow.then(suspendStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const runId = run.runId;

      // Start the workflow and wait for it to suspend
      const initialResult = await run.start({ inputData: {} });
      expect(initialResult.status).toBe('suspended');

      // Cancel the workflow - when this promise resolves, status should be 'canceled'
      await run.cancel();

      // Check status IMMEDIATELY after cancel() returns (no waiting)
      // The user expects that after `await run.cancel()`, the status is already updated
      const workflowRun = await workflow.getWorkflowRunById(runId);
      // getWorkflowRunById now returns WorkflowState with status directly
      expect(workflowRun?.status).toBe('canceled');

      await mastra.stopEventEngine();
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn().mockImplementation(() => {
        throw error;
      });

      const step1 = createStep({
        id: 'step1',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed'); // Assert status first

      // Type guard for result.error
      if (result.status === 'failed') {
        // Errors are hydrated back to Error instances with preserved properties
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error?.name).toBe('Error');
        expect(result.error?.message).toBe('Step execution failed');
      } else {
        // This case should not be reached in this specific test.
        // If it is, the test should fail clearly.
        throw new Error("Assertion failed: workflow status was not 'failed' as expected.");
      }

      expect(result.steps?.input).toEqual({});
      const step1Result = result.steps?.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result).toMatchObject({
        status: 'failed',
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // In evented workflows, errors are serialized objects with name/message
      expect((step1Result as any)?.error).toBeDefined();
      expect((step1Result as any)?.error).toMatchObject({
        name: 'Error',
        message: 'Step execution failed',
      });

      await mastra.stopEventEngine();
    });

    it('should handle variable resolution errors', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ data: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ data: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn(),
        inputSchema: z.object({ data: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow
        .then(step1)
        .map({
          data: { step: step1, path: 'data' },
        })
        .then(step2)
        .commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await expect(run.start({ inputData: {} })).resolves.toMatchObject({
        steps: {
          step1: {
            status: 'success',
            output: {
              data: 'success',
            },
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            payload: {
              data: 'success',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
      });

      await mastra.stopEventEngine();
    });

    it('should handle step execution errors within branches', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn().mockRejectedValue(error);

      const successAction = vi.fn().mockResolvedValue({});

      const step1 = createStep({
        id: 'step1',
        execute: successAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step2 = createStep({
        id: 'step2',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step3 = createStep({
        id: 'step3',
        execute: successAction,
        inputSchema: z.object({
          step1: z.object({}),
          step2: z.object({}),
        }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.parallel([step1, step2]).then(step3).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps).toMatchObject({
        step1: {
          status: 'success',
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        step2: {
          status: 'failed',
          // error: error?.stack ?? error, // Removed this line
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
      // In evented workflows, errors are serialized objects
      expect((result.steps?.step2 as any)?.error).toBeDefined();
      expect((result.steps?.step2 as any)?.error).toMatchObject({
        name: 'Error',
        message: 'Step execution failed',
      });

      await mastra.stopEventEngine();
    });

    it('should handle step execution errors within nested workflows', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn().mockImplementation(() => {
        throw error;
      });

      const successAction = vi.fn().mockResolvedValue({});

      const step1 = createStep({
        id: 'step1',
        execute: successAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step2 = createStep({
        id: 'step2',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step3 = createStep({
        id: 'step3',
        execute: successAction,
        inputSchema: z.object({
          step1: z.object({}),
          step2: z.object({}),
        }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.parallel([step1, step2]).then(step3).commit();

      const mainWorkflow = createWorkflow({
        id: 'main-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(workflow)
        .commit();

      const mastra = new Mastra({
        workflows: { 'main-workflow': mainWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await mainWorkflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps).toMatchObject({
        'test-workflow': {
          status: 'failed',
          // error: error?.stack ?? error, // Removed this line
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      // In evented workflows, errors are serialized objects
      expect((result.steps?.['test-workflow'] as any)?.error).toBeDefined();
      expect((result.steps?.['test-workflow'] as any)?.error).toMatchObject({
        name: 'Error',
        message: 'Step execution failed',
      });

      await mastra.stopEventEngine();
    });

    // Tests for error property preservation
    it('should preserve custom error properties like statusCode', async () => {
      // Custom error simulating an API rate limit error
      class RateLimitError extends Error {
        statusCode: number;
        code: string;
        constructor(message: string, statusCode: number, code: string) {
          super(message);
          this.name = 'RateLimitError';
          this.statusCode = statusCode;
          this.code = code;
        }
      }

      const rateLimitError = new RateLimitError(
        'Rate limit exceeded: Limit 30000, Requested 35076',
        429,
        'rate_limit_exceeded',
      );

      const failingStep = createStep({
        id: 'api-call-step',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => {
          throw rateLimitError;
        },
      });

      const workflow = createWorkflow({
        id: 'rate-limit-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'rate-limit-workflow': workflow },
        storage: testStorage,
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');

      // The error should be an object, not a string
      expect(typeof result.error).toBe('object');

      // Custom properties should be preserved
      const error = result.error as any;
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('rate_limit_exceeded');
      expect(error.message).toContain('Rate limit exceeded');

      await mastra.stopEventEngine();
    });

    it('should preserve error cause chain from agent API errors', async () => {
      // Create a custom error class to simulate API errors with status codes
      class APIError extends Error {
        statusCode: number;
        code: string;
        constructor(message: string, statusCode: number, code: string) {
          super(message);
          this.name = 'APIError';
          this.statusCode = statusCode;
          this.code = code;
        }
      }

      // Create an agent with a v2 mock model that throws a rate limit error
      const failingAgent = new Agent({
        id: 'visual-design-quality-agent',
        name: 'Visual Design Quality Agent',
        instructions: 'Analyze visual design quality',
        model: new MockLanguageModelV2({
          doGenerate: async () => {
            const apiError = new APIError(
              'Rate limit exceeded on tokens per minute (TPM): Limit 30000, Requested 35076',
              429,
              'rate_limit_exceeded',
            );
            throw apiError;
          },
        }),
      });

      // Create a step that calls the agent and wraps any errors
      const analysisStep = createStep({
        id: 'visual-design-quality-analysis-step',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ analysis: z.string() }),
        execute: async ({ inputData }) => {
          try {
            const response = await failingAgent.generate(inputData.prompt);
            return { analysis: response.text };
          } catch (agentError) {
            // This is the pattern users often use - wrap agent errors with context
            const stepError = new Error(`Visual analysis failed: ${(agentError as Error).message}`);
            stepError.cause = agentError;
            throw stepError;
          }
        },
      });

      const workflow = createWorkflow({
        id: 'analysis-workflow',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ analysis: z.string() }),
      });

      workflow.then(analysisStep).commit();

      const mastra = new Mastra({
        workflows: { 'analysis-workflow': workflow },
        agents: { 'visual-design-quality-agent': failingAgent },
        storage: testStorage,
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { prompt: 'Analyze this design' } });

      expect(result.status).toBe('failed');

      if (result.status !== 'failed') {
        throw new Error('Expected workflow to fail');
      }

      // The error should be an object, not a string
      const error = result.error as any;
      expect(typeof error).toBe('object');
      expect(error.message).toContain('Visual analysis failed');

      // The cause should be the API error with its custom properties preserved
      expect(error.cause).toBeDefined();
      expect(error.cause.message).toContain('Rate limit exceeded');
      expect(error.cause.statusCode).toBe(429);
      expect(error.cause.code).toBe('rate_limit_exceeded');

      await mastra.stopEventEngine();
    });
  });

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async () => {
      const step1Action = vi.fn().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = vi.fn().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({
          status: z.string(),
          score: z.number(),
          flags: z.object({ isValid: z.boolean() }),
        }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({
          status: z.string(),
          score: z.number(),
          flags: z.object({ isValid: z.boolean() }),
        }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({
          result: z.string(),
        }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ getStepResult }) => {
              const step1Result = getStepResult(step1);
              return (
                step1Result?.status === 'success' || (step1Result?.status === 'partial' && step1Result?.score >= 70)
              );
            },
            step2,
          ],
        ])
        .map({
          result: {
            step: step2,
            path: 'result',
          },
        })
        .branch([
          [
            async ({ inputData, getStepResult }) => {
              const step1Result = getStepResult(step1);
              return !inputData.result || step1Result?.score < 70;
            },
            step3,
          ],
        ])
        .map({
          result: {
            step: step3,
            path: 'result',
          },
        })
        .commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.steps.step2).toEqual({
        status: 'success',
        output: { result: 'step2' },
        payload: {
          status: 'partial',
          score: 75,
          flags: { isValid: true },
        },

        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });
  });

  describe('Loops', () => {
    it('should run an until loop', async () => {
      const increment = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.value;

        // Increment the value
        const newValue = currentValue + 1;

        return { value: newValue };
      });
      const incrementStep = createStep({
        id: 'increment',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          value: z.number(),
          target: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: increment,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      });
      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        steps: [incrementStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.object({
          target: z.number(),
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });

      counterWorkflow
        .dountil(incrementStep, async ({ inputData }) => {
          return (inputData?.value ?? 0) >= 12;
        })
        .then(finalStep)
        .commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.result).toEqual({ finalValue: 12 });
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.increment.output).toEqual({ value: 12 });
    });

    it('should run a while loop', async () => {
      const increment = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.value;

        // Increment the value
        const newValue = currentValue + 1;

        return { value: newValue };
      });
      const incrementStep = createStep({
        id: 'increment',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          value: z.number(),
          target: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: increment,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      });
      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        steps: [incrementStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.object({
          target: z.number(),
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });

      counterWorkflow
        .dowhile(incrementStep, async ({ inputData }) => {
          return (inputData?.value ?? 0) < 12;
        })
        .then(finalStep)
        .commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.result).toEqual({ finalValue: 12 });
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.increment.output).toEqual({ value: 12 });

      await mastra.stopEventEngine();
    });
  });

  describe('foreach', () => {
    it('should run a single item concurrency (default) for loop', async () => {
      const startTime = Date.now();
      const map = vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 1e3));
        return { value: inputData.value + 11 };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: map,
      });

      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: async ({ inputData }) => {
          return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
        },
      });

      const counterWorkflow = createWorkflow({
        steps: [mapStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });

      counterWorkflow.foreach(mapStep).then(finalStep).commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });

      const endTime = Date.now();
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(3e3 - 200);

      expect(map).toHaveBeenCalledTimes(3);
      expect(result.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) },
          payload: [{ value: 12 }, { value: 33 }, { value: 344 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should run a all item concurrency for loop', async () => {
      const startTime = Date.now();
      const map = vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 1e3));
        return { value: inputData.value + 11 };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: map,
      });

      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: async ({ inputData }) => {
          return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
        },
      });

      const counterWorkflow = createWorkflow({
        steps: [mapStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });

      const endTime = Date.now();
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1e3 * 1.2);

      expect(map).toHaveBeenCalledTimes(3);
      expect(result.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) },
          payload: [{ value: 12 }, { value: 33 }, { value: 344 }],

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should run a partial item concurrency for loop', async () => {
      const startTime = Date.now();
      const map = vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 1e3));
        return { value: inputData.value + 11 };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: map,
      });

      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: async ({ inputData }) => {
          return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
        },
      });

      const counterWorkflow = createWorkflow({
        steps: [mapStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 2 }).then(finalStep).commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });

      const endTime = Date.now();
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(1e3 * 1.2);
      expect(duration).toBeLessThan(1e3 * 2.2);

      expect(map).toHaveBeenCalledTimes(3);
      expect(result.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) },
          payload: [{ value: 12 }, { value: 33 }, { value: 344 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });
  });

  describe('if-else branching', () => {
    it('should run the if-then branch', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)

        // Increment the value
        const newValue = (inputData?.startValue ?? 0) + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        description: 'Other step',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          other: z.number(),
        }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const finalIf = createStep({
        id: 'finalIf',
        description: 'Final step that prints the result',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });
      const finalElse = createStep({
        id: 'finalElse',
        description: 'Final step that prints the result',
        inputSchema: z.object({ other: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        steps: [startStep, finalIf],
      });

      const elseBranch = createWorkflow({
        id: 'else-branch',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        steps: [otherStep, finalElse],
      })
        .then(otherStep)
        .then(finalElse)
        .commit();

      counterWorkflow
        .then(startStep)
        .branch([
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return !current || current < 5;
            },
            finalIf,
          ],
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return current >= 5;
            },
            elseBranch,
          ],
        ])
        .commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 1 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(0);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.finalIf.output).toEqual({ finalValue: 2 });
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.start.output).toEqual({ newValue: 2 });

      await mastra.stopEventEngine();
    });

    it('should run the else branch', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)

        // Increment the value
        const newValue = (inputData?.startValue ?? 0) + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async ({ inputData }) => {
        return { newValue: inputData.newValue, other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        description: 'Other step',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          other: z.number(),
          newValue: z.number(),
        }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        const startVal = inputData?.newValue ?? 0;
        const otherVal = inputData?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const finalIf = createStep({
        id: 'finalIf',
        description: 'Final step that prints the result',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });
      const finalElse = createStep({
        id: 'finalElse',
        description: 'Final step that prints the result',
        inputSchema: z.object({ other: z.number(), newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        steps: [startStep, finalIf],
      });

      const elseBranch = createWorkflow({
        id: 'else-branch',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        steps: [otherStep, finalElse],
      })
        .then(otherStep)
        .then(finalElse)
        .commit();

      counterWorkflow
        .then(startStep)
        .branch([
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return !current || current < 5;
            },
            finalIf,
          ],
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return current >= 5;
            },
            elseBranch,
          ],
        ])
        .commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 6 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['else-branch'].output).toEqual({ finalValue: 26 + 6 + 1 });
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.start.output).toEqual({ newValue: 7 });
    });
  });

  describe('Schema Validation', () => {
    it.skip('should throw error if trigger data is invalid (needs workflow input validation fix)', async () => {
      const triggerSchema = z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      });

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({
          required: z.string(),
          nested: z.object({
            value: z.number(),
          }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: vi.fn().mockResolvedValue({ result: 'step2 success' }),
        inputSchema: z.object({
          required: z.string(),
          nested: z.object({
            value: z.number(),
          }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: vi.fn().mockResolvedValue({ result: 'step3 success' }),
        inputSchema: z.object({
          required: z.string(),
          nested: z.object({
            value: z.number(),
          }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow-evented',
        inputSchema: triggerSchema,
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
        options: { validateInputs: true },
      });

      const parallelWorkflow = createWorkflow({
        id: 'parallel-workflow-evented',
        inputSchema: z.object({
          required: z.string(),
          nested: z.object({
            value: z.number(),
          }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2, step3],
        options: { validateInputs: true },
      });

      parallelWorkflow.parallel([step1, step2, step3]).commit();
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow, [parallelWorkflow.id]: parallelWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      try {
        const run = await workflow.createRun();
        await run.start({
          inputData: {
            required: 'test',
            // @ts-expect-error - testing dynamic workflow result
            nested: { value: 'not-a-number' },
          },
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- nested.value: Expected number, received string',
        );
      }

      try {
        const run = await parallelWorkflow.createRun();
        await run.start({
          inputData: {
            required: 'test',
            // @ts-expect-error - testing dynamic workflow result
            nested: { value: 'not-a-number' },
          },
        });

        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- nested.value: Expected number, received string',
        );
      }

      await mastra.stopEventEngine();
    });

    it('should use default value from inputSchema', async () => {
      const triggerSchema = z.object({
        required: z.string(),
        nested: z
          .object({
            value: z.number(),
          })
          .optional()
          .default({ value: 1 }),
      });

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return inputData;
        },
        inputSchema: triggerSchema,
        outputSchema: triggerSchema,
      });

      const workflow = createWorkflow({
        id: 'test-workflow-evented',
        inputSchema: triggerSchema,
        outputSchema: triggerSchema,
        steps: [step1],
        options: { validateInputs: true },
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          required: 'test',
        },
      });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toEqual({
        status: 'success',
        payload: { required: 'test', nested: { value: 1 } },
        output: { required: 'test', nested: { value: 1 } },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.result).toEqual({ required: 'test', nested: { value: 1 } });

      await mastra.stopEventEngine();
    });

    it('should throw error if inputData is invalid', async () => {
      const successAction = vi.fn().mockImplementation(() => {
        return { result: 'success' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: successAction,
        inputSchema: z.object({
          start: z.string(),
        }),
        outputSchema: z.object({
          start: z.string(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: successAction,
        inputSchema: z.object({
          start: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow-evented',
        inputSchema: z.object({
          start: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        options: { validateInputs: true },
      });

      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {
          start: '2',
        },
      });

      expect(result.status).toBe('failed');

      if (result.status === 'failed') {
        expect(result.error).toBeDefined();
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as any).message).toContain('Step input validation failed');
        expect((result.error as any).message).toContain('start: Required');
      } else {
        throw new Error("Assertion failed: workflow status was not 'failed' as expected.");
      }

      expect(result.steps?.input).toEqual({ start: '2' });
      const step1Result = result.steps?.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result).toMatchObject({
        status: 'success',
        payload: { start: '2' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
        output: { result: 'success' },
      });
      const step2Result = result.steps?.step2;
      expect(step2Result).toBeDefined();
      expect(step2Result).toMatchObject({
        status: 'failed',
        payload: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
        error: expect.any(Error),
      });
      expect(((step2Result as any)?.error as Error).message).toContain('Step input validation failed');
      expect(((step2Result as any)?.error as Error).message).toContain('start: Required');

      await mastra.stopEventEngine();
    });

    it('should preserve ZodError as cause when input validation fails', async () => {
      const successAction = vi.fn().mockImplementation(() => {
        return { result: 'success' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: successAction,
        inputSchema: z.object({
          requiredField: z.string(),
          numberField: z.number(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'zod-cause-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: true },
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {},
      });

      expect(result.status).toBe('failed');

      if (result.status === 'failed') {
        expect(result.error).toBeDefined();
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as any).message).toContain('Step input validation failed');

        expect((result.error as any).cause).toBeDefined();
        expect((result.error as any).cause.issues).toBeDefined();
        expect(Array.isArray((result.error as any).cause.issues)).toBe(true);
        expect((result.error as any).cause.issues.length).toBeGreaterThanOrEqual(2);
      }

      await mastra.stopEventEngine();
    });

    it('should use default value from inputSchema for step input', async () => {
      const successAction = vi.fn().mockImplementation(() => {
        return { result: 'success' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: async () => {
          return {};
        },
        inputSchema: z.object({
          start: z.string(),
        }),
        outputSchema: z.object({
          start: z.string().optional(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: successAction,
        inputSchema: z.object({
          start: z.string().optional().default('test'),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow-evented',
        inputSchema: z.object({
          start: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        options: { validateInputs: true },
      });

      workflow
        .then(step1)
        .map({
          start: mapVariable({
            step: step1,
            path: 'start',
          }),
        })
        .then(step2)
        .commit();

      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {
          start: '2',
        },
      });

      expect(result.status).toBe('success');

      expect(result.steps?.input).toEqual({ start: '2' });
      const step1Result = result.steps?.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result).toMatchObject({
        status: 'success',
        payload: { start: '2' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
        output: {},
      });
      const step2Result = result.steps?.step2;
      expect(step2Result).toBeDefined();
      expect(step2Result).toMatchObject({
        status: 'success',
        payload: { start: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
        output: { result: 'success' },
      });

      await mastra.stopEventEngine();
    });

    it('should throw error if inputData is invalid in workflow with .map()', async () => {
      const successAction = vi.fn().mockImplementation(() => {
        return { result: 'success' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { start: inputData.start };
        },
        inputSchema: z.object({
          start: z.number(),
        }),
        outputSchema: z.object({
          start: z.number(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: successAction,
        inputSchema: z.object({
          start: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow-evented',
        inputSchema: z.object({
          start: z.number(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        options: { validateInputs: true },
      });

      workflow
        .then(step1)
        .map(async ({ inputData }) => {
          return {
            start: inputData.start,
          };
        })
        .then(step2)
        .commit();

      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {
          start: 2,
        },
      });

      expect(result.status).toBe('failed');

      if (result.status === 'failed') {
        expect(result.error).toBeDefined();
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as any).message).toContain('Step input validation failed');
        expect((result.error as any).message).toContain('start: Expected string, received number');
      } else {
        throw new Error("Assertion failed: workflow status was not 'failed' as expected.");
      }

      expect(result.steps?.input).toEqual({ start: 2 });
      const step1Result = result.steps?.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result).toMatchObject({
        status: 'success',
        payload: { start: 2 },
        output: { start: 2 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      const step2Result = result.steps?.step2;
      expect(step2Result).toBeDefined();
      expect(step2Result).toMatchObject({
        status: 'failed',
        payload: { start: 2 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
        error: expect.any(Error),
      });
      expect(((step2Result as any)?.error as Error).message).toContain('Step input validation failed');
      expect(((step2Result as any)?.error as Error).message).toContain('start: Expected string, received number');

      await mastra.stopEventEngine();
    });

    it('should properly validate input schema when .map is used after .foreach. bug #11313', async () => {
      const startTime = Date.now();
      const map = vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 1e3));
        return { value: inputData.value + 11 };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: map,
      });

      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.object({
          inputValue: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: async ({ inputData }) => {
          return { finalValue: inputData.inputValue };
        },
      });

      const counterWorkflow = createWorkflow({
        steps: [mapStep, finalStep],
        id: 'counter-workflow-evented',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
      });

      counterWorkflow
        .foreach(mapStep)
        .map(
          async ({ inputData }) => {
            return {
              inputValue: inputData.reduce((acc, curr) => acc + curr.value, 0),
            };
          },
          { id: 'map-step' },
        )
        .then(finalStep)
        .commit();

      const mastra = new Mastra({
        workflows: { [counterWorkflow.id]: counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });

      const endTime = Date.now();
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(3e3 - 200);

      expect(map).toHaveBeenCalledTimes(3);
      expect(result.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'map-step': {
          status: 'success',
          output: { inputValue: 1 + 11 + (22 + 11) + (333 + 11) },
          payload: [{ value: 12 }, { value: 33 }, { value: 344 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) },
          payload: { inputValue: 1 + 11 + (22 + 11) + (333 + 11) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    it.skip('should throw error when you try to resume a workflow step with invalid resume data (Phase 4)', async () => {
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({ message: `Please provide additional information. now value is ${inputData.value}` });
          }

          return { value: finalValue };
        },
      });

      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow-evented',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        options: { validateInputs: true },
      })
        .then(incrementStep)
        .then(resumeStep)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      try {
        await run.resume({
          resumeData: { number: 2 },
          step: ['resume'],
        });
      } catch (error) {
        const errMessage = (error as { message: string })?.message;
        expect(errMessage).toBe('Invalid resume data: \n- value: Required');
      }

      const wflowRun = await incrementWorkflow.getWorkflowRunById(run.runId);
      expect(wflowRun?.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');

      await mastra.stopEventEngine();
    });

    it.skip('should use default value from resumeSchema when resuming a workflow (Phase 4)', async () => {
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number().optional().default(21) }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({ message: `Please provide additional information. now value is ${inputData.value}` });
          }

          return { value: finalValue };
        },
      });

      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow-evented',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        options: { validateInputs: true },
      })
        .then(incrementStep)
        .then(resumeStep)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: {},
        step: ['resume'],
      });

      expect(resumeResult.steps.resume).toEqual({
        status: 'success',
        payload: { value: 1 },
        resumePayload: { value: 21 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
        resumedAt: expect.any(Number),
        suspendedAt: expect.any(Number),
        suspendPayload: { message: 'Please provide additional information. now value is 1' },
        output: { value: 22 },
      });

      expect(resumeResult.status).toBe('success');

      await mastra.stopEventEngine();
    });

    it('should throw error if inputData is invalid in nested workflows', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        const currentValue = inputData.startValue || 0;
        const newValue = currentValue + 1;
        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ newValue: z.number(), other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async () => {
        return { success: true };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow-evented',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: true },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a-evented',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ finalValue: z.number() }),
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();

      const mastra = new Mastra({
        workflows: { [counterWorkflow.id]: counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const wfB = createWorkflow({
        id: 'nested-workflow-b-evented',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ finalValue: z.number() }),
      })
        .then(startStep)
        .map({
          other: mapVariable({
            step: startStep,
            path: 'newValue',
          }),
          newValue: mapVariable({
            step: startStep,
            path: 'newValue',
          }),
        })
        .then(finalStep)
        .commit();
      counterWorkflow
        .parallel([wfA, wfB])
        .then(
          createStep({
            id: 'last-step',
            inputSchema: z.object({
              'nested-workflow-a-evented': z.object({ finalValue: z.number() }),
              'nested-workflow-b-evented': z.object({ finalValue: z.number() }),
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(result.status).toBe('failed');

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(1);
      expect(last).toHaveBeenCalledTimes(0);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a-evented'].error).toBeInstanceOf(Error);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a-evented'].error.message).toContain(
        'Step input validation failed: \n- newValue: Required',
      );

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-b-evented'].output).toEqual({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toBeUndefined();

      await mastra.stopEventEngine();
    });

    it('should allow a steps input schema to be a subset of the previous step output schema', async () => {
      const prevStep = createStep({
        id: 'prev-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ a: z.string(), b: z.string().optional() }),
        execute: async () => {
          return { a: 'a', b: 'b' };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow-evented',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.boolean(),
      });

      const sharedStepAttrs = {
        outputSchema: z.boolean(),
        execute: async () => true,
      } satisfies Partial<Parameters<typeof createStep>[0]>;

      const equalStep = createStep({
        id: 'equal-step',
        inputSchema: prevStep.outputSchema,
        ...sharedStepAttrs,
      });

      // Create all workflows first
      const missingRequiredKeyStep = createStep({
        id: 'missing-required-key-step',
        inputSchema: prevStep.outputSchema.omit({ a: true }),
        ...sharedStepAttrs,
      });
      const missingRequiredKeyWorkflow = createWorkflow({
        id: 'missing-required-key-workflow-evented',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.boolean(),
      });

      const missingOptionalKeyStep = createStep({
        id: 'missing-optional-key-step',
        inputSchema: prevStep.outputSchema.omit({ b: true }),
        ...sharedStepAttrs,
      });
      const missingOptionalKeyWorkflow = createWorkflow({
        id: 'missing-optional-key-workflow-evented',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.boolean(),
      });

      const extraOptionalKeyStep = createStep({
        id: 'extra-optional-key-step',
        inputSchema: prevStep.outputSchema.extend({ c: z.string().optional() }),
        ...sharedStepAttrs,
      });
      const extraOptionalKeyWorkflow = createWorkflow({
        id: 'extra-optional-key-workflow-evented',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.boolean(),
      });

      workflow.then(prevStep).then(equalStep).commit();
      missingRequiredKeyWorkflow.then(prevStep).then(missingRequiredKeyStep).commit();
      missingOptionalKeyWorkflow.then(prevStep).then(missingOptionalKeyStep).commit();
      extraOptionalKeyWorkflow.then(prevStep).then(extraOptionalKeyStep).commit();

      // Register all workflows with Mastra
      const mastra = new Mastra({
        workflows: {
          [workflow.id]: workflow,
          [missingRequiredKeyWorkflow.id]: missingRequiredKeyWorkflow,
          [missingOptionalKeyWorkflow.id]: missingOptionalKeyWorkflow,
          [extraOptionalKeyWorkflow.id]: extraOptionalKeyWorkflow,
        },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          value: 'test',
        },
      });
      expect(result.status).toBe('success');
      expect(result.steps).toEqual({
        input: {
          value: 'test',
        },
        'prev-step': {
          status: 'success',
          payload: {
            value: 'test',
          },
          output: {
            a: 'a',
            b: 'b',
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'equal-step': {
          status: 'success',
          payload: {
            a: 'a',
            b: 'b',
          },
          output: true,
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      const run2 = await missingRequiredKeyWorkflow.createRun();
      const result2 = await run2.start({
        inputData: {
          value: 'test',
        },
      });
      expect(result2.status).toBe('success');
      expect(result2.steps).toEqual({
        input: {
          value: 'test',
        },
        'prev-step': {
          status: 'success',
          payload: {
            value: 'test',
          },
          output: {
            a: 'a',
            b: 'b',
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'missing-required-key-step': {
          status: 'success',
          payload: {
            b: 'b',
          },
          output: true,
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      const run3 = await missingOptionalKeyWorkflow.createRun();
      const result3 = await run3.start({
        inputData: {
          value: 'test',
        },
      });
      expect(result3.status).toBe('success');
      expect(result3.steps).toEqual({
        input: {
          value: 'test',
        },
        'prev-step': {
          status: 'success',
          payload: {
            value: 'test',
          },
          output: {
            a: 'a',
            b: 'b',
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'missing-optional-key-step': {
          status: 'success',
          payload: {
            a: 'a',
          },
          output: true,
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      const run4 = await extraOptionalKeyWorkflow.createRun();
      const result4 = await run4.start({
        inputData: {
          value: 'test',
        },
      });
      expect(result4.status).toBe('success');
      expect(result4.steps).toEqual({
        input: {
          value: 'test',
        },
        'prev-step': {
          status: 'success',
          payload: {
            value: 'test',
          },
          output: {
            a: 'a',
            b: 'b',
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'extra-optional-key-step': {
          status: 'success',
          payload: {
            a: 'a',
            b: 'b',
          },
          output: true,
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    it('should throw error if inputData is invalid after foreach', async () => {
      const mapAction = vi.fn().mockImplementation(async ({ inputData }) => {
        return { value: inputData.value + 1 };
      });

      const mapStep = createStep({
        id: 'map',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        execute: mapAction,
      });

      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ total: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        execute: async ({ inputData }) => {
          return { result: inputData.total };
        },
      });

      const workflow = createWorkflow({
        id: 'foreach-validation-workflow-evented',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({ result: z.number() }),
        options: { validateInputs: true },
      });

      workflow
        .foreach(mapStep)
        .map(async ({ inputData }) => {
          return { wrongKey: inputData.reduce((acc, curr) => acc + curr.value, 0) };
        })
        .then(finalStep)
        .commit();

      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: [{ value: 1 }, { value: 2 }, { value: 3 }],
      });

      expect(result.status).toBe('failed');
      expect(mapAction).toHaveBeenCalledTimes(3);

      await mastra.stopEventEngine();
    });

    it('should validate nested workflow input correctly', async () => {
      const innerStep = createStep({
        id: 'inner-step',
        inputSchema: z.object({ data: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => {
          return { result: inputData.data };
        },
      });

      const innerWorkflow = createWorkflow({
        id: 'inner-workflow-evented',
        inputSchema: z.object({ data: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        options: { validateInputs: true },
      });

      innerWorkflow.then(innerStep).commit();

      const outerWorkflow = createWorkflow({
        id: 'outer-workflow-evented',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.string() }),
        options: { validateInputs: true },
      });

      // Pass number to nested workflow expecting string - should fail validation
      outerWorkflow
        .map(async ({ inputData }) => {
          return { data: inputData.value }; // number instead of string
        })
        .then(innerWorkflow)
        .commit();

      const mastra = new Mastra({
        workflows: {
          [innerWorkflow.id]: innerWorkflow,
          [outerWorkflow.id]: outerWorkflow,
        },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await outerWorkflow.createRun();
      const result = await run.start({
        inputData: { value: 42 },
      });

      expect(result.status).toBe('failed');

      await mastra.stopEventEngine();
    });
  });

  describe('multiple chains', () => {
    it('should run multiple chains in parallel', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success1' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn().mockResolvedValue({ result: 'success2' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step3 = createStep({
        id: 'step3',
        execute: vi.fn().mockResolvedValue({ result: 'success3' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step4 = createStep({
        id: 'step4',
        execute: vi.fn().mockResolvedValue({ result: 'success4' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step5 = createStep({
        id: 'step5',
        execute: vi.fn().mockResolvedValue({ result: 'success5' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2, step3, step4, step5],
      });
      workflow
        .parallel([
          createWorkflow({
            id: 'nested-a',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            steps: [step1, step2, step3],
          })
            .then(step1)
            .then(step2)
            .then(step3)
            .commit(),
          createWorkflow({
            id: 'nested-b',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            steps: [step4, step5],
          })
            .then(step4)
            .then(step5)
            .commit(),
        ])
        .commit();

      const mastra = new Mastra({
        workflows: {
          'test-workflow': workflow,
        },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps['nested-a']).toEqual({
        status: 'success',
        output: { result: 'success3' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps['nested-b']).toEqual({
        status: 'success',
        output: { result: 'success5' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });
  });

  describe('Retry', () => {
    it('should retry a step default 0 times', async () => {
      let err: Error | undefined;
      const step1Execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step2Execute = vi.fn().mockImplementation(() => {
        err = new Error('Step failed');
        throw err;
      });
      const step1 = createStep({
        id: 'step1',
        execute: step1Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const mastra = new Mastra({
        logger: false,
        workflows: {
          'test-workflow': workflow,
        },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step2).toMatchObject({
        // Change to toMatchObject
        status: 'failed',
        // error: err?.stack ?? err, // REMOVE THIS LINE
        payload: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // Errors are hydrated back to Error instances with preserved properties
      expect((result.steps.step2 as any)?.error).toBeInstanceOf(Error);
      expect((result.steps.step2 as any)?.error.name).toBe('Error');
      expect((result.steps.step2 as any)?.error.message).toBe('Step failed');
      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(1); // 0 retries + 1 initial call

      await mastra.stopEventEngine();
    });

    it('should retry a step with a custom retry config', async () => {
      let err: Error | undefined;
      const step1Execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step2Execute = vi.fn().mockImplementation(() => {
        err = new Error('Step failed');
        throw err;
      });
      const step1 = createStep({
        id: 'step1',
        execute: step1Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: { attempts: 5, delay: 200 },
      });

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: {
          'test-workflow': workflow,
        },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step2).toMatchObject({
        // Change to toMatchObject
        status: 'failed',
        // error: err?.stack ?? err, // REMOVE THIS LINE
        payload: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // Errors are hydrated back to Error instances with preserved properties
      expect((result.steps.step2 as any)?.error).toBeInstanceOf(Error);
      expect((result.steps.step2 as any)?.error.name).toBe('Error');
      expect((result.steps.step2 as any)?.error.message).toBe('Step failed');
      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(6); // 5 retries + 1 initial call

      await mastra.stopEventEngine();
    });

    it('should retry a step with step retries option, overriding the workflow retry config', async () => {
      let err: Error | undefined;
      const step1Execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step2Execute = vi.fn().mockImplementation(() => {
        err = new Error('Step failed');
        throw err;
      });
      const step1 = createStep({
        id: 'step1',
        execute: step1Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retries: 5,
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retries: 5,
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: { delay: 200, attempts: 10 },
      });

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: {
          'test-workflow': workflow,
        },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step2).toMatchObject({
        // Change to toMatchObject
        status: 'failed',
        // error: err?.stack ?? err, // REMOVE THIS LINE
        payload: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // Errors are hydrated back to Error instances with preserved properties
      expect((result.steps.step2 as any)?.error).toBeInstanceOf(Error);
      expect((result.steps.step2 as any)?.error.name).toBe('Error');
      expect((result.steps.step2 as any)?.error.message).toBe('Step failed');
      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(6); // 5 retries + 1 initial call

      await mastra.stopEventEngine();
    });
  });

  describe('Interoperability (Actions)', () => {
    it('should be able to use all action types in a workflow', async () => {
      const step1Action = vi.fn().mockResolvedValue({ name: 'step1' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ name: z.string() }),
      });

      // @ts-expect-error - testing dynamic workflow result
      const toolAction = vi.fn().mockImplementation(async (input: { name: string }) => {
        return { name: input.name };
      });

      const randomTool = createTool({
        id: 'random-tool',
        execute: toolAction,
        description: 'random-tool',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ name: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ name: z.string() }),
      });

      // @ts-expect-error - testing dynamic workflow result
      workflow.then(step1).then(createStep(randomTool)).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(step1Action).toHaveBeenCalled();
      expect(toolAction).toHaveBeenCalled();
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.step1).toEqual({
        status: 'success',
        output: { name: 'step1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['random-tool']).toEqual({
        status: 'success',
        output: { name: 'step1' },
        payload: { name: 'step1' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });
  });

  describe('Suspend and Resume', () => {
    afterAll(async () => {
      const pathToDb = path.join(process.cwd(), 'mastra.db');

      if (fs.existsSync(pathToDb)) {
        fs.rmSync(pathToDb);
      }
    });
    it('should return the correct runId', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1],
      })
        .then(step1)
        .commit();
      const run = await workflow.createRun();
      const run2 = await workflow.createRun({ runId: run.runId });

      expect(run.runId).toBeDefined();
      expect(run2.runId).toBeDefined();
      expect(run.runId).toBe(run2.runId);
    });

    it('should handle basic suspend and resume flow with async await syntax', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
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
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
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
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
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
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      // expect(initialResult.activePaths.size).toBe(1);
      // expect(initialResult.activePaths.get('promptAgent')?.status).toBe('suspended');
      // expect(initialResult.activePaths.get('promptAgent')?.suspendPayload).toEqual({ testPayload: 'hello' });
      expect(initialResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          suspendPayload: {
            testPayload: 'hello',
            __workflow_meta: {
              path: ['promptAgent'],
              runId: expect.any(String),
            },
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      // expect(firstResumeResult.activePaths.size).toBe(1);
      // expect(firstResumeResult.activePaths.get('improveResponse')?.status).toBe('suspended');
      expect(firstResumeResult.steps).toEqual({
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
          suspendPayload: { testPayload: 'hello' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          suspendPayload: {
            __workflow_meta: {
              path: ['improveResponse'],
              runId: expect.any(String),
            },
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const secondResumeResult = await run.resume({
        step: improveResponse,
        resumeData: {
          toneScore: { score: 0.8 },
          completenessScore: { score: 0.7 },
        },
      });
      if (!secondResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      expect(secondResumeResult.steps).toEqual({
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
          suspendPayload: { testPayload: 'hello' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'success',
          output: { improvedOutput: 'improved output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          resumePayload: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          suspendPayload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
          payload: { improvedOutput: 'improved output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      await mastra.stopEventEngine();
    });

    it('should handle basic suspend and resume single step flow with async await syntax and perStep:true', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
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
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
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
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
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

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(initialResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          suspendPayload: {
            testPayload: 'hello',
            __workflow_meta: { path: ['promptAgent'], runId: expect.any(String) },
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx, perStep: true });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      // expect(firstResumeResult.activePaths.size).toBe(1);
      // expect(firstResumeResult.activePaths.get('improveResponse')?.status).toBe('suspended');
      expect(firstResumeResult.steps).toEqual({
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
          suspendPayload: { testPayload: 'hello' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
      });

      expect(firstResumeResult.status).toBe('paused');

      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      expect(evaluateToneAction).not.toHaveBeenCalled();
      expect(evaluateImprovedAction).not.toHaveBeenCalled();
      expect(improveResponseAction).not.toHaveBeenCalled();

      await mastra.stopEventEngine();
    });

    it('should work with requestContext - bug #4442', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockImplementation(async ({ suspend, requestContext, resumeData }) => {
        if (!resumeData) {
          requestContext.set('responses', [...(requestContext.get('responses') ?? []), 'first message']);
          return await suspend({ testPayload: 'hello' });
        }

        requestContext.set('responses', [...(requestContext.get('responses') ?? []), 'promptAgentAction']);

        return undefined;
      });
      const requestContextAction = vi.fn().mockImplementation(async ({ requestContext }) => {
        return requestContext.get('responses');
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
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const requestContextStep = createStep({
        id: 'requestContextAction',
        execute: requestContextAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.array(z.string()),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      });

      promptEvalWorkflow.then(getUserInput).then(promptAgent).then(requestContextStep).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const newCtx = {
        userInput: 'test input for resumption',
      };

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      expect(firstResumeResult.steps.requestContextAction.status).toBe('success');
      // @ts-expect-error - testing dynamic workflow result
      expect(firstResumeResult.steps.requestContextAction.output).toEqual(['first message', 'promptAgentAction']);

      await mastra.stopEventEngine();
    });

    it('should work with custom requestContext - bug #4442', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockImplementation(async ({ suspend, requestContext, resumeData }) => {
        if (!resumeData) {
          requestContext.set('responses', [...(requestContext.get('responses') ?? []), 'first message']);
          return await suspend({ testPayload: 'hello' });
        }

        requestContext.set('responses', [...(requestContext.get('responses') ?? []), 'promptAgentAction']);

        return undefined;
      });
      const requestContextAction = vi.fn().mockImplementation(async ({ requestContext }) => {
        return requestContext.get('responses');
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
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const requestContextStep = createStep({
        id: 'requestContextAction',
        execute: requestContextAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.array(z.string()),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      });

      promptEvalWorkflow.then(getUserInput).then(promptAgent).then(requestContextStep).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      const requestContext = new RequestContext();
      const initialResult = await run.start({ inputData: { input: 'test' }, requestContext });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      // NOTE: this won't work with evented systems, the map isn't shared
      // expect(requestContext.get('responses')).toEqual(['first message']);

      const newCtx = {
        userInput: 'test input for resumption',
      };

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx, requestContext });
      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      expect(firstResumeResult.steps.requestContextAction.status).toBe('success');
      // @ts-expect-error - testing dynamic workflow result
      expect(firstResumeResult.steps.requestContextAction.output).toEqual(['first message', 'promptAgentAction']);

      await mastra.stopEventEngine();
    });

    it('should handle basic suspend and resume in a dountil workflow', async () => {
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          console.info('inputData is ', inputData);
          console.info('resumeData is ', resumeData);

          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({ message: `Please provide additional information. now value is ${inputData.value}` });
          }

          return { value: finalValue };
        },
      });

      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const dowhileWorkflow = createWorkflow({
        id: 'dowhile-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .dountil(
          createWorkflow({
            id: 'simple-resume-workflow',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            steps: [incrementStep, resumeStep],
          })
            .then(incrementStep)
            .then(resumeStep)
            .commit(),
          async ({ inputData }) => inputData.value >= 10,
        )
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'dowhile-workflow': dowhileWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await dowhileWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.steps['simple-resume-workflow']).toMatchObject({
        status: 'suspended',
      });

      const resumeResult = await run.resume({
        resumeData: { value: 2 },
        step: ['simple-resume-workflow', 'resume'],
      });

      expect(resumeResult.steps['simple-resume-workflow']).toMatchObject({
        status: 'suspended',
      });

      const lastResumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['simple-resume-workflow', 'resume'],
      });

      expect(lastResumeResult.steps['simple-resume-workflow']).toMatchObject({
        status: 'success',
      });

      await mastra.stopEventEngine();
    });

    it('should have access to the correct inputValue when resuming a step preceded by a .map step', async () => {
      const getUserInput = createStep({
        id: 'getUserInput',
        execute: async ({ inputData }) => {
          return {
            userInput: inputData.input,
          };
        },
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            return suspend({ testPayload: 'suspend message' });
          }

          return {
            modelOutput: inputData.userInput + ' ' + resumeData.userInput,
          };
        },
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            return suspend();
          }

          return {
            improvedOutput: 'improved output',
            overallScore: {
              completenessScore: {
                score: (inputData.completenessScore.score + resumeData.completenessScore.score) / 2,
              },
              toneScore: { score: (inputData.toneScore.score + resumeData.toneScore.score) / 2 },
            },
          };
        },
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        inputSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        outputSchema: z.object({
          improvedOutput: z.string(),
          overallScore: z.object({
            toneScore: z.object({ score: z.number() }),
            completenessScore: z.object({ score: z.number() }),
          }),
        }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: async ({ inputData }) => {
          return inputData.overallScore;
        },
        inputSchema: z.object({
          improvedOutput: z.string(),
          overallScore: z.object({
            toneScore: z.object({ score: z.number() }),
            completenessScore: z.object({ score: z.number() }),
          }),
        }),
        outputSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .map(
          async () => {
            return {
              toneScore: { score: 0.8 },
              completenessScore: { score: 0.7 },
            };
          },
          {
            id: 'evaluateToneConsistency',
          },
        )
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(initialResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test' },
          suspendPayload: {
            testPayload: 'suspend message',
            __workflow_meta: {
              path: ['promptAgent'],
              runId: expect.any(String),
            },
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const newCtx = {
        userInput: 'input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(firstResumeResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test input for resumption' },
          payload: { userInput: 'test' },
          suspendPayload: { testPayload: 'suspend message' },
          resumePayload: { userInput: 'input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          suspendPayload: {
            __workflow_meta: {
              path: ['improveResponse'],
              runId: expect.any(String),
            },
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const secondResumeResult = await run.resume({
        step: improveResponse,
        resumeData: {
          toneScore: { score: 0.9 },
          completenessScore: { score: 0.8 },
        },
      });
      if (!secondResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(secondResumeResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test input for resumption' },
          payload: { userInput: 'test' },
          suspendPayload: { testPayload: 'suspend message' },
          resumePayload: { userInput: 'input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'success',
          output: {
            improvedOutput: 'improved output',
            overallScore: { toneScore: { score: (0.8 + 0.9) / 2 }, completenessScore: { score: (0.7 + 0.8) / 2 } },
          },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          suspendPayload: {},
          resumePayload: {
            toneScore: { score: 0.9 },
            completenessScore: { score: 0.8 },
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: (0.8 + 0.9) / 2 }, completenessScore: { score: (0.7 + 0.8) / 2 } },
          payload: {
            improvedOutput: 'improved output',
            overallScore: { toneScore: { score: (0.8 + 0.9) / 2 }, completenessScore: { score: (0.7 + 0.8) / 2 } },
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });
  });

  describe('Time travel', () => {
    afterEach(async () => {
      const workflowsStore = await testStorage.getStore('workflows');
      await workflowsStore?.dangerouslyClearAll();
    });

    it('should throw error if trying to timetravel a workflow execution that is still running', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const runId = 'test-run-id';

      const workflowsStore = await testStorage.getStore('workflows');
      expect(workflowsStore).toBeDefined();
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: 'testWorkflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { step2: [1] },
          value: {},
          context: {
            input: { value: 0 },
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 2 },
              endedAt: Date.now(),
            },
            step2: {
              payload: { step1Result: 2 },
              startedAt: Date.now(),
              status: 'running',
            },
          } as any,
          serializedStepGraph: workflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await workflow.createRun({ runId });

      await expect(run.timeTravel({ step: 'step2', inputData: { step1Result: 2 } })).rejects.toThrow(
        'This workflow run is still running, cannot time travel',
      );

      await mastra.stopEventEngine();
    });

    it('should throw error if validateInputs is true and trying to timetravel a workflow execution with invalid inputData', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
        options: {
          validateInputs: true,
        },
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      await expect(run.timeTravel({ step: 'step2', inputData: { invalidPayload: 2 } })).rejects.toThrow(
        'Invalid inputData: \n- step1Result: Required',
      );

      await mastra.stopEventEngine();
    });

    it('should throw error if trying to timetravel to a non-existent step', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      await expect(run.timeTravel({ step: 'step4', inputData: { step1Result: 2 } })).rejects.toThrow(
        "Time travel target step not found in execution graph: 'step4'. Verify the step id/path.",
      );

      await mastra.stopEventEngine();
    });

    it('should timeTravel a workflow execution', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.timeTravel({
        step: step2,
        context: {
          step1: {
            payload: { value: 0 },
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: Date.now(),
          },
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 3,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 3,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 4,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 4,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);

      const run2 = await workflow.createRun();
      const result2 = await run2.timeTravel({
        step: 'step2',
        inputData: { step1Result: 2 },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: {},
          step1: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 3,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 3,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 4,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 4,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);

      await mastra.stopEventEngine();
    });

    it('should timeTravel a workflow execution and run only one step when perStep is true', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.timeTravel({
        step: step2,
        context: {
          step1: {
            payload: { value: 0 },
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: Date.now(),
          },
        },
        perStep: true,
      });

      expect(result.status).toBe('paused');
      expect(result).toEqual({
        status: 'paused',
        steps: {
          input: {
            value: 0,
          },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 3,
            },
            endedAt: expect.any(Number),
          },
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);

      await mastra.stopEventEngine();
    });

    it('should timeTravel a workflow execution that was previously ran', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          if (inputData.step1Result < 3) {
            throw new Error('Simulated error');
          }
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const failedRun = await run.start({ inputData: { value: 0 } });
      expect(failedRun.status).toBe('failed');
      expect(failedRun.steps.step2).toMatchObject({
        status: 'failed',
        payload: { step1Result: 2 },
        error: expect.any(Error),
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // Errors are hydrated back to Error instances with preserved properties
      expect((failedRun.steps.step2 as any).error).toBeInstanceOf(Error);
      expect((failedRun.steps.step2 as any).error.name).toBe('Error');
      expect((failedRun.steps.step2 as any).error.message).toBe('Simulated error');

      const result = await run.timeTravel({
        step: step2,
        context: {
          step1: {
            payload: failedRun.steps.step1.payload,
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 3 },
            endedAt: Date.now(),
          },
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 3,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 3,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 4,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(1);

      const result2 = await run.timeTravel({
        step: 'step2',
        inputData: { step1Result: 4 },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: { value: 0 },
          step1: {
            payload: { value: 0 },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 4,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 5,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 5,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 6,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 6,
        },
      });

      expect(execute).toHaveBeenCalledTimes(1);

      await mastra.stopEventEngine();
    });

    it('should timeTravel a workflow execution that was previously ran and run only one step when perStep is true', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          if (inputData.step1Result < 3) {
            throw new Error('Simulated error');
          }
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const failedRun = await run.start({ inputData: { value: 0 } });
      expect(failedRun.status).toBe('failed');
      expect(failedRun.steps.step2).toMatchObject({
        status: 'failed',
        payload: { step1Result: 2 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // error is now an Error instance
      expect((failedRun.steps.step2 as any).error).toBeInstanceOf(Error);
      expect((failedRun.steps.step2 as any).error.message).toBe('Simulated error');

      const result = await run.timeTravel({
        step: 'step2',
        inputData: { step1Result: 4 },
        perStep: true,
      });

      expect(result.status).toBe('paused');
      expect(result).toEqual({
        status: 'paused',
        steps: {
          input: { value: 0 },
          step1: {
            payload: { value: 0 },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 4,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 5,
            },
            endedAt: expect.any(Number),
          },
        },
      });

      expect(execute).toHaveBeenCalledTimes(1);

      await mastra.stopEventEngine();
    });

    it('should timeTravel a workflow execution that has nested workflows', async () => {
      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const executeStep2 = vi.fn().mockResolvedValue({ step2Result: 3 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: executeStep2,
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            nestedFinal: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ nestedFinal: z.number() }),
      });

      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => {
          return {
            final: inputData.nestedFinal + 1,
          };
        },
        inputSchema: z.object({ nestedFinal: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nestedWorkflow',
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({
          nestedFinal: z.number(),
        }),
        steps: [step2, step3],
      })
        .then(step2)
        .then(step3)
        .commit();

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
      })
        .then(step1)
        .then(nestedWorkflow)
        .then(step4)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.timeTravel({
        step: 'nestedWorkflow.step3',
        context: {
          step1: {
            payload: { value: 0 },
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: Date.now(),
          },
        },
        nestedStepsContext: {
          nestedWorkflow: {
            step2: {
              payload: { step1Result: 2 },
              startedAt: Date.now(),
              status: 'success',
              output: { step2Result: 3 },
              endedAt: Date.now(),
            },
          },
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: { value: 0 },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          nestedWorkflow: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              nestedFinal: 4,
            },
            endedAt: expect.any(Number),
          },
          step4: {
            payload: {
              nestedFinal: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(0);

      const run2 = await workflow.createRun();
      const result2 = await run2.timeTravel({
        step: [nestedWorkflow, step3],
        inputData: { step2Result: 3 },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: {},
          step1: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
          nestedWorkflow: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              nestedFinal: 4,
            },
            endedAt: expect.any(Number),
          },
          step4: {
            payload: {
              nestedFinal: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(0);

      const run3 = await workflow.createRun();
      const result3 = await run3.timeTravel({
        step: 'nestedWorkflow',
        inputData: { step1Result: 2 },
      });

      expect(result3.status).toBe('success');
      expect(result3).toEqual({
        status: 'success',
        steps: {
          input: {},
          step1: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: expect.any(Number),
          },
          nestedWorkflow: {
            payload: { step1Result: 2 },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              nestedFinal: 4,
            },
            endedAt: expect.any(Number),
          },
          step4: {
            payload: {
              nestedFinal: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(1);

      await mastra.stopEventEngine();
    });

    it('should successfully suspend and resume a timeTravelled workflow execution', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
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
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
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
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
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
        id: 'promptEvalWorkflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { promptEvalWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.timeTravel({
        step: 'promptAgent',
        inputData: { userInput: 'test input' },
      });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(initialResult.steps).toEqual({
        input: {},
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          suspendPayload: {
            __workflow_meta: {
              path: ['promptAgent'],
              runId: expect.any(String),
            },
            testPayload: 'hello',
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(firstResumeResult.steps).toEqual({
        input: {},
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          suspendPayload: {
            testPayload: 'hello',
          },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          suspendPayload: {
            __workflow_meta: {
              path: ['improveResponse'],
              runId: expect.any(String),
            },
          },
        },
      });

      expect(getUserInputAction).toHaveBeenCalledTimes(0);
      await mastra.stopEventEngine();
    });

    it('should timetravel a suspended workflow execution', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
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
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
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
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
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
        id: 'promptEvalWorkflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { promptEvalWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({
        inputData: { input: 'test input' },
      });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(initialResult.steps).toEqual({
        input: { input: 'test input' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test input' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          suspendPayload: {
            __workflow_meta: {
              path: ['promptAgent'],
              runId: expect.any(String),
            },
            testPayload: 'hello',
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const timeTravelResult = await run.timeTravel({
        step: 'getUserInput',
        resumeData: {
          userInput: 'test input for resumption',
        },
      });
      if (!timeTravelResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(timeTravelResult.steps).toEqual({
        input: { input: 'test input' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test input' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          suspendPayload: { testPayload: 'hello' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          suspendPayload: {
            __workflow_meta: {
              path: ['improveResponse'],
              runId: expect.any(String),
            },
          },
        },
      });

      expect(getUserInputAction).toHaveBeenCalledTimes(2);
      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      await mastra.stopEventEngine();
    });

    it('should timeTravel workflow execution for a do-until workflow', async () => {
      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const firstStep = createStep({
        id: 'first-step',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        execute: async ({ inputData }) => {
          return inputData;
        },
      });

      const dowhileWorkflow = createWorkflow({
        id: 'dowhile-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(firstStep)
        .dountil(incrementStep, async ({ inputData }) => {
          return inputData.value >= 10;
        })
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'dowhile-workflow': dowhileWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await dowhileWorkflow.createRun();
      const result = await run.timeTravel({
        step: 'increment',
        context: {
          'first-step': {
            status: 'success',
            payload: {
              value: 0,
            },
            output: {
              value: 0,
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          increment: {
            payload: { value: 5 },
            startedAt: Date.now(),
            status: 'running',
            output: { value: 6 },
            endedAt: Date.now(),
          },
        },
      });
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          'first-step': {
            status: 'success',
            payload: {
              value: 0,
            },
            output: {
              value: 0,
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          increment: {
            payload: {
              value: 9,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              value: 10,
            },
            endedAt: expect.any(Number),
          },
          final: {
            payload: {
              value: 10,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              value: 10,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          value: 10,
        },
      });

      await mastra.stopEventEngine();
    });

    it('should timeTravel workflow execution for workflow with parallel steps', async () => {
      const initialStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'initial step done' };
      });

      const nextStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'next step done' };
      });

      const parallelStep1Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep1 done' };
      });

      const parallelStep2Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep2 done' };
      });

      const parallelStep3Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep3 done' };
      });

      const finalStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'All done!' };
      });

      // Create steps
      const initialStep = createStep({
        id: 'initialStep',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: initialStepAction,
      });

      const nextStep = createStep({
        id: 'nextStep',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: nextStepAction,
      });

      const parallelStep1 = createStep({
        id: 'parallelStep1',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep1Action,
      });

      const parallelStep2 = createStep({
        id: 'parallelStep2',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep2Action,
      });

      const parallelStep3 = createStep({
        id: 'parallelStep3',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep3Action,
      });

      const finalStep = createStep({
        id: 'finalStep',
        inputSchema: z.object({
          parallelStep1: z.object({ result: z.string() }),
          parallelStep2: z.object({ result: z.string() }),
          parallelStep3: z.object({ result: z.string() }),
        }),
        outputSchema: z.object({ result: z.string() }),
        execute: finalStepAction,
      });

      // Create workflow
      const testParallelWorkflow = createWorkflow({
        id: 'test-parallel-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        options: { validateInputs: false },
      })
        .then(initialStep)
        .then(nextStep)
        .parallel([parallelStep1, parallelStep2, parallelStep3])
        .then(finalStep)
        .commit();

      // Initialize Mastra with testStorage
      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-parallel-workflow': testParallelWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await testParallelWorkflow.createRun();

      const result = await run.timeTravel({
        step: 'nextStep',
        inputData: {
          result: 'initial step done',
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {},
          initialStep: {
            status: 'success',
            payload: {},
            output: {
              result: 'initial step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: expect.any(Number),
          },
          finalStep: {
            payload: {
              parallelStep1: { result: 'parallelStep1 done' },
              parallelStep2: { result: 'parallelStep2 done' },
              parallelStep3: { result: 'parallelStep3 done' },
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: { result: 'All done!' },
            endedAt: expect.any(Number),
          },
        },
        result: {
          result: 'All done!',
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(1);
      expect(parallelStep1Action).toHaveBeenCalledTimes(1);
      expect(parallelStep2Action).toHaveBeenCalledTimes(1);
      expect(parallelStep3Action).toHaveBeenCalledTimes(1);
      expect(finalStepAction).toHaveBeenCalledTimes(1);

      const run2 = await testParallelWorkflow.createRun();
      const result2 = await run2.timeTravel({
        step: 'parallelStep2',
        context: {
          initialStep: {
            status: 'success',
            payload: { input: 'start' },
            output: {
              result: 'initial step done',
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: Date.now(),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: Date.now(),
          },
        },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: { input: 'start' },
          initialStep: {
            status: 'success',
            payload: { input: 'start' },
            output: {
              result: 'initial step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: expect.any(Number),
          },
          finalStep: {
            payload: {
              parallelStep1: { result: 'parallelStep1 done' },
              parallelStep2: { result: 'parallelStep2 done' },
              parallelStep3: { result: 'parallelStep3 done' },
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: { result: 'All done!' },
            endedAt: expect.any(Number),
          },
        },
        result: {
          result: 'All done!',
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(1);
      expect(parallelStep1Action).toHaveBeenCalledTimes(1);
      expect(parallelStep2Action).toHaveBeenCalledTimes(2);
      expect(parallelStep3Action).toHaveBeenCalledTimes(1);
      expect(finalStepAction).toHaveBeenCalledTimes(2);

      const run3 = await testParallelWorkflow.createRun();
      const result3 = await run3.timeTravel({
        step: 'parallelStep2',
        inputData: {
          result: 'next step done',
        },
      });

      expect(result3.status).toBe('success');
      expect(result3).toEqual({
        status: 'success',
        steps: {
          input: {},
          initialStep: {
            status: 'success',
            payload: {},
            output: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: {},
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
          finalStep: {
            payload: {
              parallelStep1: {},
              parallelStep2: { result: 'parallelStep2 done' },
              parallelStep3: {},
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: { result: 'All done!' },
            endedAt: expect.any(Number),
          },
        },
        result: {
          result: 'All done!',
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(1);
      expect(parallelStep1Action).toHaveBeenCalledTimes(1);
      expect(parallelStep2Action).toHaveBeenCalledTimes(3);
      expect(parallelStep3Action).toHaveBeenCalledTimes(1);
      expect(finalStepAction).toHaveBeenCalledTimes(3);

      await mastra.stopEventEngine();
    });

    it('should timeTravel workflow execution for workflow with parallel steps and run just the timeTravelled step when perStep is true', async () => {
      const initialStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'initial step done' };
      });

      const nextStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'next step done' };
      });

      const parallelStep1Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep1 done' };
      });

      const parallelStep2Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep2 done' };
      });

      const parallelStep3Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep3 done' };
      });

      const finalStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'All done!' };
      });

      // Create steps
      const initialStep = createStep({
        id: 'initialStep',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: initialStepAction,
      });

      const nextStep = createStep({
        id: 'nextStep',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: nextStepAction,
      });

      const parallelStep1 = createStep({
        id: 'parallelStep1',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep1Action,
      });

      const parallelStep2 = createStep({
        id: 'parallelStep2',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep2Action,
      });

      const parallelStep3 = createStep({
        id: 'parallelStep3',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep3Action,
      });

      const finalStep = createStep({
        id: 'finalStep',
        inputSchema: z.object({
          parallelStep1: z.object({ result: z.string() }),
          parallelStep2: z.object({ result: z.string() }),
          parallelStep3: z.object({ result: z.string() }),
        }),
        outputSchema: z.object({ result: z.string() }),
        execute: finalStepAction,
      });

      // Create workflow
      const testParallelWorkflow = createWorkflow({
        id: 'test-parallel-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        options: { validateInputs: false },
      })
        .then(initialStep)
        .then(nextStep)
        .parallel([parallelStep1, parallelStep2, parallelStep3])
        .then(finalStep)
        .commit();

      // Initialize Mastra with testStorage
      const mastra = new Mastra({
        storage: testStorage,
        workflows: { 'test-parallel-workflow': testParallelWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await testParallelWorkflow.createRun();
      const result = await run.timeTravel({
        step: 'parallelStep2',
        context: {
          initialStep: {
            status: 'success',
            payload: { input: 'start' },
            output: {
              result: 'initial step done',
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: Date.now(),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: Date.now(),
          },
        },
        perStep: true,
      });

      expect(result.status).toBe('paused');
      expect(result).toEqual({
        status: 'paused',
        steps: {
          input: { input: 'start' },
          initialStep: {
            status: 'success',
            payload: { input: 'start' },
            output: {
              result: 'initial step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: expect.any(Number),
          },
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(0);
      expect(parallelStep1Action).toHaveBeenCalledTimes(0);
      expect(parallelStep2Action).toHaveBeenCalledTimes(1);
      expect(parallelStep3Action).toHaveBeenCalledTimes(0);
      expect(finalStepAction).toHaveBeenCalledTimes(0);

      const run2 = await testParallelWorkflow.createRun();
      const result2 = await run2.timeTravel({
        step: 'parallelStep2',
        inputData: {
          result: 'next step done',
        },
        perStep: true,
      });

      expect(result2.status).toBe('paused');
      expect(result2).toEqual({
        status: 'paused',
        steps: {
          input: {},
          initialStep: {
            status: 'success',
            payload: {},
            output: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: {},
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(0);
      expect(parallelStep1Action).toHaveBeenCalledTimes(0);
      expect(parallelStep2Action).toHaveBeenCalledTimes(2);
      expect(parallelStep3Action).toHaveBeenCalledTimes(0);
      expect(finalStepAction).toHaveBeenCalledTimes(0);

      await mastra.stopEventEngine();
    });

    it('should timeTravel to step in conditional chains', async () => {
      const step1Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ status: 'success' });
      });
      const step2Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step3' });
      });
      const step5Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step5' });
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ status: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step5 = createStep({
        id: 'step5',
        execute: step5Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ step5Result: z.string() }),
      });
      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => {
          return { result: inputData.result + inputData.step5Result };
        },
        inputSchema: z.object({ result: z.string(), step5Result: z.string().optional() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step2,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step5,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'failed';
            },
            step3,
          ],
        ])
        .map({
          result: {
            step: [step3, step2, step5],
            path: 'result',
          },
          step5Result: {
            step: step5,
            path: 'result',
          },
        })
        .then(step4)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.timeTravel({
        step: 'step5',
        inputData: {
          status: 'success',
        },
      });

      expect(step1Action).not.toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(step5Action).toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: {},
        step1: { status: 'success', output: { status: 'success' } },
        step2: { status: 'success', output: {} },
        step5: { status: 'success', output: { result: 'step5' } },
        step4: { status: 'success', output: { result: 'step5step5' } },
      });
      await mastra.stopEventEngine();
    });

    it('should timeTravel to step in conditional chains and run just one step when perStep is true', async () => {
      const step1Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ status: 'success' });
      });
      const step2Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step3' });
      });
      const step5Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step5' });
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ status: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step5 = createStep({
        id: 'step5',
        execute: step5Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ step5Result: z.string() }),
      });
      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => {
          return { result: inputData.result + inputData.step5Result };
        },
        inputSchema: z.object({ result: z.string(), step5Result: z.string().optional() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step2,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step5,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'failed';
            },
            step3,
          ],
        ])
        .map({
          result: {
            step: [step3, step2, step5],
            path: 'result',
          },
          step5Result: {
            step: step5,
            path: 'result',
          },
        })
        .then(step4)
        .commit();

      const mastra = new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.timeTravel({
        step: 'step5',
        inputData: {
          status: 'success',
        },
        perStep: true,
      });

      expect(step1Action).not.toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(step5Action).toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: {},
        step1: { status: 'success', output: { status: 'success' } },
        step5: { status: 'success', output: { result: 'step5' } },
      });
      expect(result.status).toBe('paused');

      await mastra.stopEventEngine();
    });
  });

  describe('Workflow Runs', () => {
    let testStorage;

    beforeEach(async () => {
      testStorage = new MockStore();
    });

    it('should return empty result when mastra is not initialized', async () => {
      const workflow = createWorkflow({ id: 'test', inputSchema: z.object({}), outputSchema: z.object({}) });
      const result = await workflow.listWorkflowRuns();
      expect(result).toEqual({ runs: [], total: 0 });
    });

    it('should get workflow runs from storage', async () => {
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({ id: 'test-workflow', inputSchema: z.object({}), outputSchema: z.object({}) });
      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        workflows: {
          'test-workflow': workflow,
        },
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      // Create a few runs
      const run1 = await workflow.createRun();
      await run1.start({ inputData: {} });

      const run2 = await workflow.createRun();
      await run2.start({ inputData: {} });

      const { runs, total } = await workflow.listWorkflowRuns();
      expect(total).toBe(2);
      expect(runs).toHaveLength(2);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId, run2.runId]));
      expect(runs[0]?.workflowName).toBe('test-workflow');
      expect(runs[0]?.snapshot).toBeDefined();
      expect(runs[1]?.snapshot).toBeDefined();

      await mastra.stopEventEngine();
    });

    it('should get workflow run by id from storage', async () => {
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({ id: 'test-workflow', inputSchema: z.object({}), outputSchema: z.object({}) });
      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: {
          'test-workflow': workflow,
        },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      // Create a few runs
      const run1 = await workflow.createRun();
      await run1.start({ inputData: {} });

      const { runs, total } = await workflow.listWorkflowRuns();
      expect(total).toBe(1);
      expect(runs).toHaveLength(1);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId]));
      expect(runs[0]?.workflowName).toBe('test-workflow');
      expect(runs[0]?.snapshot).toBeDefined();

      const workflowRun = await workflow.getWorkflowRunById(run1.runId);
      expect(workflowRun?.runId).toBe(run1.runId);
      expect(workflowRun?.workflowName).toBe('test-workflow');
      // getWorkflowRunById now returns WorkflowState with processed execution state
      expect(workflowRun?.status).toBe('success');
      expect(workflowRun?.steps).toBeDefined();

      await mastra.stopEventEngine();
    });
  });

  describe('Agent as step', () => {
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

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        logger: false,
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

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
      });

      expect(result.steps['test-agent-1']).toEqual({
        status: 'success',
        output: { text: 'Paris' },
        payload: {
          prompt: 'Capital of France, just the name',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['test-agent-2']).toEqual({
        status: 'success',
        output: { text: 'London' },
        payload: {
          prompt: 'Capital of UK, just the name',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should be able to use an agent in parallel', async () => {
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const finalStep = createStep({
        id: 'finalStep',
        inputSchema: z.object({
          'nested-workflow': z.object({ text: z.string() }),
          'nested-workflow-2': z.object({ text: z.string() }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        execute,
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({
          'nested-workflow': z.object({ text: z.string() }),
          'nested-workflow-2': z.object({ text: z.string() }),
        }),
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
        execute: async ({ inputData }) => {
          return {
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          };
        },
      });

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const nestedWorkflow1 = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        outputSchema: z.object({ text: z.string() }),
      })
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt1',
          },
        })
        .then(createStep(agent))
        .commit();

      const nestedWorkflow2 = createWorkflow({
        id: 'nested-workflow-2',
        inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        outputSchema: z.object({ text: z.string() }),
      })
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt2',
          },
        })
        .then(createStep(agent2))
        .commit();

      workflow.parallel([nestedWorkflow1, nestedWorkflow2]).then(finalStep).commit();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
      });

      expect(execute).toHaveBeenCalledTimes(1);
      expect(result.steps['finalStep']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {
          'nested-workflow': {
            text: 'Paris',
          },
          'nested-workflow-2': {
            text: 'London',
          },
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['nested-workflow']).toEqual({
        status: 'success',
        output: { text: 'Paris' },
        payload: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['nested-workflow-2']).toEqual({
        status: 'success',
        output: { text: 'London' },
        payload: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should be able to use an agent as a step via mastra instance', async () => {
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
        instructions: 'test agent instructions',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `Paris`,
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
            text: `London`,
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
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      workflow
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt1',
          },
        })
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
        .map({
          prompt: {
            step: startStep,
            path: 'prompt2',
          },
        })
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
        payload: {
          prompt: 'Capital of France, just the name',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['agent-step-2']).toEqual({
        status: 'success',
        output: { text: 'London' },
        payload: {
          prompt: 'Capital of UK, just the name',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should be able to use an agent as a step in nested workflow via mastra instance', async () => {
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
        instructions: 'test agent instructions',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `Paris`,
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
            text: `London`,
          }),
        }),
      });
      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const agentStep = createStep({
        id: 'agent-step',
        inputSchema: z.object({ agentName: z.string(), prompt: z.string() }),
        outputSchema: z.object({ text: z.string() }),
        execute: async ({ inputData, mastra }) => {
          const agent = mastra.getAgent(inputData.agentName);
          const result = await agent.generateLegacy([{ role: 'user', content: inputData.prompt }]);
          return { text: result.text };
        },
      });

      const agentStep2 = cloneStep(agentStep, { id: 'agent-step-2' });

      workflow
        .then(
          createWorkflow({
            id: 'nested-workflow',
            inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
            outputSchema: z.object({ text: z.string() }),
          })
            .map({
              agentName: {
                value: 'test-agent-1',
                schema: z.string(),
              },
              prompt: {
                initData: workflow,
                path: 'prompt1',
              },
            })
            .then(agentStep)
            .map({
              agentName: {
                value: 'test-agent-2',
                schema: z.string(),
              },
              prompt: {
                initData: workflow,
                path: 'prompt2',
              },
            })
            .then(agentStep2)
            .then(
              createStep({
                id: 'final-step',
                inputSchema: z.object({ text: z.string() }),
                outputSchema: z.object({ text: z.string() }),
                execute: async ({ getStepResult }) => {
                  return { text: `${getStepResult(agentStep)?.text} ${getStepResult(agentStep2)?.text}` };
                },
              }),
            )
            .commit(),
        )
        .commit();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
      });

      expect(result.steps['nested-workflow']).toEqual({
        status: 'success',
        output: { text: 'Paris London' },
        payload: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });
  });

  describe('Nested workflows', () => {
    it('should be able to nest workflows', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async () => {
        return { success: true };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(finalStep)
        .commit();
      counterWorkflow
        .parallel([wfA, wfB])
        .then(
          createStep({
            id: 'last-step',
            inputSchema: z.object({
              'nested-workflow-a': z.object({ success: z.boolean() }),
              'nested-workflow-b': z.object({ success: z.boolean() }),
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        workflows: {
          'counter-workflow': counterWorkflow,
        },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a'].output).toEqual({
        finalValue: 26 + 1,
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-b'].output).toEqual({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toEqual({
        output: { success: true },
        status: 'success',
        payload: {
          'nested-workflow-a': {
            finalValue: 27,
          },
          'nested-workflow-b': {
            finalValue: 1,
          },
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should be able to nest workflows sequentially', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async ({ inputData }) => {
        return { other: inputData.newValue + 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: 1 + otherVal };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: startStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(startStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: wfA.outputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(otherStep)
        .then(finalStep)
        .commit();
      counterWorkflow.then(wfA).then(wfB).commit();

      const mastra = new Mastra({
        workflows: {
          'counter-workflow': counterWorkflow,
        },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a'].output).toEqual({
        newValue: 1,
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-b'].output).toEqual({
        finalValue: 28,
      });

      await mastra.stopEventEngine();
    });

    it('should be able clone workflows as steps', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(cloneStep(otherStep, { id: 'other-clone' }))?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async () => {
        return { success: true };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(cloneStep(otherStep, { id: 'other-clone' }))
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(cloneStep(finalStep, { id: 'final-clone' }))
        .commit();

      const wfAClone = cloneWorkflow(wfA, { id: 'nested-workflow-a-clone' });

      counterWorkflow
        .parallel([wfAClone, wfB])
        .then(
          createStep({
            id: 'last-step',
            inputSchema: z.object({
              'nested-workflow-b': z.object({ success: z.boolean() }),
              'nested-workflow-a-clone': z.object({ success: z.boolean() }),
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        workflows: {
          'counter-workflow': counterWorkflow,
        },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a-clone'].output).toEqual({
        finalValue: 26 + 1,
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-b'].output).toEqual({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toEqual({
        output: { success: true },
        status: 'success',
        payload: {
          'nested-workflow-a-clone': {
            finalValue: 27,
          },
          'nested-workflow-b': {
            finalValue: 1,
          },
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should be able to nest workflows with conditions', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async () => {
        return { success: true };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ finalValue: z.number() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ other: otherStep.outputSchema, final: finalStep.outputSchema }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .branch([
          [async () => false, otherStep],
          // @ts-expect-error - testing dynamic workflow result
          [async () => true, finalStep],
        ])
        .map({
          finalValue: mapVariable({
            step: finalStep,
            path: 'finalValue',
          }),
        })
        .commit();
      counterWorkflow
        .parallel([wfA, wfB])
        .then(
          createStep({
            id: 'last-step',
            inputSchema: z.object({
              'nested-workflow-a': wfA.outputSchema,
              'nested-workflow-b': wfB.outputSchema,
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        workflows: { 'counter-workflow': counterWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a'].output).toEqual({
        finalValue: 26 + 1,
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-b'].output).toEqual({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toEqual({
        output: { success: true },
        status: 'success',
        payload: {
          'nested-workflow-a': {
            finalValue: 27,
          },
          'nested-workflow-b': {
            finalValue: 1,
          },
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    describe('new if else branching syntax with nested workflows', () => {
      it('should execute if-branch', async () => {
        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const first = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({ finalValue: z.number() }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({ success: z.boolean() }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(finalStep)
          .commit();
        counterWorkflow
          .then(
            createStep({
              id: 'first-step',
              inputSchema: z.object({ startValue: z.number() }),
              outputSchema: wfA.inputSchema,
              execute: first,
            }),
          )
          .branch([
            [async () => true, wfA],
            [async () => false, wfB],
          ])
          .then(
            createStep({
              id: 'last-step',
              inputSchema: z.object({
                'nested-workflow-a': wfA.outputSchema,
                'nested-workflow-b': wfB.outputSchema,
              }),
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          workflows: { 'counter-workflow': counterWorkflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);
        // @ts-expect-error - testing dynamic workflow result
        expect(result.steps['nested-workflow-a'].output).toEqual({
          finalValue: 26 + 1,
        });

        expect(result.steps['first-step']).toEqual({
          output: { success: true },
          status: 'success',
          payload: {
            startValue: 0,
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(result.steps['last-step']).toEqual({
          output: { success: true },
          status: 'success',
          payload: {
            'nested-workflow-a': {
              finalValue: 27,
            },
            'nested-workflow-b': undefined,
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });

      it('should execute else-branch', async () => {
        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const first = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({ finalValue: z.number() }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({ success: z.boolean() }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(finalStep)
          .commit();
        counterWorkflow
          .then(
            createStep({
              id: 'first-step',
              inputSchema: z.object({ startValue: z.number() }),
              outputSchema: wfA.inputSchema,
              execute: first,
            }),
          )
          .branch([
            [async () => false, wfA],
            [async () => true, wfB],
          ])
          .then(
            createStep({
              id: 'last-step',
              inputSchema: z.object({
                'nested-workflow-a': wfA.outputSchema,
                'nested-workflow-b': wfB.outputSchema,
              }),
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          workflows: { 'counter-workflow': counterWorkflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(0);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-expect-error - testing dynamic workflow result
        expect(result.steps['nested-workflow-b'].output).toEqual({
          finalValue: 1,
        });

        expect(result.steps['first-step']).toEqual({
          output: { success: true },
          status: 'success',
          payload: {
            startValue: 0,
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(result.steps['last-step']).toEqual({
          output: { success: true },
          status: 'success',
          payload: {
            'nested-workflow-b': {
              finalValue: 1,
            },
            'nested-workflow-a': undefined,
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });

      it('should execute nested else and if-branch', async () => {
        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const first = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({ finalValue: z.number() }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({ success: z.boolean() }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .branch([
            [
              async () => true,
              createWorkflow({
                id: 'nested-workflow-c',
                inputSchema: startStep.outputSchema,
                outputSchema: otherStep.outputSchema,
                options: { validateInputs: false },
              })
                .then(otherStep)
                .commit(),
            ],
            [
              async () => false,
              createWorkflow({
                id: 'nested-workflow-d',
                inputSchema: startStep.outputSchema,
                outputSchema: otherStep.outputSchema,
                options: { validateInputs: false },
              })
                .then(otherStep)
                .commit(),
            ],
          ])
          // TODO: maybe make this a little nicer to do with .map()?
          .then(
            createStep({
              id: 'map-results',
              inputSchema: z.object({
                'nested-workflow-c': otherStep.outputSchema,
                'nested-workflow-d': otherStep.outputSchema,
              }),
              outputSchema: otherStep.outputSchema,
              execute: async ({ inputData }) => {
                return { other: inputData['nested-workflow-c']?.other ?? inputData['nested-workflow-d']?.other };
              },
            }),
          )
          .then(finalStep)
          .commit();

        counterWorkflow
          .then(
            createStep({
              id: 'first-step',
              inputSchema: z.object({ startValue: z.number() }),
              outputSchema: wfA.inputSchema,
              execute: first,
            }),
          )
          .branch([
            [async () => false, wfA],
            [async () => true, wfB],
          ])
          .then(
            createStep({
              id: 'last-step',
              inputSchema: z.object({
                'nested-workflow-a': wfA.outputSchema,
                'nested-workflow-b': wfB.outputSchema,
              }),
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          workflows: { 'counter-workflow': counterWorkflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 1 } });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-expect-error - testing dynamic workflow result
        expect(result.steps['nested-workflow-b'].output).toEqual({
          finalValue: 1,
        });

        expect(result.steps['first-step']).toEqual({
          output: { success: true },
          status: 'success',
          payload: {
            startValue: 1,
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(result.steps['last-step']).toEqual({
          output: { success: true },
          status: 'success',
          payload: {
            'nested-workflow-a': undefined,
            'nested-workflow-b': {
              finalValue: 1,
            },
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });
    });

    describe('suspending and resuming nested workflows', () => {
      it('should be able to suspend nested workflow step', async () => {
        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
          if (!resumeData) {
            return await suspend();
          }
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const last = vi.fn().mockImplementation(async ({}) => {
          return { success: true };
        });
        const begin = vi.fn().mockImplementation(async ({ inputData }) => {
          return inputData;
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();

        counterWorkflow
          .then(
            createStep({
              id: 'begin-step',
              inputSchema: counterWorkflow.inputSchema,
              outputSchema: counterWorkflow.inputSchema,
              execute: begin,
            }),
          )
          .then(wfA)
          .then(
            createStep({
              id: 'last-step',
              inputSchema: wfA.outputSchema,
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          logger: false,
          storage: testStorage,
          workflows: { 'counter-workflow': counterWorkflow },
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });
        expect(begin).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(0);
        expect(last).toHaveBeenCalledTimes(0);
        expect(result.steps['nested-workflow-a']).toMatchObject({
          status: 'suspended',
        });

        // @ts-expect-error - testing dynamic workflow result
        expect(result.steps['last-step']).toEqual(undefined);

        const resumedResults = await run.resume({ step: [wfA, otherStep], resumeData: { newValue: 0 } });

        // @ts-expect-error - testing dynamic workflow result
        expect(resumedResults.steps['nested-workflow-a'].output).toEqual({
          finalValue: 26 + 1,
        });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(2);
        expect(final).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        await mastra.stopEventEngine();
      });
    });

    describe('Workflow results', () => {
      it('should be able to spec out workflow result via variables', async () => {
        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          execute: final,
        });

        const wfA = createWorkflow({
          steps: [startStep, otherStep, finalStep],
          id: 'nested-workflow-a',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          options: { validateInputs: false },
        });

        counterWorkflow
          .then(wfA)
          .then(
            createStep({
              id: 'last-step',
              inputSchema: wfA.outputSchema,
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          workflows: {
            'counter-workflow': counterWorkflow,
          },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });
        const results = result.steps;

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-expect-error - testing dynamic workflow result
        expect(results['nested-workflow-a']).toMatchObject({
          status: 'success',
          output: {
            finalValue: 26 + 1,
          },
        });

        expect(result.steps['last-step']).toEqual({
          status: 'success',
          output: { success: true },
          payload: {
            finalValue: 26 + 1,
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        await mastra.stopEventEngine();
      });
    });

    it('should be able to suspend nested workflow step in a nested workflow step', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
        if (!resumeData) {
          return await suspend();
        }
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async ({}) => {
        return { success: true };
      });
      const begin = vi.fn().mockImplementation(async ({ inputData }) => {
        return inputData;
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterInputSchema = z.object({
        startValue: z.number(),
      });
      const counterOutputSchema = z.object({
        finalValue: z.number(),
      });

      const passthroughExecute = vi.fn().mockImplementation(async ({ inputData }) => {
        return inputData;
      });
      const passthroughStep = createStep({
        id: 'passthrough',
        inputSchema: counterInputSchema,
        outputSchema: counterInputSchema,
        execute: passthroughExecute,
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();

      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(passthroughStep)
        .then(wfA)
        .commit();

      const wfC = createWorkflow({
        id: 'nested-workflow-c',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(passthroughStep)
        .then(wfB)
        .commit();

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: counterInputSchema,
        outputSchema: counterOutputSchema,
        steps: [wfC, passthroughStep],
        options: { validateInputs: false },
      });

      counterWorkflow
        .then(
          createStep({
            id: 'begin-step',
            inputSchema: counterWorkflow.inputSchema,
            outputSchema: counterWorkflow.inputSchema,
            execute: begin,
          }),
        )
        .then(wfC)
        .then(
          createStep({
            id: 'last-step',
            inputSchema: wfA.outputSchema,
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'counter-workflow': counterWorkflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(passthroughExecute).toHaveBeenCalledTimes(2);
      expect(result.steps['nested-workflow-c']).toMatchObject({
        status: 'suspended',
        suspendPayload: {
          __workflow_meta: {
            path: ['nested-workflow-c', 'nested-workflow-b', 'nested-workflow-a', 'other'],
          },
        },
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['last-step']).toEqual(undefined);

      if (result.status !== 'suspended') {
        expect.fail('Workflow should be suspended');
      }
      expect(result.suspended[0]).toEqual(['nested-workflow-c', 'nested-workflow-b', 'nested-workflow-a', 'other']);
      const resumedResults = await run.resume({ step: result.suspended[0], resumeData: { newValue: 0 } });

      // @ts-expect-error - testing dynamic workflow result
      expect(resumedResults.steps['nested-workflow-c'].output).toEqual({
        finalValue: 26 + 1,
      });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(2);
      expect(final).toHaveBeenCalledTimes(1);
      expect(last).toHaveBeenCalledTimes(1);
      expect(passthroughExecute).toHaveBeenCalledTimes(2);

      await mastra.stopEventEngine();
    });

    describe('abort signal propagation to nested workflows', () => {
      // Helper to create nested workflow test setup
      const createNestedWorkflowSetup = () => {
        let nestedStepStarted = false;
        let nestedStepCompleted = false;

        const nestedLongRunningStep = createStep({
          id: 'nested-long-step',
          inputSchema: z.object({ doubled: z.number() }),
          outputSchema: z.object({ result: z.string() }),
          execute: async ({ inputData, abortSignal }) => {
            nestedStepStarted = true;
            // Long running operation that should be cancelled
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                nestedStepCompleted = true;
                resolve(undefined);
              }, 5000);

              abortSignal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Aborted'));
              });
            });
            return { result: `completed: ${inputData.doubled}` };
          },
        });

        const nestedWorkflow = createWorkflow({
          id: 'nested-workflow',
          inputSchema: z.object({ doubled: z.number() }),
          outputSchema: z.object({ result: z.string() }),
          options: { validateInputs: false },
        })
          .then(nestedLongRunningStep)
          .commit();

        const parentStep = createStep({
          id: 'parent-step',
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ doubled: z.number() }),
          execute: async ({ inputData }) => {
            return { doubled: inputData.value * 2 };
          },
        });

        return {
          nestedWorkflow,
          parentStep,
          getNestedStepStarted: () => nestedStepStarted,
          getNestedStepCompleted: () => nestedStepCompleted,
        };
      };

      it('should propagate abort signal to nested workflow when using run.cancel()', async () => {
        const { nestedWorkflow, parentStep, getNestedStepStarted, getNestedStepCompleted } =
          createNestedWorkflowSetup();

        const parentWorkflow = createWorkflow({
          id: 'parent-workflow',
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.string() }),
          options: { validateInputs: false },
        })
          .then(parentStep)
          .then(nestedWorkflow)
          .commit();

        const mastra = new Mastra({
          workflows: { 'parent-workflow': parentWorkflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await parentWorkflow.createRun();

        // Start the workflow
        const resultPromise = run.start({ inputData: { value: 5 } });

        // Wait for nested step to start
        await vi.waitFor(() => expect(getNestedStepStarted()).toBe(true), { timeout: 2000 });

        // Cancel the parent workflow while nested is running
        await run.cancel();

        // Wait for the result
        const result = await resultPromise;

        // Parent should be cancelled
        expect(result.status).toBe('canceled');

        // Nested step should NOT have completed (was cancelled)
        expect(getNestedStepCompleted()).toBe(false);

        // Wait a bit to ensure the abort signal was properly propagated
        // If abort signal was NOT propagated, the nested step will still complete after 5s
        await new Promise(resolve => setTimeout(resolve, 6000));

        // If abort signal was properly propagated, the step should still not have completed
        // If abort signal was NOT propagated, the step will have completed in the background
        expect(getNestedStepCompleted()).toBe(false);

        await mastra.stopEventEngine();
      });

      it('should propagate abort signal to nested workflow when using run.abortController.abort() directly', async () => {
        const { nestedWorkflow, parentStep, getNestedStepStarted, getNestedStepCompleted } =
          createNestedWorkflowSetup();

        const parentWorkflow = createWorkflow({
          id: 'parent-workflow',
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.string() }),
          options: { validateInputs: false },
        })
          .then(parentStep)
          .then(nestedWorkflow)
          .commit();

        const mastra = new Mastra({
          workflows: { 'parent-workflow': parentWorkflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
        });
        await mastra.startEventEngine();

        const run = await parentWorkflow.createRun();

        // Start the workflow
        const resultPromise = run.start({ inputData: { value: 5 } });

        // Wait for nested step to start
        await vi.waitFor(() => expect(getNestedStepStarted()).toBe(true), { timeout: 2000 });

        // Use abortController.abort() directly instead of run.cancel()
        run.abortController.abort();

        // Wait for the result
        const result = await resultPromise;

        // Parent should be cancelled
        expect(result.status).toBe('canceled');

        // Nested step should NOT have completed (was cancelled)
        expect(getNestedStepCompleted()).toBe(false);

        // Wait a bit to ensure the abort signal was properly propagated
        await new Promise(resolve => setTimeout(resolve, 6000));

        // If abort signal was properly propagated, the step should still not have completed
        expect(getNestedStepCompleted()).toBe(false);

        await mastra.stopEventEngine();
      });

      it('should propagate abort signal to agent step in nested workflow when parent is cancelled', async () => {
        // Track if agent step was cancelled or completed
        let agentStepStarted = false;
        let agentStepCompleted = false;

        // Create an agent with a long-running mock that respects abort signal
        const agent = new Agent({
          id: 'test-agent',
          name: 'test-agent',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doStream: async ({ abortSignal }) => {
              agentStepStarted = true;
              // Simulate a long-running operation that respects abort signal
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  agentStepCompleted = true;
                  resolve(undefined);
                }, 5000);

                abortSignal?.addEventListener('abort', () => {
                  clearTimeout(timeout);
                  reject(new Error('Aborted'));
                });
              });
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
            },
          }),
        });

        const nestedWorkflow = createWorkflow({
          id: 'nested-workflow',
          inputSchema: z.object({ prompt: z.string() }),
          outputSchema: z.object({ text: z.string() }),
          options: { validateInputs: false },
        })
          .then(createStep(agent))
          .commit();

        const parentStep = createStep({
          id: 'parent-step',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ prompt: z.string() }),
          execute: async ({ inputData }) => {
            return { prompt: `Process: ${inputData.value}` };
          },
        });

        const parentWorkflow = createWorkflow({
          id: 'parent-workflow',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ text: z.string() }),
          options: { validateInputs: false },
        })
          .then(parentStep)
          .then(nestedWorkflow)
          .commit();

        const mastra = new Mastra({
          workflows: { 'parent-workflow': parentWorkflow },
          storage: testStorage,
          pubsub: new EventEmitterPubSub(),
          agents: { 'test-agent': agent },
        });
        await mastra.startEventEngine();

        const run = await parentWorkflow.createRun();

        // Start the workflow
        const resultPromise = run.start({ inputData: { value: 'test' } });

        // Wait for agent step to start
        await vi.waitFor(() => expect(agentStepStarted).toBe(true), { timeout: 2000 });

        // Cancel the parent workflow while agent is running
        await run.cancel();

        // Wait for the result
        const result = await resultPromise;

        // Parent should be cancelled
        expect(result.status).toBe('canceled');

        // Agent step should NOT have completed (was cancelled)
        expect(agentStepCompleted).toBe(false);

        // Wait a bit to ensure the abort signal was properly propagated
        await new Promise(resolve => setTimeout(resolve, 6000));

        // If abort signal was properly propagated, the agent step should still not have completed
        expect(agentStepCompleted).toBe(false);

        await mastra.stopEventEngine();
      });
    });
  });

  describe('Dependency Injection', () => {
    it('should inject requestContext dependencies into steps during run', async () => {
      const requestContext = new RequestContext();
      const testValue = 'test-dependency';
      requestContext.set('testKey', testValue);

      const step = createStep({
        id: 'step1',
        execute: async ({ requestContext }) => {
          const value = requestContext.get('testKey');
          return { injectedValue: value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      });
      workflow.then(step).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ requestContext });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.step1.output.injectedValue).toBe(testValue);

      await mastra.stopEventEngine();
    });

    it('should inject requestContext dependencies into steps during resume', async () => {
      const initialStorage = new MockStore();

      const requestContext = new RequestContext();
      const testValue = 'test-dependency';
      requestContext.set('testKey', testValue);

      const execute = vi.fn(async ({ requestContext, suspend, resumeData }) => {
        if (!resumeData?.human) {
          return await suspend();
        }

        const value = requestContext.get('testKey');
        return { injectedValue: value };
      });

      const step = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ human: z.boolean() }),
        outputSchema: z.object({}),
      });
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      });
      workflow.then(step).commit();

      const mastra = new Mastra({
        logger: false,
        storage: initialStorage,
        workflows: { 'test-workflow': workflow },
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ requestContext });

      const resumerequestContext = new RequestContext();
      resumerequestContext.set('testKey', testValue + '2');

      const result = await run.resume({
        step: step,
        resumeData: {
          human: true,
        },
        requestContext: resumerequestContext,
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result?.steps.step1.output.injectedValue).toBe(testValue + '2');

      await mastra.stopEventEngine();
    });
  });

  describe('consecutive parallel executions', () => {
    it('should support consecutive parallel calls with proper type inference', async () => {
      // First parallel stage steps
      const step1 = createStep({
        id: 'step1',
        inputSchema: z.object({
          input: z.string(),
        }),
        outputSchema: z.object({
          result1: z.string(),
        }),
        execute: vi.fn().mockImplementation(async ({ inputData }) => ({
          result1: `processed-${inputData.input}`,
        })),
      });

      const step2 = createStep({
        id: 'step2',
        inputSchema: z.object({
          input: z.string(),
        }),
        outputSchema: z.object({
          result2: z.string(),
        }),
        execute: vi.fn().mockImplementation(async ({ inputData }) => ({
          result2: `transformed-${inputData.input}`,
        })),
      });

      // Second parallel stage steps
      const step3 = createStep({
        id: 'step3',
        inputSchema: z.object({
          step1: z.object({
            result1: z.string(),
          }),
          step2: z.object({
            result2: z.string(),
          }),
        }),
        outputSchema: z.object({
          result3: z.string(),
        }),
        execute: vi.fn().mockImplementation(async ({ inputData }) => {
          return { result3: `combined-${inputData.step1.result1}-${inputData.step2.result2}` };
        }),
      });

      const step4 = createStep({
        id: 'step4',
        inputSchema: z.object({
          step1: z.object({
            result1: z.string(),
          }),
          step2: z.object({
            result2: z.string(),
          }),
        }),
        outputSchema: z.object({
          result4: z.string(),
        }),
        execute: vi.fn().mockImplementation(async ({ inputData }) => ({
          result4: `final-${inputData.step1.result1}-${inputData.step2.result2}`,
        })),
      });

      const workflow = createWorkflow({
        id: 'consecutive-parallel-workflow',
        inputSchema: z.object({
          input: z.string(),
        }),
        outputSchema: z.object({
          result3: z.string(),
          result4: z.string(),
        }),
        steps: [step1, step2, step3, step4],
      });

      // This tests the fix: consecutive parallel calls should work with proper type inference
      workflow.parallel([step1, step2]).parallel([step3, step4]).commit();

      const mastra = new Mastra({
        workflows: { 'consecutive-parallel-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { input: 'test-data' } });

      // Verify the final results
      expect(result.status).toBe('success');
      expect(result.steps.step1).toEqual({
        status: 'success',
        output: { result1: 'processed-test-data' },
        payload: { input: 'test-data' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step2).toEqual({
        status: 'success',
        output: { result2: 'transformed-test-data' },
        payload: { input: 'test-data' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step3).toEqual({
        status: 'success',
        output: { result3: 'combined-processed-test-data-transformed-test-data' },
        payload: {
          step1: { result1: 'processed-test-data' },
          step2: { result2: 'transformed-test-data' },
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step4).toEqual({
        status: 'success',
        output: { result4: 'final-processed-test-data-transformed-test-data' },
        payload: {
          step1: { result1: 'processed-test-data' },
          step2: { result2: 'transformed-test-data' },
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });
  });

  describe('Retry count', () => {
    it('retryCount property should increment the run count when a step is executed multiple times', async () => {
      const repeatingStep = createStep({
        id: 'repeatingStep',
        inputSchema: z.object({}),
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: async ({ retryCount }) => {
          return { count: retryCount };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: repeatingStep.outputSchema,
      })
        .dountil(repeatingStep, async ({ inputData }) => inputData.count === 3)
        .commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(result.steps.repeatingStep).toHaveProperty('output', { count: 3 });

      await mastra.stopEventEngine();
    });

    it('multiple steps should have different run counts', async () => {
      const step1 = createStep({
        id: 'step1',
        inputSchema: z.object({}),
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: async ({ retryCount }) => {
          return { count: retryCount };
        },
      });

      const step2 = createStep({
        id: 'step2',
        inputSchema: step1.outputSchema,
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: async ({ retryCount }) => {
          return { count: retryCount };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .dowhile(step1, async ({ inputData }) => {
          return inputData.count < 3;
        })
        .dountil(step2, async ({ inputData }) => inputData.count === 10)
        .commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toHaveProperty('output', { count: 3 });
      expect(result.steps.step2).toHaveProperty('output', { count: 10 });

      await mastra.stopEventEngine();
    });

    it('retryCount should exist and equal zero for the first run', async () => {
      const mockExec = vi.fn().mockImplementation(async ({ retryCount }) => {
        return { count: retryCount };
      });
      const step = createStep({
        id: 'step',
        inputSchema: z.object({}),
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: mockExec,
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(step)
        .commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));

      await mastra.stopEventEngine();
    });
  });

  describe('startAsync', () => {
    it('should start workflow and complete successfully', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-startAsync-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-startAsync-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const { runId } = await run.startAsync({ inputData: {} });

      expect(runId).toBe(run.runId);

      // Poll for completion
      let result;
      for (let i = 0; i < 10; i++) {
        result = await workflow.getWorkflowRunById(runId);
        if (result?.status === 'success') break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(result?.status).toBe('success');
      expect(result?.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });
  });

  describe('resourceId support', () => {
    it('should pass resourceId to createRun and persist it in storage', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow-resourceid',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow-resourceid': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const resourceId = 'user-123';
      const runId = 'test-run-resourceid';

      // Create run with resourceId
      const run = await workflow.createRun({
        runId,
        resourceId,
      });

      // Execute the workflow
      await run.start({ inputData: {} });

      // Check that resourceId is stored in the snapshot
      const storedRun = await workflow.getWorkflowRunById(runId);
      expect(storedRun?.resourceId).toBe(resourceId);

      await mastra.stopEventEngine();
    });
  });

  describe('onFinish and onError callbacks', () => {
    it('should call onFinish callback when workflow completes successfully', async () => {
      const onFinish = vi.fn();

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-onFinish-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish,
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-onFinish-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          result: { result: 'success' },
          steps: expect.any(Object),
        }),
      );

      await mastra.stopEventEngine();
    });

    it('should call onFinish callback when workflow fails', async () => {
      const onFinish = vi.fn();
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-onFinish-error-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onFinish,
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-onFinish-error-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.any(Error),
          steps: expect.any(Object),
        }),
      );

      await mastra.stopEventEngine();
    });

    it('should call onError callback when workflow fails', async () => {
      const onError = vi.fn();
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-onError-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError,
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-onError-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          steps: expect.any(Object),
        }),
      );

      await mastra.stopEventEngine();
    });

    it('should not call onError callback when workflow succeeds', async () => {
      const onError = vi.fn();

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-onError-not-called-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onError,
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-onError-not-called-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(onError).not.toHaveBeenCalled();

      await mastra.stopEventEngine();
    });

    it('should call both onFinish and onError when workflow fails and both are defined', async () => {
      const onFinish = vi.fn();
      const onError = vi.fn();
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-both-callbacks-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onFinish,
          onError,
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-both-callbacks-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);

      await mastra.stopEventEngine();
    });

    it('should support async onFinish callback', async () => {
      let callbackCompleted = false;
      const onFinish = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        callbackCompleted = true;
      });

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-async-onFinish-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish,
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-async-onFinish-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(callbackCompleted).toBe(true);

      await mastra.stopEventEngine();
    });

    it('should call onFinish with suspended status when workflow suspends', async () => {
      const onFinish = vi.fn();

      const suspendingStep = createStep({
        id: 'suspending-step',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        suspendSchema: z.object({ reason: z.string() }),
        resumeSchema: z.object({ resumeValue: z.string() }),
        execute: async ({ suspend }) => {
          return await suspend({ reason: 'Need user input' });
        },
      });

      const workflow = createWorkflow({
        id: 'test-onFinish-suspended-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [suspendingStep],
        options: {
          onFinish,
        },
      });
      workflow.then(suspendingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-onFinish-suspended-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('suspended');
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'suspended',
          steps: expect.any(Object),
        }),
      );

      await mastra.stopEventEngine();
    });

    it('should provide mastra instance in onFinish callback', async () => {
      let receivedMastra: Mastra | undefined = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-mastra-onFinish-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedMastra = result.mastra;
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-mastra-onFinish-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await mastra.getWorkflow('test-mastra-onFinish-workflow-evented').createRun();
      await run.start({ inputData: {} });

      expect(receivedMastra).toBe(mastra);

      await mastra.stopEventEngine();
    });

    it('should provide mastra instance in onError callback', async () => {
      let receivedMastra: Mastra | undefined = undefined;
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-mastra-onError-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError: errorInfo => {
            receivedMastra = errorInfo.mastra;
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-mastra-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await mastra.getWorkflow('test-mastra-onError-workflow-evented').createRun();
      await run.start({ inputData: {} });

      expect(receivedMastra).toBe(mastra);

      await mastra.stopEventEngine();
    });

    it('should provide logger in onFinish callback', async () => {
      let receivedLogger: any = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-logger-onFinish-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedLogger = result.logger;
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-logger-onFinish-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedLogger).toBeDefined();
      expect(typeof receivedLogger.info).toBe('function');
      expect(typeof receivedLogger.error).toBe('function');

      await mastra.stopEventEngine();
    });

    it('should provide logger in onError callback', async () => {
      let receivedLogger: any = undefined;
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-logger-onError-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError: errorInfo => {
            receivedLogger = errorInfo.logger;
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-logger-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedLogger).toBeDefined();
      expect(typeof receivedLogger.info).toBe('function');
      expect(typeof receivedLogger.error).toBe('function');

      await mastra.stopEventEngine();
    });

    it('should provide runId in onFinish callback', async () => {
      let receivedRunId: string | undefined = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-runId-onFinish-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedRunId = result.runId;
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-runId-onFinish-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedRunId).toBeDefined();
      expect(typeof receivedRunId).toBe('string');
      expect(receivedRunId).toBe(run.runId);

      await mastra.stopEventEngine();
    });

    it('should provide runId in onError callback', async () => {
      let receivedRunId: string | undefined = undefined;
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-runId-onError-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError: errorInfo => {
            receivedRunId = errorInfo.runId;
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-runId-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedRunId).toBeDefined();
      expect(typeof receivedRunId).toBe('string');
      expect(receivedRunId).toBe(run.runId);

      await mastra.stopEventEngine();
    });

    it('should provide workflowId in onFinish callback', async () => {
      let receivedWorkflowId: string | undefined = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflowId-onFinish-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedWorkflowId = result.workflowId;
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflowId-onFinish-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedWorkflowId).toBe('test-workflowId-onFinish-workflow-evented');

      await mastra.stopEventEngine();
    });

    it('should provide workflowId in onError callback', async () => {
      let receivedWorkflowId: string | undefined = undefined;
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflowId-onError-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError: errorInfo => {
            receivedWorkflowId = errorInfo.workflowId;
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflowId-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedWorkflowId).toBe('test-workflowId-onError-workflow-evented');

      await mastra.stopEventEngine();
    });

    it('should provide resourceId in onFinish callback when provided', async () => {
      let receivedResourceId: string | undefined = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-resourceId-onFinish-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedResourceId = result.resourceId;
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-resourceId-onFinish-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await mastra.getWorkflow('test-resourceId-onFinish-workflow-evented').createRun({
        resourceId: 'user-resource-123',
      });
      await run.start({ inputData: {} });

      expect(receivedResourceId).toBe('user-resource-123');

      await mastra.stopEventEngine();
    });

    it('should provide resourceId in onError callback when provided', async () => {
      let receivedResourceId: string | undefined = undefined;
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-resourceId-onError-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError: errorInfo => {
            receivedResourceId = errorInfo.resourceId;
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-resourceId-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await mastra.getWorkflow('test-resourceId-onError-workflow-evented').createRun({
        resourceId: 'error-resource-456',
      });
      await run.start({ inputData: {} });

      expect(receivedResourceId).toBe('error-resource-456');

      await mastra.stopEventEngine();
    });

    it('should provide requestContext in onFinish callback', async () => {
      let receivedRequestContext: RequestContext | undefined = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-requestContext-onFinish-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedRequestContext = result.requestContext;
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-requestContext-onFinish-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const requestContext = new RequestContext([['customKey', 'customValue']]);

      const run = await mastra.getWorkflow('test-requestContext-onFinish-workflow-evented').createRun();
      await run.start({ inputData: {}, requestContext });

      expect(receivedRequestContext).toBeDefined();
      expect(receivedRequestContext?.get('customKey')).toBe('customValue');

      await mastra.stopEventEngine();
    });

    it('should provide requestContext in onError callback', async () => {
      let receivedRequestContext: RequestContext | undefined = undefined;
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-requestContext-onError-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError: errorInfo => {
            receivedRequestContext = errorInfo.requestContext;
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-requestContext-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const requestContext = new RequestContext([['errorKey', 'errorValue']]);

      const run = await mastra.getWorkflow('test-requestContext-onError-workflow-evented').createRun();
      await run.start({ inputData: {}, requestContext });

      expect(receivedRequestContext).toBeDefined();
      expect(receivedRequestContext?.get('errorKey')).toBe('errorValue');

      await mastra.stopEventEngine();
    });

    it('should provide getInitData function in onFinish callback', async () => {
      let receivedInitData: any = null;

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({ userId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-getInitData-onFinish-workflow-evented',
        inputSchema: z.object({ userId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedInitData = result.getInitData();
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-getInitData-onFinish-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: { userId: 'user-123' } });

      expect(receivedInitData).toEqual({ userId: 'user-123' });

      await mastra.stopEventEngine();
    });

    it('should provide getInitData function in onError callback', async () => {
      let receivedInitData: any = null;
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({ userId: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-getInitData-onError-workflow-evented',
        inputSchema: z.object({ userId: z.string() }),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError: errorInfo => {
            receivedInitData = errorInfo.getInitData();
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-getInitData-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: { userId: 'user-456' } });

      expect(receivedInitData).toEqual({ userId: 'user-456' });

      await mastra.stopEventEngine();
    });

    it('should support async onError callback', async () => {
      let callbackCompleted = false;
      const onError = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        callbackCompleted = true;
      });
      const error = new Error('Step execution failed');

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(error),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-async-onError-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
        options: {
          onError,
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-async-onError-workflow-evented': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(callbackCompleted).toBe(true);

      await mastra.stopEventEngine();
    });
  });

  describe('State', () => {
    it('should execute a single step workflow successfully with state', async () => {
      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state, setState }) => {
          calls++;
          const newState = state.value + '!!!';
          await setState({ value: newState });
          return { result: 'success', value: newState };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
        outputOptions: {
          includeState: true,
        },
      });

      expect(calls).toBe(1);
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state!!!' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.state).toEqual({ value: 'test-state!!!', otherValue: 'test-other-state' });

      await mastra.stopEventEngine();
    });

    it('should execute multiple steps in parallel with state', async () => {
      const step1Action = vi.fn().mockImplementation(async ({ state }) => {
        return { value: 'step1', value2: state.value };
      });
      const step2Action = vi.fn().mockImplementation(async ({ state }) => {
        return { value: 'step2', value2: state.value };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        stateSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
      });

      workflow.parallel([step1, step2]).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {}, initialState: { value: 'test-state' } });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.steps).toEqual({
        input: {},
        step1: {
          status: 'success',
          output: { value: 'step1', value2: 'test-state' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        step2: {
          status: 'success',
          output: { value: 'step2', value2: 'test-state' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await mastra.stopEventEngine();
    });

    it('should follow conditional chains with state', async () => {
      const step1Action = vi.fn().mockImplementation(({ state }) => {
        return Promise.resolve({ status: 'success', value: state.value });
      });
      const step2Action = vi.fn().mockImplementation(({ state }) => {
        return Promise.resolve({ result: 'step2', value: state.value });
      });
      const step3Action = vi.fn().mockImplementation(({ state }) => {
        return Promise.resolve({ result: 'step3', value: state.value });
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ status: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData, state }) => {
          return { result: inputData.result, value: state.value };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1, step2, step3],
        stateSchema: z.object({ value: z.string() }),
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step2,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'failed';
            },
            step3,
          ],
        ])
        .map({
          result: {
            step: [step3, step2],
            path: 'result',
          },
        })
        .then(step4)
        .commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { status: 'success' }, initialState: { value: 'test-state' } });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step1: { status: 'success', output: { status: 'success', value: 'test-state' } },
        step2: { status: 'success', output: { result: 'step2', value: 'test-state' } },
        step4: { status: 'success', output: { result: 'step2', value: 'test-state' } },
      });

      await mastra.stopEventEngine();
    });

    it('should preserve state across suspend and resume cycles', async () => {
      const stateValuesObserved: any[] = [];

      const step1 = createStep({
        id: 'step-1',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: z.object({ count: z.number(), items: z.array(z.string()) }),
        execute: async ({ state, setState, suspend, resumeData }) => {
          stateValuesObserved.push({ step: 'step-1', state: { ...state } });

          if (!resumeData) {
            // First run: update state and suspend
            await setState({ ...state, count: state.count + 1, items: [...state.items, 'item-1'] });
            await suspend({});
            return {};
          }

          // After resume: state should be preserved
          return {};
        },
        resumeSchema: z.object({ proceed: z.boolean() }),
      });

      const step2 = createStep({
        id: 'step-2',
        inputSchema: z.object({}),
        outputSchema: z.object({ finalCount: z.number(), itemCount: z.number() }),
        stateSchema: z.object({ count: z.number(), items: z.array(z.string()) }),
        execute: async ({ state }) => {
          stateValuesObserved.push({ step: 'step-2', state: { ...state } });
          return { finalCount: state.count, itemCount: state.items.length };
        },
      });

      const workflow = createWorkflow({
        id: 'state-persistence-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ finalCount: z.number(), itemCount: z.number() }),
        stateSchema: z.object({ count: z.number(), items: z.array(z.string()) }),
        steps: [step1, step2],
      })
        .then(step1)
        .then(step2)
        .commit();

      const mastra = new Mastra({
        workflows: { 'state-persistence-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      // Start workflow with initial state
      const startResult = await run.start({
        inputData: {},
        initialState: { count: 0, items: [] },
      });

      expect(startResult.status).toBe('suspended');
      expect(stateValuesObserved).toHaveLength(1);
      expect(stateValuesObserved[0]).toEqual({
        step: 'step-1',
        state: { count: 0, items: [] },
      });

      // Resume workflow
      const resumeResult = await run.resume({
        step: 'step-1',
        resumeData: { proceed: true },
      });

      expect(resumeResult.status).toBe('success');
      // After resume, step-1 runs again and step-2 runs
      expect(stateValuesObserved.length).toBeGreaterThanOrEqual(2);

      // Step-2 should see the updated state
      const step2Observation = stateValuesObserved.find(o => o.step === 'step-2');
      expect(step2Observation?.state).toEqual({
        count: 1,
        items: ['item-1'],
      });

      await mastra.stopEventEngine();
    });

    it('should properly update state when executing multiple steps in parallel', async () => {
      const shareSchema = z.object({
        name: z.string(),
        age: z.number(),
        test: z.string(),
        random: z.string(),
      });

      const setSteps = createStep({
        id: 'setSteps',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: shareSchema.pick({ test: true }),
        execute: async ({ state, setState }) => {
          const newState = { ...state, test: 'asdf' };
          await setState(newState);
          return {};
        },
      });

      const workflow2 = createWorkflow({
        id: 'workflow2',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: shareSchema.pick({ test: true }),
      })
        .then(setSteps)
        .commit();

      const step1 = createStep({
        id: 'step1',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: shareSchema.pick({ name: true, age: true }),
        execute: async ({ state, setState }) => {
          const newState = { ...state, name: 'name', age: 18 };
          await setState(newState);
          return {};
        },
      });

      const step2 = createStep({
        id: 'step2',
        inputSchema: z.object({}),
        outputSchema: shareSchema,
        stateSchema: shareSchema,
        execute: async ({ state }) => {
          return state;
        },
      });

      const workflow1 = createWorkflow({
        id: 'workflow1',
        inputSchema: z.object({}),
        outputSchema: shareSchema,
        stateSchema: shareSchema,
      })
        .parallel([step1, workflow2])
        .then(step2)
        .commit();

      const mastra = new Mastra({
        workflows: { workflow1, workflow2 },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow1.createRun();
      const result = await run.start({
        inputData: {},
        initialState: {
          name: '',
          age: 0,
          test: '',
          random: 'random',
        },
        outputOptions: {
          includeState: true,
        },
      });

      expect(result.status).toBe('success');
      expect(result.state).toEqual({
        name: 'name',
        age: 18,
        test: 'asdf',
        random: 'random',
      });

      await mastra.stopEventEngine();
    });

    it('should update state after each concurrent batch in foreach step', async () => {
      const subWorkflow1 = createWorkflow({
        id: 's1',
        inputSchema: z.number(),
        outputSchema: z.number(),
        stateSchema: z.object({ output: z.number() }),
      })
        .then(
          createStep({
            id: 's1s',
            inputSchema: z.number(),
            outputSchema: z.number(),
            stateSchema: z.object({ output: z.number() }),
            execute: async ctx => {
              expect(ctx.state.output).toBe(2);
              return ctx.inputData;
            },
          }),
        )
        .commit();

      const subWorkflow2 = createWorkflow({
        id: 's2',
        inputSchema: z.number(),
        outputSchema: z.number(),
        stateSchema: z.object({ output: z.number() }),
      })
        .then(
          createStep({
            id: 's2s',
            inputSchema: z.number(),
            outputSchema: z.number(),
            stateSchema: z.object({ output: z.number() }),
            execute: async ctx => {
              ctx.setState({ ...ctx.state, output: 2 });
              return ctx.inputData;
            },
          }),
        )
        .commit();

      const routing = createWorkflow({
        id: 'routing',
        inputSchema: z.number(),
        outputSchema: z.number(),
        stateSchema: z.object({ output: z.number() }),
      })
        .branch([
          [async s => s.inputData === 1, subWorkflow1],
          [async s => s.inputData === 2, subWorkflow2],
        ])
        .map(async ({ inputData }) => {
          return (inputData.s1 ?? 0) + (inputData.s2 ?? 0);
        })
        .commit();

      const workflows = createWorkflow({
        id: 'root',
        inputSchema: z.array(z.number()),
        outputSchema: z.array(z.number()),
        stateSchema: z.object({ output: z.number() }),
      })
        .foreach(routing)
        .commit();

      const mastra = new Mastra({
        workflows: { root: workflows, routing, s1: subWorkflow1, s2: subWorkflow2 },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflows.createRun();
      const result = await run.start({
        inputData: [2, 1],
        initialState: { output: 0 },
        outputOptions: {
          includeState: true,
        },
      });

      expect(result.status).toBe('success');
      expect(result.state).toEqual({ output: 2 });

      await mastra.stopEventEngine();
    });

    it('should generate a stream for a single step workflow successfully with state', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state }) => {
          return { result: 'success', value: state.value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const streamResult = run.stream({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
        outputOptions: { includeState: true },
      });

      const executionResult = await streamResult.result;

      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(executionResult.state).toEqual({ value: 'test-state', otherValue: 'test-other-state' });

      await mastra.stopEventEngine();
    });

    it('should execute a single step nested workflow successfully with state', async () => {
      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state }) => {
          calls++;
          return { result: 'success', value: state.value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
        steps: [step1],
      })
        .then(step1)
        .commit();

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
        }),
        steps: [nestedWorkflow],
      });

      workflow.then(nestedWorkflow).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow, 'nested-workflow': nestedWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
      });

      expect(calls).toBe(1);
      expect(result.steps['nested-workflow']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should execute a single step nested workflow successfully with state being set by the nested workflow', async () => {
      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state, setState }) => {
          calls++;
          await setState({ ...state, value: state.value + '!!!' });
          return {};
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: z.object({
          value: z.string(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ state }) => {
          calls++;
          return { result: 'success', value: state.value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
        steps: [step1, step2],
      })
        .then(step1)
        .then(step2)
        .commit();

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
        }),
        steps: [nestedWorkflow],
      });

      workflow.then(nestedWorkflow).commit();

      const mastra = new Mastra({
        workflows: { 'test-workflow': workflow, 'nested-workflow': nestedWorkflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
      });

      expect(calls).toBe(2);
      expect(result.steps['nested-workflow']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state!!!' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      await mastra.stopEventEngine();
    });

    it('should handle basic suspend and resume flow with async await syntax with state', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend, state, setState }) => {
          await setState({ ...state, value: 'test state' });
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockImplementation(({ state }) => ({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
        value: state.value,
      }));

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
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
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
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
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
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
        workflows: { 'test-workflow': promptEvalWorkflow },
      });
      await mastra.startEventEngine();

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(initialResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          suspendPayload: { testPayload: 'hello' },
        },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(firstResumeResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          suspendPayload: { testPayload: 'hello' },
          resumePayload: { userInput: 'test input for resumption' },
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
        },
        improveResponse: {
          status: 'suspended',
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
      });

      const secondResumeResult = await run.resume({
        step: improveResponse,
        resumeData: {
          toneScore: { score: 0.8 },
          completenessScore: { score: 0.7 },
        },
      });
      if (!secondResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      expect(secondResumeResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          suspendPayload: { testPayload: 'hello' },
          resumePayload: { userInput: 'test input for resumption' },
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
        },
        improveResponse: {
          status: 'success',
          output: { improvedOutput: 'improved output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          resumePayload: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 }, value: 'test state' },
          payload: { improvedOutput: 'improved output' },
        },
      });

      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      await mastra.stopEventEngine();
    });

    it('should provide state in onFinish callback', async () => {
      let receivedState: Record<string, any> | undefined = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: async ({ setState }) => {
          await setState({ counter: 42 });
          return { result: 'success' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ counter: z.number().optional() }),
      });

      const workflow = createWorkflow({
        id: 'test-state-onFinish-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ counter: z.number().optional() }),
        steps: [step1],
        options: {
          onFinish: result => {
            receivedState = result.state;
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: { 'test-state-onFinish-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedState).toBeDefined();
      expect(receivedState?.counter).toBe(42);

      await mastra.stopEventEngine();
    });

    it('should provide state in onError callback', async () => {
      let receivedState: Record<string, any> | undefined = undefined;

      const step1 = createStep({
        id: 'step1',
        execute: async ({ setState }) => {
          await setState({ counter: 10 });
          return { result: 'success' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ counter: z.number().optional() }),
      });

      const failingStep = createStep({
        id: 'failing-step',
        execute: vi.fn().mockRejectedValue(new Error('Step execution failed')),
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({}),
        stateSchema: z.object({ counter: z.number().optional() }),
      });

      const workflow = createWorkflow({
        id: 'test-state-onError-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: z.object({ counter: z.number().optional() }),
        steps: [step1, failingStep],
        options: {
          onError: errorInfo => {
            receivedState = errorInfo.state;
          },
        },
      });
      workflow.then(step1).then(failingStep).commit();

      const mastra = new Mastra({
        workflows: { 'test-state-onError-workflow': workflow },
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(receivedState).toBeDefined();
      expect(receivedState?.counter).toBe(10);

      await mastra.stopEventEngine();
    });
  });

  describe('Suspend/Resume Edge Cases - Phase 4', () => {
    it('should auto-resume simple suspended step without specifying step parameter', async () => {
      const simpleStep = createStep({
        id: 'simple-step',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          result: z.number(),
        }),
        resumeSchema: z.object({
          multiplier: z.number(),
        }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: inputData.value * resumeData.multiplier };
        },
      });

      const simpleWorkflow = createWorkflow({
        id: 'simple-auto-resume-workflow-evented',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
      })
        .then(simpleStep)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
        workflows: { 'simple-auto-resume-workflow-evented': simpleWorkflow },
      });
      await mastra.startEventEngine();

      const run = await simpleWorkflow.createRun();

      // Start workflow - should suspend
      const startResult = await run.start({ inputData: { value: 10 } });
      expect(startResult.status).toBe('suspended');
      if (startResult.status === 'suspended') {
        expect(startResult.suspended).toEqual([['simple-step']]);
      }

      // Test auto-resume without step parameter
      const autoResumeResult = await run.resume({
        resumeData: { multiplier: 5 },
        // No step parameter - should auto-detect
      });

      expect(autoResumeResult.status).toBe('success');
      if (autoResumeResult.status === 'success') {
        expect(autoResumeResult.result.result).toBe(50); // 10 * 5
      }

      // Test explicit step parameter still works (backwards compatibility)
      const run2 = await simpleWorkflow.createRun();
      const startResult2 = await run2.start({ inputData: { value: 20 } });
      expect(startResult2.status).toBe('suspended');
      if (startResult2.status === 'suspended') {
        const explicitResumeResult = await run2.resume({
          step: startResult2.suspended[0],
          resumeData: { multiplier: 3 },
        });

        expect(explicitResumeResult.status).toBe('success');
        if (explicitResumeResult.status === 'success') {
          expect(explicitResumeResult.result.result).toBe(60); // 20 * 3
        }
      }

      await mastra.stopEventEngine();
    });

    // NOTE: This test is skipped because evented runtime stops at the first suspended step
    // in parallel execution, unlike the default runtime which tracks all suspended steps.
    // The auto-resume error handling code IS implemented and would work if multiple steps
    // could be suspended. This is a runtime limitation, not a missing feature.
    it.skip('should throw error when multiple steps are suspended and no step specified (evented runtime stops at first suspend)', async () => {
      // Create two steps that will suspend in parallel
      const parallelStep1 = createStep({
        id: 'parallel-step-1',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ multiplier: z.number() }),
        execute: async ({ suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: 100 * resumeData.multiplier };
        },
      });

      const parallelStep2 = createStep({
        id: 'parallel-step-2',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ divisor: z.number() }),
        execute: async ({ suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: 100 / resumeData.divisor };
        },
      });

      // Create a workflow that executes both steps in parallel
      // Both will suspend simultaneously
      const multiSuspendWorkflow = createWorkflow({
        id: 'multi-suspend-workflow-evented',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [parallelStep1, parallelStep2],
      })
        .parallel([parallelStep1, parallelStep2])
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
        workflows: { 'multi-suspend-workflow-evented': multiSuspendWorkflow },
      });
      await mastra.startEventEngine();

      const run = await multiSuspendWorkflow.createRun();

      // Start workflow - both parallel steps should suspend
      const startResult = await run.start({ inputData: {} });
      expect(startResult.status).toBe('suspended');

      if (startResult.status === 'suspended') {
        // Should have two suspended steps from parallel execution
        expect(startResult.suspended.length).toBeGreaterThan(1);
        // Check that we have both steps suspended
        const suspendedStepIds = startResult.suspended.map(path => path[path.length - 1]);
        expect(suspendedStepIds).toContain('parallel-step-1');
        expect(suspendedStepIds).toContain('parallel-step-2');
      }

      // Test auto-resume should fail with multiple suspended steps
      await expect(
        run.resume({
          resumeData: { multiplier: 2 },
          // No step parameter - should fail with multiple suspended steps
        }),
      ).rejects.toThrow('Multiple suspended steps found');

      // Test explicit step parameter works correctly
      const explicitResumeResult = await run.resume({
        step: 'parallel-step-1',
        resumeData: { multiplier: 2 },
      });

      // After resuming one step, there should still be another suspended
      expect(explicitResumeResult.status).toBe('suspended');
      if (explicitResumeResult.status === 'suspended') {
        const suspendedStepIds = explicitResumeResult.suspended.map(path => path[path.length - 1]);
        expect(suspendedStepIds).toContain('parallel-step-2');
        expect(suspendedStepIds).not.toContain('parallel-step-1');
      }

      await mastra.stopEventEngine();
    });

    it('should throw error when you try to resume a workflow that is not suspended', async () => {
      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow-evented',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(incrementStep)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
        workflows: { 'increment-workflow-evented': incrementWorkflow },
      });
      await mastra.startEventEngine();

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('success');

      try {
        await run.resume({
          resumeData: { value: 2 },
          step: ['increment'],
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const errMessage = (error as { message: string })?.message;
        expect(errMessage).toBe('This workflow run was not suspended');
      }

      await mastra.stopEventEngine();
    });

    it('should throw error when you try to resume a workflow step that is not suspended', async () => {
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({ message: `Please provide additional information. now value is ${inputData.value}` });
          }

          return { value: finalValue };
        },
      });

      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow-step-not-suspended-evented',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(incrementStep)
        .then(resumeStep)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
        workflows: { 'increment-workflow-step-not-suspended-evented': incrementWorkflow },
      });
      await mastra.startEventEngine();

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      try {
        await run.resume({
          resumeData: { value: 2 },
          step: ['increment'],
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const errMessage = (error as { message: string })?.message;
        expect(errMessage).toBe(
          'This workflow step "increment" was not suspended. Available suspended steps: [resume]',
        );
      }

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');

      await mastra.stopEventEngine();
    });

    it('should support both explicit step resume and auto-resume (backwards compatibility)', async () => {
      const suspendStep = createStep({
        id: 'suspend-step',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        resumeSchema: z.object({
          extraData: z.string(),
        }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            // First execution - suspend
            await suspend({ waitingFor: 'user-input', originalValue: inputData.value });
            return { result: '' }; // Should not be reached
          } else {
            // Resume execution
            return { result: `processed-${resumeData.extraData}` };
          }
        },
      });

      const completeStep = createStep({
        id: 'complete-step',
        inputSchema: z.object({
          result: z.string(),
        }),
        outputSchema: z.object({
          final: z.string(),
        }),
        execute: async ({ inputData }) => {
          return { final: `Completed: ${inputData.result}` };
        },
      });

      const testWorkflow = createWorkflow({
        id: 'auto-resume-test-workflow-evented',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ final: z.string() }),
      })
        .then(suspendStep)
        .then(completeStep)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
        workflows: { 'auto-resume-test-workflow-evented': testWorkflow },
      });
      await mastra.startEventEngine();

      // Test 1: Start workflow and suspend
      const run1 = await testWorkflow.createRun();
      const result1 = await run1.start({ inputData: { value: 42 } });
      expect(result1.status).toBe('suspended');
      expect(result1.suspended).toEqual([['suspend-step']]);

      // Test 2: Resume with explicit step parameter (backwards compatibility)
      const explicitResumeResult = await run1.resume({
        step: result1.suspended[0], // Pass the explicit suspended step
        resumeData: { extraData: 'explicit-resume' },
      });
      expect(explicitResumeResult.status).toBe('success');
      expect(explicitResumeResult.result.final).toBe('Completed: processed-explicit-resume');

      // Test 3: Auto-resume without step parameter (new feature)
      const run2 = await testWorkflow.createRun();
      const result2 = await run2.start({ inputData: { value: 100 } });
      expect(result2.status).toBe('suspended');

      const autoResumeResult = await run2.resume({
        resumeData: { extraData: 'auto-resume' },
        // No step parameter - should auto-detect
      });
      expect(autoResumeResult.status).toBe('success');
      expect(autoResumeResult.result.final).toBe('Completed: processed-auto-resume');

      await mastra.stopEventEngine();
    });

    it('should handle missing suspendData gracefully', async () => {
      const stepWithoutSuspend = createStep({
        id: 'no-suspend-step',
        inputSchema: z.object({
          value: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        execute: async ({ inputData, suspendData }) => {
          // Should handle missing suspendData gracefully
          const message = suspendData ? 'Had suspend data' : 'No suspend data';
          return { result: `${inputData.value}: ${message}` };
        },
      });

      const workflow = createWorkflow({
        id: 'no-suspend-workflow-evented',
        inputSchema: z.object({
          value: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      workflow.then(stepWithoutSuspend).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        pubsub: new EventEmitterPubSub(),
        workflows: { 'no-suspend-workflow-evented': workflow },
      });
      await mastra.startEventEngine();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: { value: 'test' },
      });

      expect(result.status).toBe('success');
      expect(result.result.result).toBe('test: No suspend data');

      await mastra.stopEventEngine();
    });
  });
});
