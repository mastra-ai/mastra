import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTool, Mastra, Telemetry } from '..';
import { Agent } from '../agent';
import { RuntimeContext } from '../di';
import { MockStore } from '../storage/mock';
import type { StreamEvent, WatchEvent } from './types';
import { cloneStep, cloneWorkflow, createStep, createWorkflow, mapVariable } from './workflow';

const testStorage = new MockStore();

vi.mock('crypto', () => {
  return {
    randomUUID: vi.fn(() => 'mock-uuid-1'),
  };
});

describe('Workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    let counter = 0;
    (randomUUID as vi.Mock).mockImplementation(() => {
      return `mock-uuid-${++counter}`;
    });
  });

  describe('Streaming', () => {
    it('should generate a stream', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRunAsync({
        runId,
      });

      const { stream, getWorkflowState } = run.stream({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of stream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await getWorkflowState();

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
    });

    it('should handle basic suspend and resume flow', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          console.log('suspend');
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

      new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRunAsync();

      const { stream, getWorkflowState } = run.stream({ inputData: { input: 'test' } });

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

      new Mastra({
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        idGenerator: randomUUID,
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

      const run = await workflow.createRunAsync({
        runId: 'test-run-id',
      });
      const { stream } = await run.stream({
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
            id: 'mapping_mock-uuid-1',
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
            id: 'mapping_mock-uuid-1',
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
            id: 'mapping_mock-uuid-1',
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
            id: 'mapping_mock-uuid-2',
            payload: {
              text: 'Paris',
            },
            startedAt: expect.any(Number),
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'mapping_mock-uuid-2',
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
            id: 'mapping_mock-uuid-2',
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
    });

    it('should handle sleep waiting flow', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRunAsync({
        runId,
      });

      const { stream, getWorkflowState } = run.stream({ inputData: {} });

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
            id: 'sleep_mock-uuid-1',
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
            id: 'sleep_mock-uuid-1',
            endedAt: expect.any(Number),
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
            id: 'sleep_mock-uuid-1',
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
    });

    it('should handle sleep waiting flow with fn parameter', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ value: 1000 });
      const step2Action = vi.fn<any>().mockResolvedValue({ value: 2000 });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
      });
      workflow
        .then(step1)
        .sleep(async ({ inputData }) => {
          return inputData.value;
        })
        .then(step2)
        .commit();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRunAsync({
        runId,
      });

      const { stream, getWorkflowState } = run.stream({ inputData: {} });

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
              value: 1000,
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
            id: 'sleep_mock-uuid-1',
            startedAt: expect.any(Number),
            status: 'waiting',
            payload: {
              value: 1000,
            },
          },
          type: 'step-waiting',
        },
        {
          payload: {
            id: 'sleep_mock-uuid-1',
            endedAt: expect.any(Number),
            status: 'success',
            output: {
              value: 1000,
            },
          },
          type: 'step-result',
        },
        {
          type: 'step-finish',
          payload: {
            id: 'sleep_mock-uuid-1',
            metadata: {},
          },
        },
        {
          payload: {
            id: 'step2',
            payload: {
              value: 1000,
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
              value: 2000,
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
        output: { value: 1000 },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toEqual({
        status: 'success',
        output: { value: 2000 },
        payload: {
          value: 1000,
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should preserve input property from snapshot context after resume', async () => {
      const step1Action = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ result: 'resumed' }));

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({ originalInput: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ originalInput: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
      });

      const run = await workflow.createRunAsync({ runId: 'test-run-id' });
      const originalInput = { originalInput: 'original-data' };

      const { stream, getWorkflowState } = run.stream({ inputData: originalInput });

      for await (const data of stream) {
        if (data.type === 'step-suspended') {
          // Resume with different data to test that input comes from snapshot, not resume data
          setImmediate(() => {
            const resumeData = { stepId: 'step1', context: { differentData: 'resume-data' } };
            run.resume({ resumeData: resumeData as any, step: step1 });
          });
        }
      }

      const result = await getWorkflowState();

      expect.assertions(3);
      // Verify that the input property is preserved from the original snapshot context
      // This is the key test: input should come from snapshot.context.input, not from resumeData
      expect(result.steps.input).toEqual(originalInput);

      // Also verify that the step received the original input as payload, not the resume data
      expect(result.steps.step1.payload).toEqual(originalInput);

      // Verify that resume data is separate from the input
      if (result.steps.step1.status === 'success') {
        expect(result.steps.step1).toMatchObject({
          output: { result: 'resumed' },
          resumePayload: { stepId: 'step1', context: { differentData: 'resume-data' } },
        });
      }
    });

    it('should handle waitForEvent waiting flow', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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
      workflow.then(step1).waitForEvent('user-event-test', step2).commit();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRunAsync({
        runId,
      });

      const { stream, getWorkflowState } = run.stream({ inputData: {} });

      setTimeout(() => {
        run.sendEvent('user-event-test', {
          value: 'eventdata',
        });
      }, 2000);

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of stream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await getWorkflowState();

      expect(watchData.length).toBe(9);
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
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step1',
            output: {
              result: 'success1',
            },
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
          },
          type: 'step-waiting',
        },
        {
          payload: {
            id: 'step2',
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step2',
            output: {
              result: 'success2',
            },
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
        resumePayload: {
          value: 'eventdata',
        },
        resumedAt: expect.any(Number),
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
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

      const run = await workflow.createRunAsync();
      const result = await run.start({ inputData: { value: 'bail' } });

      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'bailed' },
        payload: { value: 'bail' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toBeUndefined();

      const run2 = await workflow.createRunAsync();
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
    });

    it('should throw error when execution flow not defined', () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      expect(() => workflow.createRun()).toThrowError(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    });

    it('should throw error when execution graph is not committed', () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      expect(() => workflow.createRun()).toThrowError(
        'Uncommitted step flow changes detected. Call .commit() to register the steps.',
      );
    });

    it('should execute a single step workflow successfully', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      const run = await workflow.createRunAsync();
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should have access to typed workflow results', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      const run = await workflow.createRunAsync();
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
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

      const run = await workflow.createRunAsync();
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

      const run = await workflow.createRunAsync();
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
    });

    describe('Variable Resolution', () => {
      it('should resolve trigger data', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });

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

        const run = await workflow.createRunAsync();
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

        const run = await workflow.createRunAsync();
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
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

        const run = await workflow.createRunAsync();
        await run.start({ inputData: { inputData: 'test-input' } });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { inputData: 'test-input' },
          }),
        );
      });

      it('should resolve trigger data from getInitData', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

        const run = await workflow.createRunAsync();
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
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

        const run = await workflow.createRunAsync();
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
      });

      it('should resolve trigger data and DI runtimeContext values via .map()', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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
              runtimeContextPath: 'life',
              schema: z.number(),
            },
          })
          .then(step2)
          .commit();

        const runtimeContext = new RuntimeContext<{ life: number }>();
        runtimeContext.set('life', 42);

        const run = await workflow.createRunAsync();
        const result = await run.start({ inputData: { cool: 'test-input' }, runtimeContext });

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
      });

      it('should resolve dynamic mappings via .map()', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

        const run = await workflow.createRunAsync();
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
      });

      it('should resolve variables from previous steps', async () => {
        const step1Action = vi.fn<any>().mockResolvedValue({
          nested: { value: 'step1-data' },
        });
        const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success' });

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

        const run = await workflow.createRunAsync();
        await run.start({ inputData: {} });

        expect(step2Action).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: {
              previousValue: 'step1-data',
            },
          }),
        );
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

        const run = await workflow.createRunAsync();
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

        const run = await workflow.createRunAsync();
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

        const run = await workflow.createRunAsync();
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
      });

      it('should resolve constant values via .map()', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

        const run = await workflow.createRunAsync();
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
      });

      it('should resolve fully dynamic input via .map()', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

        const run = await workflow.createRunAsync();
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

        const run = await workflow.createRunAsync();
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
      });

      it('should handle failing dependencies', async () => {
        let err: Error | undefined;
        const step1Action = vi.fn<any>().mockImplementation(() => {
          err = new Error('Failed');
          throw err;
        });
        const step2Action = vi.fn<any>();

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

        const run = await workflow.createRunAsync();
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
        expect((step1Result as any)?.error).toMatch(/^Error: Failed/);
      });

      it('should support simple string conditions', async () => {
        const step1Action = vi.fn<any>().mockResolvedValue({ status: 'success' });
        const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
        const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });
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
              step: step3,
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

        const run = await workflow.createRunAsync();
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
      });

      it('should support custom condition functions', async () => {
        const step1Action = vi.fn<any>().mockResolvedValue({ count: 5 });
        const step2Action = vi.fn<any>();

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

        const run = await workflow.createRunAsync();
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
      });
    });

    it('should execute a a sleep step', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      const run = await workflow.createRunAsync();
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
    });

    it('should execute a sleep step with fn parameter', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ value: 1000 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { value: inputData.value + 1000 };
        },
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
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
        .sleep(async ({ inputData }) => {
          return inputData.value;
        })
        .then(step2)
        .commit();

      const run = await workflow.createRunAsync();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { value: 1000 },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toEqual({
        status: 'success',
        output: { value: 2000 },
        payload: { value: 1000 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThanOrEqual(900);
    });

    it('should execute a a sleep until step', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      const run = await workflow.createRunAsync();
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
    });

    it('should execute a sleep until step with fn parameter', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ value: 1000 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { value: inputData.value + 1000 };
        },
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
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
        .sleepUntil(async ({ inputData }) => {
          return new Date(Date.now() + inputData.value);
        })
        .then(step2)
        .commit();

      const run = await workflow.createRunAsync();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { value: 1000 },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toEqual({
        status: 'success',
        output: { value: 2000 },
        payload: { value: 1000 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThan(900);
    });

    it('should execute a waitForEvent step', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      workflow.then(step1).waitForEvent('hello-event', step2).commit();

      const run = await workflow.createRunAsync();
      const startTime = Date.now();
      setTimeout(() => {
        run.sendEvent('hello-event', { data: 'hello' });
      }, 1000);
      const result = await run.start({ inputData: {} });
      console.dir({ result }, { depth: null });
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
        output: { result: 'success', resumed: { data: 'hello' } },
        payload: { result: 'success' },
        resumePayload: { data: 'hello' },
        resumedAt: expect.any(Number),
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThan(900);
    });

    it('should execute a waitForEvent step after timeout', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      workflow.then(step1).waitForEvent('hello-event', step2, { timeout: 1000 }).commit();

      const run = await workflow.createRunAsync();
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
        status: 'failed',
        error: expect.any(Error),
        payload: { result: 'success' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThan(900);
    });

    it('should only update workflow status to success after all steps have run successfully', async () => {
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
        id: 'increment-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(incrementStep)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => {
              await new Promise(resolve => setTimeout(resolve, 6000));
              return { value: inputData.value };
            },
          }),
        )
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

      const run = await incrementWorkflow.createRunAsync();
      const { stream, getWorkflowState } = run.stream({ inputData: { value: 0 } });

      for await (const data of stream) {
        if (data.type === 'step-finish' && (data as any).payload.id === 'increment') {
          setTimeout(async () => {
            const currentExecResult = await incrementWorkflow.getWorkflowRunExecutionResult(run.runId);
            expect(currentExecResult?.status).toBe('running');
          }, 500);
        }
      }
      const finalResult = await getWorkflowState();
      expect(finalResult.status).toBe('success');
    });
  }, 10000); //we have a 5 second timeout for the final step in the workflow

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

      const run = await workflow.createRunAsync();
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

      const run = await workflow.createRunAsync();
      const p = run.start({ inputData: { value: 'test' } });

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

      const run = await workflow.createRunAsync();
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
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockImplementation(() => {
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

      const run = await workflow.createRunAsync();

      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed'); // Assert status first

      // Type guard for result.error
      if (result.status === 'failed') {
        // This check helps TypeScript narrow down the type of 'result'
        expect(result.error).toMatch(/^Error: Step execution failed/); // Now safe to access
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
      expect((step1Result as any)?.error).toMatch(/^Error: Step execution failed/); // Check message prefix
    });

    it('should handle variable resolution errors', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ data: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ data: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>(),
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

      const run = await workflow.createRunAsync();
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
            output: undefined,
            status: 'success',
            payload: {
              data: 'success',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
      });
    });

    it('should handle step execution errors within branches', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockRejectedValue(error);

      const successAction = vi.fn<any>().mockResolvedValue({});

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

      const run = await workflow.createRunAsync();
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
      expect((result.steps?.step2 as any)?.error).toMatch(/^Error: Step execution failed/);
    });

    it('should handle step execution errors within nested workflows', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockImplementation(() => {
        throw error;
      });

      const successAction = vi.fn<any>().mockResolvedValue({});

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

      const run = await mainWorkflow.createRunAsync();
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
      expect((result.steps?.['test-workflow'] as any)?.error).toMatch(/^Error: Error: Step execution failed/);
    });
  });

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });

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

      const run = await workflow.createRunAsync();
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
      });

      counterWorkflow
        .dountil(incrementStep, async ({ inputData }) => {
          return (inputData?.value ?? 0) >= 12;
        })
        .then(finalStep)
        .commit();

      const run = await counterWorkflow.createRunAsync();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.result).toEqual({ finalValue: 12 });
      // @ts-ignore
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
      });

      counterWorkflow
        .dowhile(incrementStep, async ({ inputData }) => {
          return (inputData?.value ?? 0) < 12;
        })
        .then(finalStep)
        .commit();

      const run = await counterWorkflow.createRunAsync();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.result).toEqual({ finalValue: 12 });
      // @ts-ignore
      expect(result.steps.increment.output).toEqual({ value: 12 });
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
      });

      counterWorkflow.foreach(mapStep).then(finalStep).commit();

      const run = await counterWorkflow.createRunAsync();
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
      });

      counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

      const run = await counterWorkflow.createRunAsync();
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
      });

      counterWorkflow.foreach(mapStep, { concurrency: 2 }).then(finalStep).commit();

      const run = await counterWorkflow.createRunAsync();
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

      const run = await counterWorkflow.createRunAsync();
      const result = await run.start({ inputData: { startValue: 1 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(0);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps.finalIf.output).toEqual({ finalValue: 2 });
      // @ts-ignore
      expect(result.steps.start.output).toEqual({ newValue: 2 });
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

      const run = await counterWorkflow.createRunAsync();
      const result = await run.start({ inputData: { startValue: 6 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['else-branch'].output).toEqual({ finalValue: 26 + 6 + 1 });
      // @ts-ignore
      expect(result.steps.start.output).toEqual({ newValue: 7 });
    });
  });

  describe('Schema Validation', () => {
    it.skip('should validate trigger data against schema', async () => {
      const triggerSchema = z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      });

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
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
        id: 'test-workflow',
        inputSchema: triggerSchema,
        outputSchema: z.object({}),
        steps: [step1],
      });

      workflow.then(step1).commit();

      // Should fail validation
      await expect(
        workflow.execute({
          inputData: {
            required: 'test',
            // @ts-expect-error
            nested: { value: 'not-a-number' },
          },
        }),
      ).rejects.toThrow();

      // Should pass validation
      const run = await workflow.createRunAsync();
      await run.start({
        inputData: {
          required: 'test',
          nested: { value: 42 },
        },
      });
    });
  });

  describe('multiple chains', () => {
    it('should run multiple chains in parallel', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success1' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success2' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step3 = createStep({
        id: 'step3',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success3' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step4 = createStep({
        id: 'step4',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success4' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step5 = createStep({
        id: 'step5',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success5' }),
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

      const run = await workflow.createRunAsync();
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
    });
  });

  describe('Retry', () => {
    it('should retry a step default 0 times', async () => {
      let err: Error | undefined;
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockImplementation(() => {
          err = new Error('Step failed');
          throw err;
        }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      new Mastra({
        logger: false,
        workflows: {
          'test-workflow': workflow,
        },
        storage: testStorage,
      });

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRunAsync();
      const step1Spy = vi.spyOn(step1, 'execute');
      const step2Spy = vi.spyOn(step2, 'execute');
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
      // ADD THIS SEPARATE ASSERTION
      expect((result.steps.step2 as any)?.error).toMatch(/^Error: Step failed/);
      expect(step1Spy).toHaveBeenCalledTimes(1);
      expect(step2Spy).toHaveBeenCalledTimes(1); // 0 retries + 1 initial call
    });

    it('should retry a step with a custom retry config', async () => {
      let err: Error | undefined;
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockImplementation(() => {
          err = new Error('Step failed');
          throw err;
        }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: { attempts: 5, delay: 200 },
      });

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: {
          'test-workflow': workflow,
        },
      });

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRunAsync();
      const step1Spy = vi.spyOn(step1, 'execute');
      const step2Spy = vi.spyOn(step2, 'execute');
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
      // ADD THIS SEPARATE ASSERTION
      expect((result.steps.step2 as any)?.error).toMatch(/^Error: Step failed/);
      expect(step1Spy).toHaveBeenCalledTimes(1);
      expect(step2Spy).toHaveBeenCalledTimes(6); // 5 retries + 1 initial call
    });
  });

  describe('Interoperability (Actions)', () => {
    it('should be able to use all action types in a workflow', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ name: 'step1' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ name: z.string() }),
      });

      // @ts-ignore
      const toolAction = vi.fn<any>().mockImplementation(async ({ context }) => {
        return { name: context.name };
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

      workflow.then(step1).then(createStep(randomTool)).commit();

      const run = await workflow.createRunAsync();
      const result = await run.start({ inputData: {} });

      expect(step1Action).toHaveBeenCalled();
      expect(toolAction).toHaveBeenCalled();
      // @ts-ignore
      expect(result.steps.step1).toEqual({
        status: 'success',
        output: { name: 'step1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // @ts-ignore
      expect(result.steps['random-tool']).toEqual({
        status: 'success',
        output: { name: 'step1' },
        payload: { name: 'step1' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });
  });

  describe('Watch', () => {
    it('should watch workflow state changes and call onTransition', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      let watchData: WatchEvent[] = [];
      const onTransition = data => {
        watchData.push(JSON.parse(JSON.stringify(data)));
      };

      const run = await workflow.createRunAsync();

      // Start watching the workflow
      run.watch(onTransition);

      const executionResult = await run.start({ inputData: {} });

      expect(watchData.length).toBe(5);
      expect(watchData[1]).toEqual({
        type: 'watch',
        payload: {
          currentStep: {
            id: 'step1',
            status: 'success',
            output: { result: 'success1' },
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          workflowState: {
            status: 'running',
            steps: {
              input: {},
              step1: {
                status: 'success',
                output: { result: 'success1' },
                payload: {},
                startedAt: expect.any(Number),
                endedAt: expect.any(Number),
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: expect.any(Number),
      });

      expect(watchData[watchData.length - 1]).toEqual({
        type: 'watch',
        payload: {
          currentStep: undefined,
          workflowState: {
            status: 'success',
            steps: {
              input: {},
              step1: {
                status: 'success',
                output: { result: 'success1' },
                payload: {},
                startedAt: expect.any(Number),
                endedAt: expect.any(Number),
              },
              step2: {
                status: 'success',
                output: { result: 'success2' },
                payload: { result: 'success1' },
                startedAt: expect.any(Number),
                endedAt: expect.any(Number),
              },
            },
            result: { result: 'success2' },
            error: null,
          },
        },
        eventTimestamp: expect.any(Number),
      });

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
        payload: { result: 'success1' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should watch workflow state changes and call onTransition when attaching from separate run', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      let watchData: WatchEvent[] = [];
      const onTransition = data => {
        watchData.push(JSON.parse(JSON.stringify(data)));
      };

      const run = await workflow.createRunAsync();
      const run2 = await workflow.createRunAsync({ runId: run.runId });

      // Start watching the workflow
      run2.watch(onTransition);

      const executionResult = await run.start({ inputData: {} });

      expect(watchData.length).toBe(5);
      expect(watchData[1]).toEqual({
        type: 'watch',
        payload: {
          currentStep: {
            id: 'step1',
            status: 'success',
            output: { result: 'success1' },
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          workflowState: {
            status: 'running',
            steps: {
              input: {},
              step1: {
                status: 'success',
                output: { result: 'success1' },
                payload: {},
                startedAt: expect.any(Number),
                endedAt: expect.any(Number),
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: expect.any(Number),
      });
      expect(watchData[watchData.length - 1]).toEqual({
        type: 'watch',
        payload: {
          currentStep: undefined,
          workflowState: {
            status: 'success',
            steps: {
              input: {},
              step1: {
                status: 'success',
                output: { result: 'success1' },
                payload: {},
                startedAt: expect.any(Number),
                endedAt: expect.any(Number),
              },
              step2: {
                status: 'success',
                output: { result: 'success2' },
                payload: { result: 'success1' },
                startedAt: expect.any(Number),
                endedAt: expect.any(Number),
              },
            },
            result: { result: 'success2' },
            error: null,
          },
        },
        eventTimestamp: expect.any(Number),
      });

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
        payload: { result: 'success1' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should unsubscribe from transitions when unwatch is called', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      const onTransition = vi.fn();
      const onTransition2 = vi.fn();

      const run = await workflow.createRunAsync();

      run.watch(onTransition);
      run.watch(onTransition2);

      await run.start({ inputData: {} });

      expect(onTransition).toHaveBeenCalledTimes(5);
      expect(onTransition2).toHaveBeenCalledTimes(5);

      const run2 = await workflow.createRunAsync();

      run2.watch(onTransition2);

      await run2.start({ inputData: {} });

      expect(onTransition).toHaveBeenCalledTimes(5);
      expect(onTransition2).toHaveBeenCalledTimes(10);

      const run3 = await workflow.createRunAsync();

      run3.watch(onTransition);

      await run3.start({ inputData: {} });

      expect(onTransition).toHaveBeenCalledTimes(10);
      expect(onTransition2).toHaveBeenCalledTimes(10);
    });

    it('should be able to use all action types in a workflow', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ name: 'step1' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ name: z.string() }),
      });

      // @ts-ignore
      const toolAction = vi.fn<any>().mockImplementation(async ({ context }) => {
        console.log('tool call context', context);
        return { name: context.name };
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

      workflow.then(step1).then(createStep(randomTool)).commit();

      const { stream, getWorkflowState } = (await workflow.createRunAsync()).stream({ inputData: {} });

      const values: StreamEvent[] = [];
      for await (const value of stream.values()) {
        values.push(value);
      }

      expect(values).toMatchObject([
        {
          payload: {
            runId: 'mock-uuid-1',
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
            endedAt: expect.any(Number),
            output: {
              name: 'step1',
            },
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
            id: 'random-tool',
            payload: {
              name: 'step1',
            },
            startedAt: expect.any(Number),
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'random-tool',
            endedAt: expect.any(Number),
            output: {
              name: 'step1',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: 'random-tool',
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            runId: 'mock-uuid-1',
          },
          type: 'finish',
        },
      ]);

      const result = await getWorkflowState();

      expect(step1Action).toHaveBeenCalled();
      expect(toolAction).toHaveBeenCalled();
      expect(result.steps.step1).toEqual({
        status: 'success',
        output: { name: 'step1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps['random-tool']).toEqual({
        status: 'success',
        output: { name: 'step1' },
        payload: { name: 'step1' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
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
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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
      const run = await workflow.createRunAsync();
      const run2 = await workflow.createRunAsync({ runId: run.runId });

      expect(run.runId).toBeDefined();
      expect(run2.runId).toBeDefined();
      expect(run.runId).toBe(run2.runId);
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

      // Create a new storage instance for initial run
      const initialStorage = new MockStore();

      new Mastra({
        logger: false,
        storage: initialStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRunAsync();

      // Create a promise to track when the workflow is ready to resume
      let resolveWorkflowSuspended: (value: unknown) => void;
      const workflowSuspended = new Promise(resolve => {
        resolveWorkflowSuspended = resolve;
      });

      run.watch(data => {
        const isPromptAgentSuspended =
          data?.payload?.currentStep?.id === 'promptAgent' && data?.payload?.currentStep?.status === 'suspended';
        if (isPromptAgentSuspended) {
          resolveWorkflowSuspended({ stepId: 'promptAgent', context: { userInput: 'test input for resumption' } });
        }
      });

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      // Wait for the workflow to be ready to resume
      const resumeData = await workflowSuspended;
      const resumeResult = await run.resume({ resumeData: resumeData as any, step: promptAgent });

      if (!resumeResult) {
        throw new Error('Resume failed to return a result');
      }

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
          resumePayload: { context: { userInput: 'test input for resumption' }, stepId: 'promptAgent' },
          resumedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
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
    });

    it('should handle parallel steps with conditional suspend', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockResolvedValue({ modelOutput: 'test output' });
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const humanInterventionAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend, resumeData }) => {
          if (!resumeData?.humanPrompt) {
            return suspend();
          }
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'human intervention output' }));
      const explainResponseAction = vi.fn().mockResolvedValue({
        improvedOutput: 'explanation output',
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
      const humanIntervention = createStep({
        id: 'humanIntervention',
        execute: humanInterventionAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const explainResponse = createStep({
        id: 'explainResponse',
        execute: explainResponseAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [getUserInput, promptAgent, evaluateTone, humanIntervention, explainResponse],
      });

      workflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .branch([
          [() => Promise.resolve(true), humanIntervention],
          [() => Promise.resolve(false), explainResponse],
        ])
        .commit();

      new Mastra({
        logger: false,
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
      });

      const run = await workflow.createRunAsync();

      // Create a promise to track when the workflow is ready to resume
      let resolveWorkflowSuspended: (value: unknown) => void;
      const workflowSuspended = new Promise(resolve => {
        resolveWorkflowSuspended = resolve;
      });

      run.watch(async data => {
        const suspended =
          data.payload?.currentStep?.id === 'humanIntervention' && data.payload?.currentStep?.status === 'suspended';
        if (suspended) {
          resolveWorkflowSuspended({
            humanPrompt: 'What improvements would you suggest?',
          });
        }
      });

      const initialResult = await run.start({ inputData: { input: 'test' } });

      expect(initialResult.steps.humanIntervention.status).toBe('suspended');
      expect(initialResult.steps.explainResponse).toBeUndefined();
      expect(getUserInputAction).toHaveBeenCalledTimes(1);
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(evaluateToneAction).toHaveBeenCalledTimes(1);
      expect(humanInterventionAction).toHaveBeenCalledTimes(1);
      expect(explainResponseAction).not.toHaveBeenCalled();

      // Wait for the workflow to be ready to resume
      const resumeData = await workflowSuspended;
      const run2 = await workflow.createRunAsync({ runId: run.runId });
      const resumeResult = await run2.resume({ resumeData: resumeData as any, step: humanIntervention });

      if (!resumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(getUserInputAction).toHaveBeenCalledTimes(1);
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(evaluateToneAction).toHaveBeenCalledTimes(1);
      expect(humanInterventionAction).toHaveBeenCalledTimes(2);

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
        },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        humanIntervention: {
          status: 'success',
          output: { improvedOutput: 'human intervention output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          resumePayload: { humanPrompt: 'What improvements would you suggest?' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });
    });

    it('should handle complex workflow with multiple suspends', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockResolvedValue({ modelOutput: 'test output' });

      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });
      const humanInterventionAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
        })
        .mockImplementationOnce(({ resumeData }) => {
          console.log('resumeData', resumeData);
          return { improvedOutput: 'human intervention output' };
        });
      const explainResponseAction = vi.fn().mockResolvedValue({
        improvedOutput: 'explanation output',
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
      const humanIntervention = createStep({
        id: 'humanIntervention',
        execute: humanInterventionAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const explainResponse = createStep({
        id: 'explainResponse',
        execute: explainResponseAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [
          getUserInput,
          promptAgent,
          evaluateTone,
          improveResponse,
          evaluateImproved,
          humanIntervention,
          explainResponse,
        ],
      });

      workflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .map({
          toneScore: {
            step: evaluateTone,
            path: 'toneScore',
          },
          completenessScore: {
            step: evaluateTone,
            path: 'completenessScore',
          },
        })
        .parallel([humanIntervention, explainResponse])
        .commit();

      new Mastra({
        logger: false,
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
      });

      const run = await workflow.createRunAsync();
      const started = run.start({ inputData: { input: 'test' } });
      let improvedResponseResultPromise: Promise<any | undefined>;

      const resultPromise = new Promise<any>((resolve, reject) => {
        let hasResumed = false;
        let hasResumedImproveResponse = false;
        run.watch(async data => {
          const state = data.payload?.workflowState;

          if (state.status !== 'suspended') {
            return;
          }

          const isHumanInterventionSuspended = state.steps?.humanIntervention?.status === 'suspended';
          const isImproveResponseSuspended = state.steps?.improveResponse?.status === 'suspended';

          if (isHumanInterventionSuspended) {
            if (!hasResumed) {
              hasResumed = true;

              try {
                const resumed = await run.resume({
                  step: humanIntervention,
                  resumeData: {
                    humanPrompt: 'What improvements would you suggest?',
                  },
                });
                resolve(resumed as any);
              } catch (error) {
                reject(error);
              }
            }
          } else if (isImproveResponseSuspended) {
            if (!hasResumedImproveResponse) {
              hasResumedImproveResponse = true;
              const resumed = run.resume({
                step: improveResponse,
                resumeData: {
                  ...data.payload.workflowState.steps,
                },
              });
              improvedResponseResultPromise = resumed;
            }
          }
        });
      });

      const result = await resultPromise;
      const initialResult = await started;
      expect(initialResult?.steps.improveResponse.status).toBe('suspended');
      // @ts-ignore
      const improvedResponseResult = await improvedResponseResultPromise;

      expect(improvedResponseResult?.steps.humanIntervention.status).toBe('suspended');
      expect(improvedResponseResult?.steps.improveResponse.status).toBe('success');
      expect(improvedResponseResult?.steps.evaluateImprovedResponse.status).toBe('success');

      if (!result) {
        throw new Error('Resume failed to return a result');
      }

      expect(humanInterventionAction).toHaveBeenCalledTimes(2);
      expect(explainResponseAction).toHaveBeenCalledTimes(1);

      expect(result.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
        },
        humanIntervention: { status: 'success', output: { improvedOutput: 'human intervention output' } },
      });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRunAsync();

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
          suspendPayload: { testPayload: 'hello' },
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
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
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
    });

    it('should work with runtimeContext - bug #4442', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockImplementation(async ({ suspend, runtimeContext, resumeData }) => {
        if (!resumeData) {
          runtimeContext.set('responses', [...(runtimeContext.get('responses') ?? []), 'first message']);
          return await suspend({ testPayload: 'hello' });
        }

        runtimeContext.set('responses', [...(runtimeContext.get('responses') ?? []), 'promptAgentAction']);

        return undefined;
      });
      const runtimeContextAction = vi.fn().mockImplementation(async ({ runtimeContext }) => {
        return runtimeContext.get('responses');
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
      const runtimeContextStep = createStep({
        id: 'runtimeContextAction',
        execute: runtimeContextAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.array(z.string()),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow.then(getUserInput).then(promptAgent).then(runtimeContextStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRunAsync();

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const newCtx = {
        userInput: 'test input for resumption',
      };

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      expect(firstResumeResult.steps.runtimeContextAction.status).toBe('success');
      // @ts-ignore
      expect(firstResumeResult.steps.runtimeContextAction.output).toEqual(['first message', 'promptAgentAction']);
    });

    it('should work with custom runtimeContext - bug #4442', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockImplementation(async ({ suspend, runtimeContext, resumeData }) => {
        if (!resumeData) {
          runtimeContext.set('responses', [...(runtimeContext.get('responses') ?? []), 'first message']);
          return await suspend({ testPayload: 'hello' });
        }

        runtimeContext.set('responses', [...(runtimeContext.get('responses') ?? []), 'promptAgentAction']);

        return undefined;
      });
      const runtimeContextAction = vi.fn().mockImplementation(async ({ runtimeContext }) => {
        return runtimeContext.get('responses');
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
      const runtimeContextStep = createStep({
        id: 'runtimeContextAction',
        execute: runtimeContextAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.array(z.string()),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow.then(getUserInput).then(promptAgent).then(runtimeContextStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRunAsync();

      const runtimeContext = new RuntimeContext();
      const initialResult = await run.start({ inputData: { input: 'test' }, runtimeContext });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(runtimeContext.get('responses')).toEqual(['first message']);

      const newCtx = {
        userInput: 'test input for resumption',
      };

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx, runtimeContext });
      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      expect(firstResumeResult.steps.runtimeContextAction.status).toBe('success');
      // @ts-ignore
      expect(firstResumeResult.steps.runtimeContextAction.output).toEqual(['first message', 'promptAgentAction']);
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { dowhileWorkflow },
      });

      const run = await dowhileWorkflow.createRunAsync();
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
    });

    it('should handle basic suspend and resume in nested dountil workflow - bug #5650', async () => {
      let incrementLoopValue = 2;
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        execute: async ({ inputData, runtimeContext, getInitData }) => {
          const shouldNotExist = runtimeContext?.get('__mastraWorflowInputData');
          expect(shouldNotExist).toBeUndefined();
          const initData = getInitData();

          expect(initData.value).toBe(incrementLoopValue);
          incrementLoopValue = inputData.value; // we expect the input of the nested workflow to be updated with the output of this step - inputData.value
          return { value: inputData.value };
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
        resumeSchema: z.object({
          amountToIncrementBy: z.number(),
        }),
        suspendSchema: z.object({
          optionsToIncrementBy: z.array(z.number()),
        }),
        execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
          const shouldNotExist = runtimeContext?.get('__mastraWorflowInputData');
          expect(shouldNotExist).toBeUndefined();
          if (!resumeData?.amountToIncrementBy) {
            return suspend({ optionsToIncrementBy: [1, 2, 3] });
          }

          const result = inputData.value + resumeData.amountToIncrementBy;

          return { value: result };
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
          async ({ inputData }) => {
            return inputData.value >= 10;
          },
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { dowhileWorkflow },
      });

      const run = await dowhileWorkflow.createRunAsync();
      const result = await run.start({ inputData: { value: 2 } });
      expect(result.steps['simple-resume-workflow']).toMatchObject({
        status: 'suspended',
      });

      const resumeResult = await run.resume({
        resumeData: { amountToIncrementBy: 2 },
        step: ['simple-resume-workflow', 'increment'],
      });

      // After resume with increment of 2, value becomes 4
      // Since 4 < 10, the loop continues and the nested workflow suspends again
      expect(resumeResult.steps['simple-resume-workflow']).toMatchObject({
        status: 'suspended',
      });
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
        id: 'increment-workflow',
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

      const run = await incrementWorkflow.createRunAsync();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('success');

      try {
        await run.resume({
          resumeData: { value: 2 },
          step: ['increment'],
        });
      } catch (error) {
        const errMessage = (error as { message: string })?.message;
        expect(errMessage).toBe('This workflow run was not suspended');
      }
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
        id: 'increment-workflow',
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

      const run = await incrementWorkflow.createRunAsync();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      try {
        await run.resume({
          resumeData: { value: 2 },
          step: ['increment'],
        });
      } catch (error) {
        const errMessage = (error as { message: string })?.message;
        expect(errMessage).toBe('This workflow step was not suspended');
      }

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
    });
  });

  describe('Workflow Runs', () => {
    let testStorage: MockStore;

    beforeEach(async () => {
      testStorage = new MockStore();
    });

    it('should return empty result when mastra is not initialized', async () => {
      const workflow = createWorkflow({ id: 'test', inputSchema: z.object({}), outputSchema: z.object({}) });
      const result = await workflow.getWorkflowRuns();
      expect(result).toEqual({ runs: [], total: 0 });
    });

    it('should get workflow runs from storage', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      new Mastra({
        workflows: {
          'test-workflow': workflow,
        },
        logger: false,
        storage: testStorage,
      });

      // Create a few runs
      const run1 = await workflow.createRunAsync();
      await run1.start({ inputData: {} });

      const run2 = await workflow.createRunAsync();
      await run2.start({ inputData: {} });

      const { runs, total } = await workflow.getWorkflowRuns();
      expect(total).toBe(2);
      expect(runs).toHaveLength(2);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId, run2.runId]));
      expect(runs[0]?.workflowName).toBe('test-workflow');
      expect(runs[0]?.snapshot).toBeDefined();
      expect(runs[1]?.snapshot).toBeDefined();
    });

    it('should get workflow run by id from storage', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: {
          'test-workflow': workflow,
        },
      });

      // Create a few runs
      const run1 = await workflow.createRunAsync();
      await run1.start({ inputData: {} });

      const { runs, total } = await workflow.getWorkflowRuns();
      expect(total).toBe(1);
      expect(runs).toHaveLength(1);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId]));
      expect(runs[0]?.workflowName).toBe('test-workflow');
      expect(runs[0]?.snapshot).toBeDefined();

      const run3 = await workflow.getWorkflowRunById(run1.runId);
      expect(run3?.runId).toBe(run1.runId);
      expect(run3?.workflowName).toBe('test-workflow');
      expect(run3?.snapshot).toEqual(runs[0].snapshot);
    });
  });

  describe('Accessing Mastra', () => {
    it('should be able to access the deprecated mastra primitives', async () => {
      let telemetry: Telemetry | undefined;
      const step1 = createStep({
        id: 'step1',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ mastra }) => {
          telemetry = mastra?.getTelemetry();
          return {};
        },
      });

      const workflow = createWorkflow({ id: 'test-workflow', inputSchema: z.object({}), outputSchema: z.object({}) });
      workflow.then(step1).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
      });

      // Access new instance properties directly - should work without warning
      const run = await workflow.createRunAsync();
      await run.start({ inputData: {} });

      expect(telemetry).toBeDefined();
      expect(telemetry).toBeInstanceOf(Telemetry);
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

      new Mastra({
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        logger: false,
        storage: testStorage,
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

      const run = await workflow.createRunAsync();
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
    });

    it('should be able to use an agent in parallel', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
      });

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

      const run = workflow.createRun();
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
      });
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
              const result = await agent.generate([{ role: 'user', content: inputData.prompt }]);
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
              const result = await agent.generate([{ role: 'user', content: inputData.prompt }]);
              return { text: result.text };
            },
          }),
        )

        .commit();

      const run = workflow.createRun();
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
      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': workflow },
        agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
      });

      const agentStep = createStep({
        id: 'agent-step',
        inputSchema: z.object({ agentName: z.string(), prompt: z.string() }),
        outputSchema: z.object({ text: z.string() }),
        execute: async ({ inputData, mastra }) => {
          const agent = mastra.getAgent(inputData.agentName);
          const result = await agent.generate([{ role: 'user', content: inputData.prompt }]);
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

      const run = workflow.createRun();
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
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
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

      const run = counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['nested-workflow-a'].output).toEqual({
        finalValue: 26 + 1,
      });

      // @ts-ignore
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
      const last = vi.fn().mockImplementation(async ({ inputData }) => {
        console.log('inputData', inputData);
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
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
      })
        .then(startStep)
        .then(cloneStep(otherStep, { id: 'other-clone' }))
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
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

      const run = counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['nested-workflow-a-clone'].output).toEqual({
        finalValue: 26 + 1,
      });

      // @ts-ignore
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
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: finalStep.outputSchema,
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ other: otherStep.outputSchema, final: finalStep.outputSchema }),
      })
        .then(startStep)
        .branch([
          [async () => false, otherStep],
          // @ts-ignore
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

      const run = counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['nested-workflow-a'].output).toEqual({
        finalValue: 26 + 1,
      });

      // @ts-ignore
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
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
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

        const run = counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);
        // @ts-ignore
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
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
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

        const run = counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(0);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-ignore
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
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
        })
          .then(startStep)
          .branch([
            [
              async () => true,
              createWorkflow({
                id: 'nested-workflow-c',
                inputSchema: startStep.outputSchema,
                outputSchema: otherStep.outputSchema,
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

        const run = counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 1 } });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-ignore
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
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
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

        new Mastra({
          logger: false,
          storage: testStorage,
          workflows: { counterWorkflow },
        });

        const run = counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });
        expect(begin).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(0);
        expect(last).toHaveBeenCalledTimes(0);
        expect(result.steps['nested-workflow-a']).toMatchObject({
          status: 'suspended',
        });

        // @ts-ignore
        expect(result.steps['last-step']).toEqual(undefined);

        const resumedResults = await run.resume({ step: [wfA, otherStep], resumeData: { newValue: 0 } });

        // @ts-ignore
        expect(resumedResults.steps['nested-workflow-a'].output).toEqual({
          finalValue: 26 + 1,
        });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(2);
        expect(final).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);
      });

      it('should handle consecutive nested workflows with suspend/resume', async () => {
        const step1 = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
          if (!resumeData?.suspect) {
            return await suspend({ message: 'What is the suspect?' });
          }
          return { suspect: resumeData.suspect };
        });
        const step1Definition = createStep({
          id: 'step-1',
          inputSchema: z.object({ suspect: z.string() }),
          outputSchema: z.object({ suspect: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ suspect: z.string() }),
          execute: step1,
        });

        const step2 = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
          if (!resumeData?.suspect) {
            return await suspend({ message: 'What is the second suspect?' });
          }
          return { suspect: resumeData.suspect };
        });
        const step2Definition = createStep({
          id: 'step-2',
          inputSchema: z.object({ suspect: z.string() }),
          outputSchema: z.object({ suspect: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ suspect: z.string() }),
          execute: step2,
        });

        const subWorkflow1 = createWorkflow({
          id: 'sub-workflow-1',
          inputSchema: z.object({ suspect: z.string() }),
          outputSchema: z.object({ suspect: z.string() }),
        })
          .then(step1Definition)
          .commit();

        const subWorkflow2 = createWorkflow({
          id: 'sub-workflow-2',
          inputSchema: z.object({ suspect: z.string() }),
          outputSchema: z.object({ suspect: z.string() }),
        })
          .then(step2Definition)
          .commit();

        const mainWorkflow = createWorkflow({
          id: 'main-workflow',
          inputSchema: z.object({ suspect: z.string() }),
          outputSchema: z.object({ suspect: z.string() }),
        })
          .then(subWorkflow1)
          .then(subWorkflow2)
          .commit();

        new Mastra({
          logger: false,
          storage: testStorage,
          workflows: { mainWorkflow },
        });

        const run = mainWorkflow.createRun();

        const initialResult = await run.start({ inputData: { suspect: 'initial-suspect' } });

        expect(step1).toHaveBeenCalledTimes(1);
        expect(step2).toHaveBeenCalledTimes(0);
        expect(initialResult.status).toBe('suspended');
        expect(initialResult.steps['sub-workflow-1']).toMatchObject({
          status: 'suspended',
        });

        const firstResumeResult = await run.resume({
          step: ['sub-workflow-1', 'step-1'],
          resumeData: { suspect: 'first-suspect' },
        });

        expect(step1).toHaveBeenCalledTimes(2);
        expect(step2).toHaveBeenCalledTimes(1);
        expect(firstResumeResult.status).toBe('suspended');
        expect(firstResumeResult.steps['sub-workflow-1']).toMatchObject({
          status: 'success',
        });
        expect(firstResumeResult.steps['sub-workflow-2']).toMatchObject({
          status: 'suspended',
        });

        const secondResumeResult = await run.resume({
          step: ['sub-workflow-2', 'step-2'],
          resumeData: { suspect: 'second-suspect' },
        });

        expect(step1).toHaveBeenCalledTimes(2);
        expect(step2).toHaveBeenCalledTimes(2);
        expect(secondResumeResult.status).toBe('success');
        expect(secondResumeResult.steps['sub-workflow-1']).toMatchObject({
          status: 'success',
        });
        expect(secondResumeResult.steps['sub-workflow-2']).toMatchObject({
          status: 'success',
        });
        expect((secondResumeResult as any).result).toEqual({ suspect: 'second-suspect' });
      });

      it('should preserve runtime context in nested workflows after suspend/resume', async () => {
        const testStorage = new MockStore();

        // Step that sets runtime context data
        const setupStep = createStep({
          id: 'setup-step',
          inputSchema: z.object({}),
          outputSchema: z.object({
            setup: z.boolean(),
          }),
          execute: async ({ runtimeContext }) => {
            runtimeContext.set('test-key', 'test-context-value');
            return { setup: true };
          },
        });

        // Suspend step
        const suspendStep = createStep({
          id: 'suspend-step',
          inputSchema: z.object({
            setup: z.boolean(),
          }),
          outputSchema: z.object({
            resumed: z.boolean(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            confirmed: z.boolean(),
          }),
          execute: async ({ resumeData, suspend, runtimeContext }) => {
            // Verify runtime context is still available during suspend
            expect(runtimeContext.get('test-key')).toBe('test-context-value');

            if (!resumeData?.confirmed) {
              return await suspend({ message: 'Workflow suspended for testing' });
            }
            return { resumed: true };
          },
        });

        // Step in nested workflow that verifies runtime context access
        const verifyContextStep = createStep({
          id: 'verify-context-step',
          inputSchema: z.object({
            resumed: z.boolean(),
          }),
          outputSchema: z.object({
            success: z.boolean(),
            hasTestData: z.boolean(),
          }),
          execute: async ({ runtimeContext, mastra, getInitData, inputData }) => {
            // Verify all context is available in nested workflow after suspend/resume
            const testData = runtimeContext.get('test-key');
            const initData = getInitData();

            expect(testData).toBe('test-context-value');
            expect(mastra).toBeDefined();
            expect(runtimeContext).toBeDefined();
            expect(inputData).toEqual({ resumed: true });
            expect(initData).toEqual({ resumed: true });

            return { success: true, hasTestData: !!testData };
          },
        });

        // Nested workflow that runs after suspend/resume
        const nestedWorkflow = createWorkflow({
          id: 'nested-workflow-after-suspend',
          inputSchema: z.object({
            resumed: z.boolean(),
          }),
          outputSchema: z.object({
            success: z.boolean(),
            hasTestData: z.boolean(),
          }),
        })
          .then(verifyContextStep)
          .commit();

        // Main workflow
        const mainWorkflow = createWorkflow({
          id: 'main-workflow-with-suspend',
          inputSchema: z.object({}),
          outputSchema: z.object({
            success: z.boolean(),
            hasTestData: z.boolean(),
          }),
        })
          .then(setupStep)
          .then(suspendStep)
          .then(nestedWorkflow)
          .commit();

        // Initialize Mastra with storage for suspend/resume
        new Mastra({
          logger: false,
          storage: testStorage,
          workflows: { mainWorkflow, nestedWorkflow },
        });

        const run = mainWorkflow.createRun();

        // Start workflow (should suspend)
        const suspendResult = await run.start({ inputData: {} });
        expect(suspendResult.status).toBe('suspended');

        // Resume workflow
        const resumeResult = await run.resume({
          step: 'suspend-step',
          resumeData: { confirmed: true },
        });

        expect(resumeResult.status).toBe('success');
        if (resumeResult.status === 'success') {
          expect(resumeResult.result.success).toBe(true);
          expect(resumeResult.result.hasTestData).toBe(true);
        }
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

        const run = counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });
        const results = result.steps;

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-ignore
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

      const passthroughStep = createStep({
        id: 'passthrough',
        inputSchema: counterInputSchema,
        outputSchema: counterInputSchema,
        execute: vi.fn().mockImplementation(async ({ inputData }) => {
          return inputData;
        }),
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();

      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
      })
        .then(passthroughStep)
        .then(wfA)
        .commit();

      const wfC = createWorkflow({
        id: 'nested-workflow-c',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
      })
        .then(passthroughStep)
        .then(wfB)
        .commit();

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: counterInputSchema,
        outputSchema: counterOutputSchema,
        steps: [wfC, passthroughStep],
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = counterWorkflow.createRun();
      const passthroughSpy = vi.spyOn(passthroughStep, 'execute');
      const result = await run.start({ inputData: { startValue: 0 } });
      expect(passthroughSpy).toHaveBeenCalledTimes(2);
      expect(result.steps['nested-workflow-c']).toMatchObject({
        status: 'suspended',
        suspendPayload: {
          __workflow_meta: {
            path: ['nested-workflow-b', 'nested-workflow-a', 'other'],
          },
        },
      });

      // @ts-ignore
      expect(result.steps['last-step']).toEqual(undefined);

      if (result.status !== 'suspended') {
        expect.fail('Workflow should be suspended');
      }
      expect(result.suspended[0]).toEqual(['nested-workflow-c', 'nested-workflow-b', 'nested-workflow-a', 'other']);
      const resumedResults = await run.resume({ step: result.suspended[0], resumeData: { newValue: 0 } });

      // @ts-ignore
      expect(resumedResults.steps['nested-workflow-c'].output).toEqual({
        finalValue: 26 + 1,
      });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(2);
      expect(final).toHaveBeenCalledTimes(1);
      expect(last).toHaveBeenCalledTimes(1);
      expect(passthroughSpy).toHaveBeenCalledTimes(2);
    });

    it('should not execute incorrect branches after resuming from suspended nested workflow', async () => {
      const testStorage = new MockStore();

      // Mock functions to track execution
      const fetchItemsAction = vi.fn().mockResolvedValue([
        { id: '1', name: 'Item 1', type: 'first' },
        { id: '2', name: 'Item 2', type: 'second' },
        { id: '3', name: 'Item 3', type: 'third' },
      ]);

      const selectItemAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
        if (!resumeData) {
          return await suspend({ message: 'Select an item' });
        }
        return resumeData;
      });

      const firstItemAction = vi.fn().mockResolvedValue({ processed: 'first' });
      const thirdItemAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
        if (!resumeData) {
          return await suspend({ message: 'Select date for third item' });
        }
        return { processed: 'third', date: resumeData };
      });

      const secondItemDateAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
        if (!resumeData) {
          return await suspend({ message: 'Select date for second item' });
        }
        return { processed: 'second', date: resumeData };
      });

      const finalProcessingAction = vi.fn().mockImplementation(async ({ inputData }) => {
        return { result: 'processed', input: inputData };
      });

      const fetchItems = createStep({
        id: 'fetch-items',
        inputSchema: z.object({}),
        outputSchema: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
        execute: fetchItemsAction,
      });

      const selectItem = createStep({
        id: 'select-item',
        inputSchema: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
        outputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
        execute: selectItemAction,
      });

      const firstItemStep = createStep({
        id: 'first-item-step',
        inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
        outputSchema: z.object({ processed: z.string() }),
        execute: firstItemAction,
      });

      const thirdItemStep = createStep({
        id: 'third-item-step',
        inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
        outputSchema: z.object({ processed: z.string(), date: z.date() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.date(),
        execute: thirdItemAction,
      });

      const secondItemDateStep = createStep({
        id: 'second-item-date-step',
        inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
        outputSchema: z.object({ processed: z.string(), date: z.date() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.date(),
        execute: secondItemDateAction,
      });

      const finalProcessingStep = createStep({
        id: 'final-processing',
        inputSchema: z.object({
          processed: z.string(),
          date: z.date().optional(),
        }),
        outputSchema: z.object({ result: z.string(), input: z.any() }),
        execute: finalProcessingAction,
      });

      // Create nested workflow for second item
      const secondItemWorkflow = createWorkflow({
        id: 'second-item-workflow',
        inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
        outputSchema: z.object({ processed: z.string(), date: z.date() }),
      })
        .then(secondItemDateStep)
        .commit();

      // Create main workflow with conditional branching
      const mainWorkflow = createWorkflow({
        id: 'main-workflow-branch-bug',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), input: z.any() }),
      })
        .then(fetchItems)
        .then(selectItem)
        .branch([
          [async ({ inputData }) => inputData.type === 'first', firstItemStep],
          [async ({ inputData }) => inputData.type === 'second', secondItemWorkflow],
          [async ({ inputData }) => inputData.type === 'third', thirdItemStep],
        ])
        .map(async ({ inputData }) => {
          // This map step simulates the original issue (#6212) where results from ALL branches
          // are processed instead of just the correct one
          if (inputData['first-item-step']) {
            return inputData['first-item-step'];
          } else if (inputData['second-item-workflow']) {
            return inputData['second-item-workflow'];
          } else if (inputData['third-item-step']) {
            return inputData['third-item-step'];
          }
          throw new Error('No valid branch result found');
        })
        .then(finalProcessingStep)
        .commit();

      // Initialize Mastra with storage
      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { mainWorkflow, secondItemWorkflow },
      });

      const run = await mainWorkflow.createRunAsync();

      // Start workflow - should suspend at select-item
      const initialResult = await run.start({ inputData: {} });
      expect(initialResult.status).toBe('suspended');
      expect(selectItemAction).toHaveBeenCalledTimes(1);

      if (initialResult.status !== 'suspended') {
        expect.fail('Expected workflow to be suspended');
      }

      // Resume with "second" item selection
      const resumedResult = await run.resume({
        step: initialResult.suspended[0],
        resumeData: { id: '2', name: 'Item 2', type: 'second' },
      });

      expect(resumedResult.status).toBe('suspended');
      expect(selectItemAction).toHaveBeenCalledTimes(2);
      expect(secondItemDateAction).toHaveBeenCalledTimes(1);

      if (resumedResult.status !== 'suspended') {
        expect.fail('Expected workflow to be suspended');
      }

      // Resume with date for second item
      const finalResult = await run.resume({
        step: resumedResult.suspended[0],
        resumeData: new Date('2024-12-31'),
      });

      expect(finalResult.status).toBe('success');
      expect(secondItemDateAction).toHaveBeenCalledTimes(2);

      // BUG CHECK: Only the second workflow should have executed
      // The first and third item steps should NOT have been called
      expect(firstItemAction).not.toHaveBeenCalled();
      expect(thirdItemAction).not.toHaveBeenCalled();

      // Only the correct steps should be present in the result
      expect(finalResult.steps['first-item-step']).toBeUndefined();
      expect(finalResult.steps['third-item-step']).toBeUndefined();
      expect(finalResult.steps['second-item-workflow']).toBeDefined();
      expect(finalResult.steps['second-item-workflow'].status).toBe('success');

      // The final processing step should have been called exactly once
      expect(finalProcessingAction).toHaveBeenCalledTimes(1);

      // The final processing should only receive the result from the second workflow
      const finalProcessingCall = finalProcessingAction.mock.calls[0][0];
      expect(finalProcessingCall.inputData).toEqual({
        processed: 'second',
        date: new Date('2024-12-31'),
      });
    });
  });

  describe('Dependency Injection', () => {
    it('should inject runtimeContext dependencies into steps during run', async () => {
      const runtimeContext = new RuntimeContext();
      const testValue = 'test-dependency';
      runtimeContext.set('testKey', testValue);

      const step = createStep({
        id: 'step1',
        execute: async ({ runtimeContext }) => {
          const value = runtimeContext.get('testKey');
          return { injectedValue: value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const workflow = createWorkflow({ id: 'test-workflow', inputSchema: z.object({}), outputSchema: z.object({}) });
      workflow.then(step).commit();

      const run = workflow.createRun();
      const result = await run.start({ runtimeContext });

      // @ts-ignore
      expect(result.steps.step1.output.injectedValue).toBe(testValue);
    });

    it('should inject runtimeContext dependencies into steps during resume', async () => {
      const initialStorage = new MockStore();

      const runtimeContext = new RuntimeContext();
      const testValue = 'test-dependency';
      runtimeContext.set('testKey', testValue);

      const mastra = new Mastra({
        logger: false,
        storage: initialStorage,
      });

      const execute = vi.fn(async ({ runtimeContext, suspend, resumeData }) => {
        if (!resumeData?.human) {
          return await suspend();
        }

        const value = runtimeContext.get('testKey');
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
        mastra,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      workflow.then(step).commit();

      const run = workflow.createRun();
      await run.start({ runtimeContext });

      const resumeruntimeContext = new RuntimeContext();
      resumeruntimeContext.set('testKey', testValue + '2');

      const result = await run.resume({
        step: step,
        resumeData: {
          human: true,
        },
        runtimeContext: resumeruntimeContext,
      });

      // @ts-ignore
      expect(result?.steps.step1.output.injectedValue).toBe(testValue + '2');
    });

    it('should have access to runtimeContext from before suspension during workflow resume', async () => {
      const testValue = 'test-dependency';
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({
              message: `Please provide additional information. now value is ${inputData.value}`,
            });
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
        execute: async ({ inputData, runtimeContext }) => {
          runtimeContext.set('testKey', testValue);
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow',
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
            execute: async ({ inputData, runtimeContext }) => {
              const testKey = runtimeContext.get('testKey');
              expect(testKey).toBe(testValue);
              return { value: inputData.value };
            },
          }),
        )
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

      const run = await incrementWorkflow.createRunAsync();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
    });

    it('should not show removed runtimeContext values in subsequent steps', async () => {
      const testValue = 'test-dependency';
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({
              message: `Please provide additional information. now value is ${inputData.value}`,
            });
          }

          const testKey = runtimeContext.get('testKey');
          expect(testKey).toBe(testValue);

          runtimeContext.delete('testKey');

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
        execute: async ({ inputData, runtimeContext }) => {
          runtimeContext.set('testKey', testValue);
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow',
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
            execute: async ({ inputData, runtimeContext }) => {
              const testKey = runtimeContext.get('testKey');
              expect(testKey).toBeUndefined();
              return { value: inputData.value };
            },
          }),
        )
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

      const run = await incrementWorkflow.createRunAsync();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
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
        execute: vi.fn<any>().mockImplementation(async ({ inputData }) => ({
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
        execute: vi.fn<any>().mockImplementation(async ({ inputData }) => ({
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
        execute: vi.fn<any>().mockImplementation(async ({ inputData }) => ({
          result3: `combined-${inputData.step1.result1}-${inputData.step2.result2}`,
        })),
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
        execute: vi.fn<any>().mockImplementation(async ({ inputData }) => ({
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

      const run = workflow.createRun();
      const step1Spy = vi.spyOn(step1, 'execute');
      const step2Spy = vi.spyOn(step2, 'execute');
      const step3Spy = vi.spyOn(step3, 'execute');
      const step4Spy = vi.spyOn(step4, 'execute');
      const result = await run.start({ inputData: { input: 'test-data' } });

      // Verify the first parallel stage executed correctly
      expect(step1Spy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: { input: 'test-data' },
        }),
      );
      expect(step2Spy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: { input: 'test-data' },
        }),
      );

      // Verify the second parallel stage received the correct input
      expect(step3Spy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: {
            step1: { result1: 'processed-test-data' },
            step2: { result2: 'transformed-test-data' },
          },
        }),
      );
      expect(step4Spy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: {
            step1: { result1: 'processed-test-data' },
            step2: { result2: 'transformed-test-data' },
          },
        }),
      );

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
    });
  });

  describe('Run count', () => {
    it('runCount property should increment the run count when a step is executed multiple times', async () => {
      const repeatingStep = createStep({
        id: 'repeatingStep',
        inputSchema: z.object({}),
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: async ({ runCount }) => {
          return { count: runCount };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: repeatingStep.outputSchema,
      })
        .dountil(repeatingStep, async ({ inputData }) => inputData.count === 3)
        .commit();

      const result = await workflow.createRun().start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(result.steps.repeatingStep).toHaveProperty('output', { count: 3 });
    });

    it('multiple steps should have different run counts', async () => {
      const step1 = createStep({
        id: 'step1',
        inputSchema: z.object({}),
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: async ({ runCount }) => {
          return { count: runCount };
        },
      });

      const step2 = createStep({
        id: 'step2',
        inputSchema: step1.outputSchema,
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: async ({ runCount }) => {
          return { count: runCount };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .dowhile(step1, async ({ inputData }) => inputData.count < 3)
        .dountil(step2, async ({ inputData }) => inputData.count === 10)
        .commit();

      const result = await workflow.createRun().start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toHaveProperty('output', { count: 3 });
      expect(result.steps.step2).toHaveProperty('output', { count: 10 });
    });

    it('runCount should exist and equal zero for the first run', async () => {
      const mockExec = vi.fn().mockImplementation(async ({ runCount }) => {
        return { count: runCount };
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

      const run = workflow.createRun();
      await run.start({ inputData: {} });

      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({ runCount: 0 }));
    });
  });
});
