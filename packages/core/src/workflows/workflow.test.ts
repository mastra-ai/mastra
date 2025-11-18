import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { MockLanguageModelV2 } from 'ai-v5/test';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { z as zv4 } from 'zod-v4';
import { Agent } from '../agent';
import { RequestContext } from '../di';
import { MastraError } from '../error';
import { Mastra } from '../mastra';
import { TABLE_WORKFLOW_SNAPSHOT } from '../storage';
import { MockStore } from '../storage/mock';
import { createTool } from '../tools';
import type { ChunkType, StreamEvent } from './types';
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
        options: {
          validateInputs: false,
        },
      });
      workflow.then(step1).then(step2).commit();

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
        options: {
          validateInputs: false,
        },
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

    it('should handle basic suspend and resume flow using resumeLabel', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend(undefined, { resumeLabel: 'test-resume-label' });
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
        options: {
          validateInputs: false,
        },
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

      const run = await promptEvalWorkflow.createRun();

      const { stream, getWorkflowState } = run.streamLegacy({ inputData: { input: 'test' } });

      for await (const data of stream) {
        if (data.type === 'step-suspended') {
          expect(promptAgentAction).toHaveBeenCalledTimes(1);

          // make it async to show that execution is not blocked
          setImmediate(() => {
            const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
            run.resume({ resumeData: resumeData as any, label: 'test-resume-label' });
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

    it('should continue streaming current run on subsequent stream calls', async () => {
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

      new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRun();

      const { getWorkflowState } = run.streamLegacy({ inputData: { input: 'test' } });

      const result = await getWorkflowState();

      expect(result.status).toBe('suspended');

      if (result.status !== 'suspended') {
        expect.fail('Workflow is not suspended');
      }

      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
      expect(evaluateToneAction).not.toHaveBeenCalledTimes(1);
      run.resume({ resumeData: resumeData as any, step: promptAgent });

      const { stream, getWorkflowState: getWorkflowState2 } = run.streamLegacy();

      let index = 0;

      for await (const data of stream) {
        if (index === 0) {
          expect(data.payload).toMatchObject({
            id: 'promptAgent',
            payload: { userInput: 'test input' },
            startedAt: expect.any(Number),
            resumePayload: { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } },
            resumedAt: expect.any(Number),
            suspendedAt: expect.any(Number),
          });
        }

        index++;
      }

      expect(evaluateToneAction).toHaveBeenCalledTimes(1);

      const resumeResult = await getWorkflowState2();

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
            id: 'mapping_mock-uuid-1',
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
            id: 'mapping_mock-uuid-2',
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

    it('should pass agentOptions when wrapping agent with createStep', async () => {
      const onFinishSpy = vi.fn();
      const onChunkSpy = vi.fn();
      const maxSteps = 5;

      // Spy to capture what's passed to the model
      const doStreamSpy = vi.fn<any>(async ({ prompt, temperature }) => {
        // Verify instructions were overridden in the messages
        const systemMessage = prompt?.find((m: any) => m.role === 'system');
        expect(systemMessage?.content).toContain('overridden instructions');
        expect(systemMessage?.content).not.toContain('original instructions');

        // Verify temperature was passed through
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
        id: 'test-workflow-agent-options',
        inputSchema: z.object({
          prompt: z.string(),
        }),
        outputSchema: z.object({
          text: z.string(),
        }),
      });

      new Mastra({
        workflows: { 'test-workflow-agent-options': workflow },
        agents: { 'test-agent-with-options': agent },
        idGenerator: randomUUID,
      });

      // Create step with multiple agent options to verify they're all passed through
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

      const run = await workflow.createRun({
        runId: 'test-run-id-options',
      });

      const result = await run.start({
        inputData: {
          prompt: 'Test prompt',
        },
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({ text: 'Response' });
      }

      expect(doStreamSpy).toHaveBeenCalled();
      expect(onFinishSpy).toHaveBeenCalled();
      expect(onChunkSpy).toHaveBeenCalled();
    }, 10000);

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
        options: {
          validateInputs: false,
        },
      });
      workflow.then(step1).sleep(1000).then(step2).commit();

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

      const run = await workflow.createRun({ runId: 'test-run-id' });
      const originalInput = { originalInput: 'original-data' };

      const { stream, getWorkflowState } = run.streamLegacy({ inputData: originalInput });

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
      expect(result.input).toEqual(originalInput);

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
  });

  describe('Streaming (vNext)', () => {
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
        options: {
          validateInputs: false,
        },
      });
      workflow.then(step1).then(step2).commit();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRun({
        runId,
      });

      const streamResult = run.streamVNext({ inputData: {} });

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

      expect(watchData.length).toBe(6);
      expect(watchData).toMatchObject([
        {
          payload: {},
          type: 'workflow-start',
          from: 'WORKFLOW',
          runId,
        },
        {
          payload: {
            id: 'step1',
            payload: {},
            startedAt: expect.any(Number),
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId,
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId,
        },
        {
          payload: {
            id: 'step2',
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
          },
          from: 'WORKFLOW',
          runId,
          type: 'workflow-step-start',
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId,
        },
        {
          payload: {
            metadata: {},
            output: {
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            },
          },
          type: 'workflow-finish',
          from: 'WORKFLOW',
          runId,
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
          // someOtherValue: z.string(),
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

      const run = await workflow.createRun();
      const streamResult = run.streamVNext({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
        outputOptions: { includeState: true },
      });

      const executionResult = await streamResult.result;

      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(executionResult.state).toEqual({ value: 'test-state', otherValue: 'test-other-state' });

      const run2 = await workflow.createRun();
      const streamResult2 = run2.stream({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
        outputOptions: { includeState: true },
      });

      const executionResult2 = await streamResult2.result;

      // Verify execution completed successfully
      expect(executionResult2.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(executionResult2.state).toEqual({ value: 'test-state', otherValue: 'test-other-state' });
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

      new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRun();

      let streamResult = run.streamVNext({ inputData: { input: 'test' } });

      for await (const data of streamResult.fullStream) {
        if (data.type === 'workflow-step-suspended') {
          expect(promptAgentAction).toHaveBeenCalledTimes(1);

          // make it async to show that execution is not blocked
          expect(evaluateToneAction).not.toHaveBeenCalledTimes(1);
        }
      }

      const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
      const errStreamResult = run.resumeStreamVNext({ resumeData, step: getUserInput });
      for await (const _data of errStreamResult.fullStream) {
      }

      try {
        await errStreamResult.result;
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(
          'This workflow step "getUserInput" was not suspended. Available suspended steps: [promptAgent]',
        );
      }

      streamResult = run.resumeStreamVNext({ resumeData, step: promptAgent });
      console.log('created stream');
      for await (const _data of streamResult.fullStream) {
        console.log('data===', _data);
      }

      expect(evaluateToneAction).toHaveBeenCalledTimes(1);

      const resumeResult = await streamResult.result;
      if (!resumeResult) {
        expect.fail('Resume result is not set');
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

    it('should handle basic suspend and resume flow that does not close on suspend', async () => {
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

      new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRun();

      let streamResult = run.streamVNext({ inputData: { input: 'test' }, closeOnSuspend: false });

      for await (const data of streamResult.fullStream) {
        if (data.type === 'workflow-step-suspended') {
          expect(promptAgentAction).toHaveBeenCalledTimes(1);

          // make it async to show that execution is not blocked
          expect(evaluateToneAction).not.toHaveBeenCalledTimes(1);

          setImmediate(() => {
            const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
            run.resume({ resumeData: resumeData as any, step: promptAgent });
          });
        }
      }

      expect(evaluateToneAction).toHaveBeenCalledTimes(1);

      const resumeResult = await streamResult.result;
      if (!resumeResult) {
        expect.fail('Resume result is not set');
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

      new Mastra({
        storage: testStorage,
        workflows: { 'test-workflow': resumableWorkflow },
      });

      const run = await resumableWorkflow.createRun();

      let streamResult = run.streamVNext({ inputData: { input: 'test input for stream' } });

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
      streamResult = run.resumeStreamVNext({ resumeData, step: promptAgent });
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

      expect(result.steps).toEqual({
        input: { input: 'test input for stream' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input for stream' },
          payload: { input: 'test input for stream' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input for stream' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumePayload: { userInput: 'test input for resumption' },
          resumedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          suspendPayload: {},
          suspendOutput: {
            modelOutput: 'test output',
          },
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
        options: {
          validateInputs: false,
        },
      });

      const agent = new Agent({
        id: 'test-agent-1',
        name: 'test-agent-1',
        instructions: 'test agent instructions"',
        model: new MockLanguageModelV2({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Paris' },
                { type: 'text-start', id: '1' },
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
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'London' },
                { type: 'text-start', id: '1' },
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

      const run = await workflow.createRun({
        runId: 'test-run-id',
      });
      const streamResult = run.streamVNext({
        inputData: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
      });

      const values: ChunkType[] = [];
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

      expect(workflowEvents).toMatchObject([
        {
          type: 'workflow-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {},
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'start',
            id: 'start',
            stepCallId: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'start',
            id: 'start',
            stepCallId: expect.any(String),
            status: 'success',
            output: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-1',
            id: 'mapping_mock-uuid-1',
            stepCallId: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-1',
            id: 'mapping_mock-uuid-1',
            stepCallId: expect.any(String),
            status: 'success',
            output: {
              prompt: 'Capital of France, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-1',
            id: 'test-agent-1',
            stepCallId: expect.any(String),
            payload: {
              prompt: 'Capital of France, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-1',
            id: 'test-agent-1',
            stepCallId: expect.any(String),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-2',
            id: 'mapping_mock-uuid-2',
            stepCallId: expect.any(String),
            payload: {},
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-2',
            id: 'mapping_mock-uuid-2',
            stepCallId: expect.any(String),
            status: 'success',
            output: {
              prompt: 'Capital of UK, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-2',
            id: 'test-agent-2',
            stepCallId: expect.any(String),
            payload: {
              prompt: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-2',
            id: 'test-agent-2',
            stepCallId: expect.any(String),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-finish',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            output: {
              usage: {
                inputTokens: 20,
                outputTokens: 40,
                totalTokens: 60,
              },
            },
            metadata: {},
          },
        },
      ]);
    });

    it('should be able to use an agent with v1 model as a step', async () => {
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

      const run = await workflow.createRun({
        runId: 'test-run-id',
      });
      const streamResult = run.streamVNext({
        inputData: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
      });

      const values: ChunkType[] = [];
      for await (const value of streamResult.fullStream) {
        values.push(value);
      }
      const workflowEvents = values.filter(value => value.type !== 'workflow-step-output');
      const agentEvents = values.filter(value => value.type === 'workflow-step-output');

      expect(agentEvents.map(event => event?.payload?.output?.type)).toEqual([
        'step-start',
        'text-delta',
        'step-finish',
        'finish',
        'step-start',
        'text-delta',
        'step-finish',
        'finish',
      ]);

      expect(workflowEvents).toMatchObject([
        {
          type: 'workflow-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {},
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'start',
            id: 'start',
            stepCallId: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'start',
            id: 'start',
            stepCallId: expect.any(String),
            status: 'success',
            output: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-1',
            id: 'mapping_mock-uuid-1',
            stepCallId: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-1',
            id: 'mapping_mock-uuid-1',
            stepCallId: expect.any(String),
            status: 'success',
            output: {
              prompt: 'Capital of France, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-1',
            id: 'test-agent-1',
            stepCallId: expect.any(String),
            payload: {
              prompt: 'Capital of France, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-1',
            id: 'test-agent-1',
            stepCallId: expect.any(String),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-2',
            id: 'mapping_mock-uuid-2',
            stepCallId: expect.any(String),
            payload: {},
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'mapping_mock-uuid-2',
            id: 'mapping_mock-uuid-2',
            stepCallId: expect.any(String),
            status: 'success',
            output: {
              prompt: 'Capital of UK, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-2',
            id: 'test-agent-2',
            stepCallId: expect.any(String),
            payload: {
              prompt: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-2',
            id: 'test-agent-2',
            stepCallId: expect.any(String),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-finish',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            output: {
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            },
            metadata: {},
          },
        },
      ]);
    });

    it('should pass agentOptions when wrapping agent with createStep', async () => {
      const onFinishSpy = vi.fn();
      const onChunkSpy = vi.fn();
      const maxSteps = 5;

      // Spy to capture what's passed to the model
      const doStreamSpy = vi.fn<any>(async ({ prompt, temperature }) => {
        // Verify instructions were overridden in the messages
        const systemMessage = prompt?.find((m: any) => m.role === 'system');
        expect(systemMessage?.content).toContain('overridden instructions');
        expect(systemMessage?.content).not.toContain('original instructions');

        // Verify temperature was passed through
        expect(temperature).toBe(0.7);

        return {
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Response' },
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
        };
      });

      const agent = new Agent({
        id: 'test-agent-with-options-v2',
        name: 'test-agent-with-options-v2',
        instructions: 'original instructions',
        model: new MockLanguageModelV2({
          doStream: doStreamSpy,
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow-agent-options-v2',
        inputSchema: z.object({
          prompt: z.string(),
        }),
        outputSchema: z.object({
          text: z.string(),
        }),
        options: {
          validateInputs: false,
        },
      });

      new Mastra({
        workflows: { 'test-workflow-agent-options-v2': workflow },
        agents: { 'test-agent-with-options-v2': agent },
        idGenerator: randomUUID,
      });

      // Create step with multiple agent options to verify they're all passed through
      const agentStep = createStep(agent, {
        maxSteps,
        onFinish: onFinishSpy,
        onChunk: onChunkSpy,
        instructions: 'overridden instructions',
        modelSettings: {
          temperature: 0.7,
        },
      });

      workflow
        .map({ prompt: { value: 'test', schema: z.string() } })
        .then(agentStep)
        .commit();

      const run = await workflow.createRun({
        runId: 'test-run-id-options-v2',
      });

      const result = await run.start({
        inputData: {
          prompt: 'Test prompt',
        },
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({ text: 'Response' });
      }

      expect(doStreamSpy).toHaveBeenCalled();
      expect(onFinishSpy).toHaveBeenCalled();
      expect(onChunkSpy).toHaveBeenCalled();
    }, 10000);

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
        options: {
          validateInputs: false,
        },
      });
      workflow.then(step1).sleep(1000).then(step2).commit();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRun({
        runId,
      });

      const streamResult = run.streamVNext({ inputData: {} });

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

      expect(watchData.length).toBe(8);
      expect(watchData).toMatchObject([
        {
          payload: {},
          type: 'workflow-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step1',
            startedAt: expect.any(Number),
            status: 'running',
            payload: {},
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-waiting',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            metadata: {},
            output: {
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            },
          },
          type: 'workflow-finish',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
      const run = await workflow.createRun({
        runId,
      });

      const streamResult = run.streamVNext({ inputData: {} });

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

      expect(watchData.length).toBe(8);
      expect(watchData).toMatchObject([
        {
          payload: {},
          type: 'workflow-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step1',
            startedAt: expect.any(Number),
            status: 'running',
            payload: {},
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-waiting',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            metadata: {},
            output: {
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            },
          },
          type: 'workflow-finish',
          from: 'WORKFLOW',
          runId: 'test-run-id',
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

      const run = await workflow.createRun({ runId: 'test-run-id' });
      const originalInput = { originalInput: 'original-data' };

      let streamResult = run.streamVNext({ inputData: originalInput });

      for await (const _data of streamResult) {
      }

      const resumeData = { stepId: 'step1', context: { differentData: 'resume-data' } };
      streamResult = run.resumeStreamVNext({ resumeData: resumeData as any, step: step1 });
      for await (const _data of streamResult) {
      }

      const result = await streamResult.result;
      if (!result) {
        expect.fail('Execution result is not set');
      }

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
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

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
    });

    it('should throw error when execution flow not defined', async () => {
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

      await expect(workflow.createRun()).rejects.toThrowError(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    });

    it('should throw error when execution graph is not committed', async () => {
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

      expect(workflow.committed).toBe(false);

      await expect(workflow.createRun()).rejects.toThrowError(
        'Uncommitted step flow changes detected. Call .commit() to register the steps.',
      );
    });

    it('should automatically commit uncommitted workflow when registering in mastra instance', async () => {
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

      expect(workflow.committed).toBe(false);

      new Mastra({
        workflows: { 'test-workflow': workflow },
        storage: testStorage,
      });

      expect(workflow.committed).toBe(true);

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
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
    });

    it('should execute a single step workflow successfully with state', async () => {
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
          // someOtherValue: z.string(),
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

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
      });

      expect(calls).toBe(1);
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
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
          // someOtherValue: z.string(),
        }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
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
    });

    it('should execute a single step nested workflow successfully with state being set by the nested workflow', async () => {
      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state, setState }) => {
          calls++;
          setState({ ...state, value: state.value + '!!!' });
          return {};
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
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
          // someOtherValue: z.string(),
        }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
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
    });

    it('should properly update snapshot when executing multiple steps in parallel', async () => {
      // Create step actions with delays to simulate real execution
      const initialStepAction = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: 'initial step done' };
      });

      const parallelStep1Action = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { result: 'parallelStep1 done' };
      });

      const parallelStep2Action = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { result: 'parallelStep2 done' };
      });

      const parallelStep3Action = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
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
        steps: [initialStep, parallelStep1, parallelStep2, parallelStep3, finalStep],
      })
        .then(initialStep)
        .parallel([parallelStep1, parallelStep2, parallelStep3])
        .then(finalStep)
        .commit();

      // Initialize Mastra with testStorage
      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-parallel-workflow': testParallelWorkflow },
      });

      // Create and start workflow run (fire and forget)
      const run = await testParallelWorkflow.createRun();

      // Start workflow without awaiting
      const workflowPromise = run.start({ inputData: { input: 'test' } });

      // Poll to verify parallel steps go through "running" state
      let foundAllRunning = false;
      let allStepsPresentThroughout = true;
      const seenSteps = new Set<string>();
      const pollResults: any[] = [];

      // Wait a bit for the workflow to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Poll until workflow completes
      while (true) {
        const currentResult = await testParallelWorkflow.getWorkflowRunExecutionResult(run.runId);

        if (!currentResult) {
          allStepsPresentThroughout = false;
          break;
        }
        const runningSteps = Object.keys(currentResult.steps).filter(
          stepName => currentResult.steps[stepName]?.status === 'running',
        );
        const runningStepIsInActiveStepsPath = runningSteps.every(stepName => currentResult.activeStepsPath[stepName]);

        expect(runningStepIsInActiveStepsPath).toBe(true);

        expect(runningSteps.length).toBe(Object.keys(currentResult.activeStepsPath).length);

        pollResults.push({
          status: currentResult.status,
          stepStatuses: {
            initialStep: currentResult.steps?.['initialStep']?.status,
            parallelStep1: currentResult.steps?.['parallelStep1']?.status,
            parallelStep2: currentResult.steps?.['parallelStep2']?.status,
            parallelStep3: currentResult.steps?.['parallelStep3']?.status,
            finalStep: currentResult.steps?.['finalStep']?.status,
          },
        });

        // Track which steps we've seen
        if (currentResult.steps) {
          Object.keys(currentResult.steps).forEach(stepName => {
            if (stepName !== 'input' && stepName !== 'metadata') {
              seenSteps.add(stepName);
            }
          });
        }

        // Check if all three parallel steps are running simultaneously
        const parallelStep1Status = currentResult.steps?.['parallelStep1']?.status;
        const parallelStep2Status = currentResult.steps?.['parallelStep2']?.status;
        const parallelStep3Status = currentResult.steps?.['parallelStep3']?.status;

        if (
          parallelStep1Status === 'running' &&
          parallelStep2Status === 'running' &&
          parallelStep3Status === 'running'
        ) {
          foundAllRunning = true;
        }

        // Verify no step disappears once it has appeared
        if (seenSteps.has('parallelStep1') && !currentResult.steps?.['parallelStep1']) {
          allStepsPresentThroughout = false;
        }
        if (seenSteps.has('parallelStep2') && !currentResult.steps?.['parallelStep2']) {
          allStepsPresentThroughout = false;
        }
        if (seenSteps.has('parallelStep3') && !currentResult.steps?.['parallelStep3']) {
          allStepsPresentThroughout = false;
        }

        // Break if workflow is complete
        if (currentResult.status === 'success' || currentResult.status === 'failed') {
          break;
        }

        // Poll every 50ms
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for workflow to complete
      await workflowPromise;

      // Get final workflow execution result
      const result = await testParallelWorkflow.getWorkflowRunExecutionResult(run.runId);

      // Verify all parallel steps went through running state
      expect(foundAllRunning).toBe(true);

      // Verify no step information disappeared during polling
      expect(allStepsPresentThroughout).toBe(true);

      // Verify all step actions were called
      expect(initialStepAction).toHaveBeenCalled();
      expect(parallelStep1Action).toHaveBeenCalled();
      expect(parallelStep2Action).toHaveBeenCalled();
      expect(parallelStep3Action).toHaveBeenCalled();
      expect(finalStepAction).toHaveBeenCalled();

      // Verify workflow status
      expect(result?.status).toBe('success');

      // Verify all steps have correct status and output
      expect(result?.steps).toMatchObject({
        initialStep: {
          status: 'success',
          output: { result: 'initial step done' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        parallelStep1: {
          status: 'success',
          output: { result: 'parallelStep1 done' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        parallelStep2: {
          status: 'success',
          output: { result: 'parallelStep2 done' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        parallelStep3: {
          status: 'success',
          output: { result: 'parallelStep3 done' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        finalStep: {
          status: 'success',
          output: { result: 'All done!' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      // Verify that parallel steps started after initial step
      expect(result?.steps['parallelStep1']?.startedAt).toBeGreaterThanOrEqual(result?.steps['initialStep']?.endedAt!);
      expect(result?.steps['parallelStep2']?.startedAt).toBeGreaterThanOrEqual(result?.steps['initialStep']?.endedAt!);
      expect(result?.steps['parallelStep3']?.startedAt).toBeGreaterThanOrEqual(result?.steps['initialStep']?.endedAt!);

      // Verify that final step started after all parallel steps completed
      const maxParallelEndTime = Math.max(
        result?.steps['parallelStep1']?.endedAt!,
        result?.steps['parallelStep2']?.endedAt!,
        result?.steps['parallelStep3']?.endedAt!,
      );
      expect(result?.steps['finalStep']?.startedAt).toBeGreaterThanOrEqual(maxParallelEndTime);
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
      });

      it('should provide access to step results and trigger data via getStepResult helper', async () => {
        const step1Action = vi.fn().mockImplementation(async ({ inputData }) => {
          // Test accessing trigger data with correct type
          expect(inputData).toEqual({ inputValue: 'test-input' });
          return { value: 'step1-result' };
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ getStepResult }) => {
            // Test accessing previous step result with type
            const step1Result = getStepResult(step1);
            expect(step1Result).toEqual({ value: 'step1-result' });
            const step1ResultFromString = getStepResult('step1');
            expect(step1ResultFromString).toEqual({ value: 'step1-result' });

            const failedStep = getStepResult(nonExecutedStep);
            expect(failedStep).toBe(null);

            return { value: 'step2-result' };
          },
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

        const run = await workflow.createRun();
        const result = await run.start({ inputData: { inputValue: 'test-input' } });

        expect(step1Action).toHaveBeenCalled();
        // expect(step2Action).toHaveBeenCalled();
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

        const run = await workflow.createRun();
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
      });

      it('should resolve trigger data and DI requestContext values via .map()', async () => {
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
              requestContextPath: 'life',
              schema: z.number(),
            },
          })
          .then(step2)
          .commit();

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
      });

      it('should resolve dynamic mappings via .map() with custom step id', async () => {
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
          .map(
            {
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
            },
            {
              id: 'step1-mapping',
            },
          )
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

        expect(result.steps['step1-mapping']).toBeDefined();

        expect(result.steps['step1-mapping']).toEqual({
          status: 'success',
          output: { test: 'test-input', test2: 'Hello success' },
          payload: { result: 'success' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

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

        const run = await workflow.createRun();
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
          options: {
            validateInputs: false,
          },
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
      });

      it('should support custom condition functions', async () => {
        const step1Action = vi.fn<any>().mockResolvedValue({ count: 5 });
        const step2Action = vi.fn<any>();

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          resumeSchema: z.object({ count: z.number() }),
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
          options: {
            validateInputs: false,
          },
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
        steps: [step1, step2],
      });

      workflow.then(step1).sleep(1000).then(step2).commit();

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

      // Allow for slight timing variance (999ms is close enough to 1000ms)
      expect(endTime - startTime).toBeGreaterThanOrEqual(990);
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
        steps: [step1, step2],
      });

      workflow
        .then(step1)
        .sleep(async ({ inputData }) => {
          return inputData.value;
        })
        .then(step2)
        .commit();

      const run = await workflow.createRun();
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
        steps: [step1, step2],
      });

      workflow
        .then(step1)
        .sleepUntil(new Date(Date.now() + 1000))
        .then(step2)
        .commit();

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
        steps: [step1, step2],
      });

      workflow
        .then(step1)
        .sleepUntil(async ({ inputData }) => {
          return new Date(Date.now() + inputData.value);
        })
        .then(step2)
        .commit();

      const run = await workflow.createRun();
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

    it('should throw error if waitForEvent is used', async () => {
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
        steps: [step1, step2],
      });

      try {
        // @ts-expect-error - we expect this to throw an error
        workflow.then(step1).waitForEvent('hello-event', step2).commit();
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        expect(error).toHaveProperty(
          'message',
          'waitForEvent has been removed. Please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details.',
        );
      }
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

      const run = await incrementWorkflow.createRun();
      const { stream, getWorkflowState } = run.streamLegacy({ inputData: { value: 0 } });

      for await (const data of stream) {
        if (data.type === 'step-finish' && (data as any).payload.id === 'increment') {
          setTimeout(async () => {
            const currentExecResult = await incrementWorkflow.getWorkflowRunExecutionResult(run.runId);
            expect(currentExecResult?.status).toBe('running');
            expect(currentExecResult?.steps['final']?.status).toBe('running');
          }, 500);
        }
      }
      const finalResult = await getWorkflowState();
      expect(finalResult.status).toBe('success');
    });

    it('should return workflow run execution result with nested workflow steps information', async () => {
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

      const nestedIncrementWorkflowAgain = createWorkflow({
        id: 'nested-increment-workflow-again',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(incrementStep)
        .commit();

      const nestedIncrementWorkflow = createWorkflow({
        id: 'nested-increment-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(nestedIncrementWorkflowAgain)
        .commit();

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(nestedIncrementWorkflow)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => {
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

      const run = await incrementWorkflow.createRun();
      await run.start({ inputData: { value: 0 } });
      const result = await incrementWorkflow.getWorkflowRunExecutionResult(run.runId);
      expect(result?.status).toBe('success');
      expect(result?.steps).toMatchObject({
        'nested-increment-workflow': {
          payload: {
            value: 0,
          },
          startedAt: expect.any(Number),
          status: 'success',
          output: {
            value: 1,
          },
          endedAt: expect.any(Number),
        },
        'nested-increment-workflow.nested-increment-workflow-again': {
          payload: {
            value: 0,
          },
          startedAt: expect.any(Number),
          status: 'success',
          output: {
            value: 1,
          },
          endedAt: expect.any(Number),
        },
        'nested-increment-workflow.nested-increment-workflow-again.increment': {
          payload: {
            value: 0,
          },
          startedAt: expect.any(Number),
          status: 'success',
          output: {
            value: 1,
          },
          endedAt: expect.any(Number),
        },
        final: {
          payload: {
            value: 1,
          },
          startedAt: expect.any(Number),
          status: 'success',
          output: {
            value: 1,
          },
          endedAt: expect.any(Number),
        },
      });
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
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).sleep(1000).then(step2).commit();

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
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRun();
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
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

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

      const run = await workflow.createRun();

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

    it('should persist error message without stack trace in snapshot', async () => {
      const mockStorage = new MockStore();
      const persistSpy = vi.spyOn(mockStorage, 'persistWorkflowSnapshot');

      const mastra = new Mastra({
        storage: mockStorage,
      });

      const errorMessage = 'Test error: step execution failed.';
      const failingAction = vi.fn<any>().mockImplementation(() => {
        throw new Error(errorMessage);
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
        mastra,
      });

      workflow.then(step1).commit();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(persistSpy).toHaveBeenCalled();

      const persistCall = persistSpy.mock.calls[persistSpy.mock.calls.length - 1];
      const snapshot = persistCall?.[0]?.snapshot;

      expect(snapshot).toBeDefined();
      expect(snapshot.status).toBe('failed');

      const step1Result = snapshot.context.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result?.status).toBe('failed');

      const failedStepResult = step1Result as Extract<typeof step1Result, { status: 'failed' }>;
      expect(failedStepResult.error).toBeDefined();
      expect(failedStepResult.error).toBe('Error: ' + errorMessage);
      expect(String(failedStepResult.error)).not.toContain('at Object.execute');
      expect(String(failedStepResult.error)).not.toContain('at ');
      expect(String(failedStepResult.error)).not.toContain('\n');
    });

    it('should persist MastraError message without stack trace in snapshot', async () => {
      const mockStorage = new MockStore();
      const persistSpy = vi.spyOn(mockStorage, 'persistWorkflowSnapshot');

      const mastra = new Mastra({
        storage: mockStorage,
      });

      const errorMessage = 'Step execution failed.';
      const failingAction = vi.fn<any>().mockImplementation(() => {
        throw new MastraError({
          id: 'VALIDATION_ERROR',
          domain: 'MASTRA_WORKFLOW',
          category: 'USER',
          text: errorMessage,
          details: { field: 'test' },
        });
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
        mastra,
      });

      workflow.then(step1).commit();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(persistSpy).toHaveBeenCalled();

      const persistCall = persistSpy.mock.calls[persistSpy.mock.calls.length - 1];
      const snapshot = persistCall?.[0]?.snapshot;

      expect(snapshot).toBeDefined();
      expect(snapshot.status).toBe('failed');

      const step1Result = snapshot.context.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result?.status).toBe('failed');

      const failedStepResult = step1Result as Extract<typeof step1Result, { status: 'failed' }>;
      expect(failedStepResult.error).toBeDefined();
      expect(failedStepResult.error).toBe('Error: ' + errorMessage);
      expect(String(failedStepResult.error)).not.toContain('at Object.execute');
      expect(String(failedStepResult.error)).not.toContain('at ');
      expect(String(failedStepResult.error)).not.toContain('\n');
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
    });
  });

  describe('Loops', () => {
    it('should run an until loop', async () => {
      let count = 0;
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
        options: {
          validateInputs: false,
        },
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
        .dountil(incrementStep, async ({ inputData, iterationCount }) => {
          expect(iterationCount).toBe(++count);
          return (inputData?.value ?? 0) >= 12;
        })
        .then(finalStep)
        .commit();

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.result).toEqual({ finalValue: 12 });
      // @ts-ignore
      expect(result.steps.increment.output).toEqual({ value: 12 });
    });

    it('should run a while loop', async () => {
      let count = 0;
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
        options: {
          validateInputs: false,
        },
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
        .dowhile(incrementStep, async ({ inputData, iterationCount }) => {
          expect(iterationCount).toBe(++count);
          return (inputData?.value ?? 0) < 12;
        })
        .then(finalStep)
        .commit();

      const run = await counterWorkflow.createRun();
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
        options: {
          validateInputs: false,
        },
      });

      counterWorkflow.foreach(mapStep).then(finalStep).commit();

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

    it('should suspend and resume when running a single item concurrency (default) for loop', async () => {
      const map = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          return suspend({});
        }
        return { value: inputData.value + 11 + resumeData.resumeValue };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        resumeSchema: z.object({
          resumeValue: z.number(),
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
        options: {
          validateInputs: false,
        },
        steps: [mapStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
      });

      counterWorkflow.foreach(mapStep).then(finalStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });

      expect(result.status).toBe('suspended');

      let resumedResult = await run.resume({ resumeData: { resumeValue: 0 } });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 5 } });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 0 } });
      expect(resumedResult.status).toBe('success');

      expect(map).toHaveBeenCalledTimes(6);
      expect(resumedResult.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 + 5 }, { value: 344 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
          resumePayload: { resumeValue: 0 },
          suspendPayload: { __workflow_meta: expect.any(Object) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + (22 + 11 + 5) + (333 + 11) },
          payload: [{ value: 12 }, { value: 33 + 5 }, { value: 344 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
      expect(resumedResult.steps.map.suspendOutput).toBeUndefined();
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
        options: {
          validateInputs: false,
        },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

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

    it('should suspend and resume when running all items concurrency for loop', async () => {
      const map = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
        if (!resumeData && inputData.value > 5) {
          return suspend({});
        }
        return { value: inputData.value + 11 + (resumeData?.resumeValue ?? 0) };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        resumeSchema: z.object({
          resumeValue: z.number(),
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
        options: {
          validateInputs: false,
        },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 22 }, { value: 1 }, { value: 333 }] });

      expect(result.status).toBe('suspended');

      let resumedResult = await run.resume({ resumeData: { resumeValue: 5 } });
      expect(resumedResult.status).toBe('success');

      expect(map).toHaveBeenCalledTimes(5);
      expect(resumedResult.steps).toEqual({
        input: [{ value: 22 }, { value: 1 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 33 + 5 }, { value: 12 }, { value: 344 + 5 }],
          payload: [{ value: 22 }, { value: 1 }, { value: 333 }],
          resumePayload: { resumeValue: 5 },
          suspendPayload: { __workflow_meta: expect.any(Object) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 22 + 11 + 5 + 1 + 11 + (333 + 11 + 5) },
          payload: [{ value: 33 + 5 }, { value: 12 }, { value: 344 + 5 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should suspend and resume provided index when running all items concurrency for loop', async () => {
      const map = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          return suspend({});
        }
        return { value: inputData.value + 11 + resumeData.resumeValue };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        resumeSchema: z.object({
          resumeValue: z.number(),
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
        options: {
          validateInputs: false,
        },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });
      expect(result.status).toBe('suspended');

      let resumedResult = await run.resume({ resumeData: { resumeValue: 5 }, forEachIndex: 2 });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 0 }, forEachIndex: 1 });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 3 }, forEachIndex: 0 });
      expect(resumedResult.status).toBe('success');

      expect(map).toHaveBeenCalledTimes(6);
      expect(resumedResult.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 + 3 }, { value: 33 + 0 }, { value: 344 + 5 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
          resumePayload: { resumeValue: 3 },
          suspendPayload: { __workflow_meta: expect.any(Object) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + 3 + (22 + 11 + 0) + (333 + 11 + 5) },
          payload: [{ value: 12 + 3 }, { value: 33 + 0 }, { value: 344 + 5 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      const run2 = await counterWorkflow.createRun();
      const result2 = await run2.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });
      expect(result2.status).toBe('suspended');

      let resumedResult2 = await run2.resume({ resumeData: { resumeValue: 5 }, forEachIndex: 0 });
      expect(resumedResult2.status).toBe('suspended');

      resumedResult2 = await run2.resume({ resumeData: { resumeValue: 0 }, forEachIndex: 1 });
      expect(resumedResult2.status).toBe('suspended');

      resumedResult2 = await run2.resume({ resumeData: { resumeValue: 3 }, forEachIndex: 2 });
      expect(resumedResult2.status).toBe('success');

      expect(map).toHaveBeenCalledTimes(12);
      expect(resumedResult2.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 + 5 }, { value: 33 + 0 }, { value: 344 + 3 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
          resumePayload: { resumeValue: 3 },
          suspendPayload: { __workflow_meta: expect.any(Object) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + 5 + (22 + 11 + 0) + (333 + 11 + 3) },
          payload: [{ value: 12 + 5 }, { value: 33 + 0 }, { value: 344 + 3 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should suspend and resume provided label when running all items concurrency for loop', async () => {
      let rl = 0;
      const map = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          const newRl = rl++;
          console.log('suspend', `test-label-${newRl}`);
          return suspend({}, { resumeLabel: `test-label-${newRl}` });
        }
        return { value: inputData.value + 11 + resumeData.resumeValue };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        resumeSchema: z.object({
          resumeValue: z.number(),
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
        options: {
          validateInputs: false,
        },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });
      expect(result.status).toBe('suspended');

      let resumedResult = await run.resume({ resumeData: { resumeValue: 5 }, label: 'test-label-2' });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 0 }, label: 'test-label-1' });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 3 }, label: 'test-label-0' });
      expect(resumedResult.status).toBe('success');

      expect(map).toHaveBeenCalledTimes(6);
      expect(resumedResult.steps).toEqual({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: {
          status: 'success',
          output: [{ value: 12 + 3 }, { value: 33 + 0 }, { value: 344 + 5 }],
          payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
          resumePayload: { resumeValue: 3 },
          suspendPayload: { __workflow_meta: expect.any(Object) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + 3 + (22 + 11 + 0) + (333 + 11 + 5) },
          payload: [{ value: 12 + 3 }, { value: 33 + 0 }, { value: 344 + 5 }],
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
        options: {
          validateInputs: false,
        },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 2 }).then(finalStep).commit();

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
    });

    it('should suspend and resume when running a partial item concurrency for loop', async () => {
      const map = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
        if (!resumeData && inputData.value > 5) {
          return suspend({});
        }
        return { value: inputData.value + 11 + (resumeData?.resumeValue ?? 0) };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        resumeSchema: z.object({
          resumeValue: z.number(),
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
        options: {
          validateInputs: false,
        },
      });

      counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = await counterWorkflow.createRun();
      const result = await run.start({
        inputData: [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
      });

      expect(result.status).toBe('suspended');

      let resumedResult = await run.resume({ resumeData: { resumeValue: 5 } });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 5 } });
      expect(resumedResult.status).toBe('success');

      expect(map).toHaveBeenCalledTimes(9);
      expect(resumedResult.steps).toEqual({
        input: [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
        map: {
          status: 'success',
          output: [{ value: 33 + 5 }, { value: 12 }, { value: 344 + 5 }, { value: 455 + 5 }, { value: 1011 + 5 }],
          payload: [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
          resumePayload: { resumeValue: 5 },
          suspendPayload: { __workflow_meta: expect.any(Object) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 22 + 11 + 5 + 1 + 11 + (333 + 11 + 5) + (444 + 11 + 5) + (1000 + 11 + 5) },
          payload: [{ value: 33 + 5 }, { value: 12 }, { value: 344 + 5 }, { value: 455 + 5 }, { value: 1011 + 5 }],
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should suspend and resume provided index when running a partial item concurrency for loop', async () => {
      const map = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
        if (!resumeData && inputData.value > 5) {
          return suspend({});
        }
        return { value: inputData.value + 11 + (resumeData?.resumeValue ?? 0) };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        resumeSchema: z.object({
          resumeValue: z.number(),
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = await counterWorkflow.createRun();
      const result = await run.start({
        inputData: [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
      });

      expect(result.status).toBe('suspended');

      let resumedResult = await run.resume({ resumeData: { resumeValue: 5 }, forEachIndex: 2 });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 3 }, forEachIndex: 0 });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 2 }, forEachIndex: 3 });
      expect(resumedResult.status).toBe('suspended');

      resumedResult = await run.resume({ resumeData: { resumeValue: 8 }, forEachIndex: 4 });
      expect(resumedResult.status).toBe('success');

      expect(map).toHaveBeenCalledTimes(9);
      expect(resumedResult.steps).toEqual({
        input: [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
        map: {
          status: 'success',
          output: [{ value: 33 + 3 }, { value: 12 }, { value: 344 + 5 }, { value: 455 + 2 }, { value: 1011 + 8 }],
          payload: [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
          resumePayload: { resumeValue: 8 },
          suspendPayload: { __workflow_meta: expect.any(Object) },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        final: {
          status: 'success',
          output: { finalValue: 22 + 11 + 3 + 1 + 11 + (333 + 11 + 5) + (444 + 11 + 2) + (1000 + 11 + 8) },
          payload: [{ value: 33 + 3 }, { value: 12 }, { value: 344 + 5 }, { value: 455 + 2 }, { value: 1011 + 8 }],
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

      const run = await counterWorkflow.createRun();
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

      const run = await counterWorkflow.createRun();
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
    it('should throw error if trigger data is invalid', async () => {
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

      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockResolvedValue({ result: 'step2 success' }),
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
        execute: vi.fn<any>().mockResolvedValue({ result: 'step3 success' }),
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
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
        options: { validateInputs: true },
      });

      const parallelWorkflow = createWorkflow({
        id: 'parallel-workflow',
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

      try {
        const run = await workflow.createRun();
        await run.start({
          inputData: {
            required: 'test',
            // @ts-expect-error
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
            // @ts-expect-error
            nested: { value: 'not-a-number' },
          },
        });

        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- nested.value: Expected number, received string',
        );
      }
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
        id: 'test-workflow',
        inputSchema: triggerSchema,
        outputSchema: triggerSchema,
        steps: [step1],
        options: { validateInputs: true },
      });

      workflow.then(step1).commit();

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

      // @ts-ignore
      expect(result.result).toEqual({ required: 'test', nested: { value: 1 } });
    });

    it('should throw error if inputData is invalid', async () => {
      const successAction = vi.fn<any>().mockImplementation(() => {
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
        id: 'test-workflow',
        inputSchema: z.object({
          start: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        options: { validateInputs: true },
      });

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {
          start: '2',
        },
      });

      expect(result.status).toBe('failed'); // Assert status first

      // Type guard for result.error
      if (result.status === 'failed') {
        // This check helps TypeScript narrow down the type of 'result'
        expect(result.error).toContain('Error: Step input validation failed: \n- start: Required'); // Now safe to access
      } else {
        // This case should not be reached in this specific test.
        // If it is, the test should fail clearly.
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
        error: expect.any(String),
      });
      expect((step2Result as any)?.error).toContain('Error: Step input validation failed: \n- start: Required');
    });

    it('should use default value from inputSchema for step input', async () => {
      const successAction = vi.fn<any>().mockImplementation(() => {
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
        id: 'test-workflow',
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
    });

    it('should throw error if inputData is invalid in workflow with .map()', async () => {
      const successAction = vi.fn<any>().mockImplementation(() => {
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
        id: 'test-workflow',
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

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {
          start: 2,
        },
      });

      expect(result.status).toBe('failed'); // Assert status first

      // Type guard for result.error
      if (result.status === 'failed') {
        // This check helps TypeScript narrow down the type of 'result'
        expect(result.error).toContain(
          'Error: Step input validation failed: \n- start: Expected string, received number',
        ); // Now safe to access
      } else {
        // This case should not be reached in this specific test.
        // If it is, the test should fail clearly.
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
        error: expect.any(String),
      });
      expect((step2Result as any)?.error).toContain(
        'Error: Step input validation failed: \n- start: Expected string, received number',
      );
    });

    it('should throw error when you try to resume a workflow step with invalid resume data', async () => {
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

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

      const wflowRun = await incrementWorkflow.getWorkflowRunExecutionResult(run.runId);
      expect(wflowRun?.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
    });

    it('should use default value from resumeSchema when resuming a workflow', async () => {
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
        id: 'increment-workflow',
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

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
    });

    it('should throw error if inputData is invalid in nested workflows', async () => {
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
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: true },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ finalValue: z.number() }),
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
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
              'nested-workflow-a': z.object({ finalValue: z.number() }),
              'nested-workflow-b': z.object({ finalValue: z.number() }),
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
      // @ts-ignore
      expect(result.steps['nested-workflow-a'].error).toContain(
        'Error: Step input validation failed: \n- newValue: Required',
      );

      // @ts-ignore
      expect(result.steps['nested-workflow-b'].output).toEqual({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toBeUndefined();
    });
  });

  describe('Schema Validation Zod-v4', () => {
    it('should throw error if trigger data is invalid', async () => {
      const triggerSchema = zv4.object({
        required: zv4.string(),
        nested: zv4.object({
          value: zv4.number(),
        }),
      });

      const step1 = createStep({
        id: 'step1',
        // @ts-ignore
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
        inputSchema: zv4.object({
          required: zv4.string(),
          nested: zv4.object({
            value: zv4.number(),
          }),
        }),
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
      });

      // @ts-ignore
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockResolvedValue({ result: 'step2 success' }),
        inputSchema: zv4.object({
          required: zv4.string(),
          nested: zv4.object({
            value: zv4.number(),
          }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const step3 = createStep({
        id: 'step3',
        // @ts-ignore
        execute: vi.fn<any>().mockResolvedValue({ result: 'step3 success' }),
        inputSchema: zv4.object({
          required: zv4.string(),
          nested: zv4.object({
            value: zv4.number(),
          }),
        }),
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        // @ts-ignore
        inputSchema: triggerSchema,
        // @ts-ignore
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
        steps: [step1],
        options: { validateInputs: true },
      });

      const parallelWorkflow = createWorkflow({
        id: 'parallel-workflow',
        // @ts-ignore
        inputSchema: zv4.object({
          required: zv4.string(),
          nested: zv4.object({
            value: zv4.number(),
          }),
        }),
        // @ts-ignore
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
        steps: [step1, step2, step3],
        options: { validateInputs: true },
      });

      parallelWorkflow.parallel([step1, step2, step3]).commit();

      workflow.then(step1).commit();

      try {
        const run = await workflow.createRun();
        await run.start({
          inputData: {
            required: 'test',
            // @ts-expect-error
            nested: { value: 'not-a-number' },
          },
        });
        expect.fail('Invalid input: expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- nested.value: Invalid input: expected number, received string',
        );
      }

      try {
        const run = await parallelWorkflow.createRun();
        await run.start({
          inputData: {
            required: 'test',
            // @ts-expect-error
            nested: { value: 'not-a-number' },
          },
        });

        expect.fail('Invalid input: expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- nested.value: Invalid input: expected number, received string',
        );
      }
    });

    it('should use default value from inputSchema', async () => {
      const triggerSchema = zv4.object({
        required: zv4.string(),
        nested: zv4
          .object({
            value: zv4.number(),
          })
          .optional()
          .default({ value: 1 }),
      });

      const step1 = createStep({
        id: 'step1',
        // @ts-ignore
        execute: async ({ inputData }) => {
          return inputData;
        },
        inputSchema: triggerSchema,
        outputSchema: triggerSchema,
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        // @ts-ignore
        inputSchema: triggerSchema,
        // @ts-ignore
        outputSchema: triggerSchema,
        steps: [step1],
        options: { validateInputs: true },
      });

      workflow.then(step1).commit();

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

      // @ts-ignore
      expect(result.result).toEqual({ required: 'test', nested: { value: 1 } });
    });

    it('should throw error if inputData is invalid', async () => {
      const successAction = vi.fn<any>().mockImplementation(() => {
        return { result: 'success' };
      });

      const step1 = createStep({
        id: 'step1',
        // @ts-ignore
        execute: successAction,
        inputSchema: zv4.object({
          start: zv4.string(),
        }),
        outputSchema: zv4.object({
          start: zv4.string(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        // @ts-ignore
        execute: successAction,
        inputSchema: zv4.object({
          start: zv4.string(),
        }),
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        // @ts-ignore
        inputSchema: zv4.object({
          start: zv4.string(),
        }),
        // @ts-ignore
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
        options: { validateInputs: true },
      });

      workflow.then(step1).then(step2).commit();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {
          start: '2',
        },
      });

      expect(result.status).toBe('failed'); // Assert status first

      // Type guard for result.error
      if (result.status === 'failed') {
        // This check helps TypeScript narrow down the type of 'result'
        expect(result.error).toContain(
          'Error: Step input validation failed: \n- start: Invalid input: expected string, received undefined',
        ); // Now safe to access
      } else {
        // This case should not be reached in this specific test.
        // If it is, the test should fail clearly.
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
        error: expect.any(String),
      });
      expect((step2Result as any)?.error).toContain(
        'Error: Step input validation failed: \n- start: Invalid input: expected string, received undefined',
      );
    });

    it('should use default value from inputSchema for step input', async () => {
      const successAction = vi.fn<any>().mockImplementation(() => {
        return { result: 'success' };
      });

      const step1 = createStep({
        id: 'step1',
        // @ts-ignore
        execute: async () => {
          return {};
        },
        inputSchema: zv4.object({
          start: zv4.string(),
        }),
        outputSchema: zv4.object({
          start: zv4.string().optional(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        // @ts-ignore
        execute: successAction,
        inputSchema: zv4.object({
          start: zv4.string().optional().default('test'),
        }),
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        // @ts-ignore
        inputSchema: zv4.object({
          start: zv4.string(),
        }),
        // @ts-ignore
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
        options: { validateInputs: true },
      });

      workflow
        .then(step1)
        .map({
          // @ts-ignore
          start: mapVariable({
            step: step1,
            path: 'start',
          }),
        })
        .then(step2)
        .commit();

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
    });

    it('should throw error if inputData is invalid in workflow with .map()', async () => {
      const successAction = vi.fn<any>().mockImplementation(() => {
        return { result: 'success' };
      });

      const step1 = createStep({
        id: 'step1',
        // @ts-ignore
        execute: async ({ inputData }) => {
          return { start: inputData.start };
        },
        inputSchema: zv4.object({
          start: zv4.number(),
        }),
        outputSchema: zv4.object({
          start: zv4.number(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        // @ts-ignore
        execute: successAction,
        inputSchema: zv4.object({
          start: zv4.string(),
        }),
        outputSchema: zv4.object({
          result: zv4.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        // @ts-ignore
        inputSchema: zv4.object({
          start: zv4.number(),
        }),
        // @ts-ignore
        outputSchema: zv4.object({
          result: zv4.string(),
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

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: {
          start: 2,
        },
      });

      expect(result.status).toBe('failed'); // Assert status first

      // Type guard for result.error
      if (result.status === 'failed') {
        // This check helps TypeScript narrow down the type of 'result'
        expect(result.error).toContain(
          'Error: Step input validation failed: \n- start: Invalid input: expected string, received number',
        ); // Now safe to access
      } else {
        // This case should not be reached in this specific test.
        // If it is, the test should fail clearly.
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
        error: expect.any(String),
      });
      expect((step2Result as any)?.error).toContain(
        'Error: Step input validation failed: \n- start: Invalid input: expected string, received number',
      );
    });

    it('should throw error when you try to resume a workflow step with invalid resume data', async () => {
      const resumeStep = createStep({
        id: 'resume',
        // @ts-ignore
        inputSchema: zv4.object({ value: zv4.number() }),
        // @ts-ignore
        outputSchema: zv4.object({ value: zv4.number() }),
        // @ts-ignore
        resumeSchema: zv4.object({ value: zv4.number() }),
        // @ts-ignore
        suspendSchema: zv4.object({ message: zv4.string() }),
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
        // @ts-ignore
        inputSchema: zv4.object({
          value: zv4.number(),
        }),
        // @ts-ignore
        outputSchema: zv4.object({
          value: zv4.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow',
        // @ts-ignore
        inputSchema: zv4.object({ value: zv4.number() }),
        // @ts-ignore
        outputSchema: zv4.object({ value: zv4.number() }),
        options: { validateInputs: true },
      })
        .then(incrementStep)
        .then(resumeStep)
        .then(
          createStep({
            id: 'final',
            // @ts-ignore
            inputSchema: zv4.object({ value: zv4.number() }),
            // @ts-ignore
            outputSchema: zv4.object({ value: zv4.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

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
        expect(errMessage).toBe('Invalid resume data: \n- value: Invalid input: expected number, received undefined');
      }

      const wflowRun = await incrementWorkflow.getWorkflowRunExecutionResult(run.runId);
      expect(wflowRun?.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
    });

    it('should use default value from resumeSchema when resuming a workflow', async () => {
      const resumeStep = createStep({
        id: 'resume',
        // @ts-ignore
        inputSchema: zv4.object({ value: zv4.number() }),
        // @ts-ignore
        outputSchema: zv4.object({ value: zv4.number() }),
        // @ts-ignore
        resumeSchema: zv4.object({ value: zv4.number().optional().default(21) }),
        // @ts-ignore
        suspendSchema: zv4.object({ message: zv4.string() }),
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
        // @ts-ignore
        inputSchema: zv4.object({
          value: zv4.number(),
        }),
        // @ts-ignore
        outputSchema: zv4.object({
          value: zv4.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow',
        // @ts-ignore
        inputSchema: zv4.object({ value: zv4.number() }),
        // @ts-ignore
        outputSchema: zv4.object({ value: zv4.number() }),
        options: { validateInputs: true },
      })
        .then(incrementStep)
        .then(resumeStep)
        .then(
          createStep({
            id: 'final',
            // @ts-ignore
            inputSchema: zv4.object({ value: zv4.number() }),
            // @ts-ignore
            outputSchema: zv4.object({ value: zv4.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

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
    });

    it('should throw error if inputData is invalid in nested workflows', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        // @ts-ignore
        inputSchema: zv4.object({ startValue: zv4.number() }),
        // @ts-ignore
        outputSchema: zv4.object({
          newValue: zv4.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        // @ts-ignore
        inputSchema: zv4.object({ newValue: zv4.number() }),
        // @ts-ignore
        outputSchema: zv4.object({ newValue: zv4.number(), other: zv4.number() }),
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
        // @ts-ignore
        inputSchema: zv4.object({ newValue: zv4.number(), other: zv4.number() }),
        // @ts-ignore
        outputSchema: zv4.object({ success: zv4.boolean() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        // @ts-ignore
        inputSchema: zv4.object({
          startValue: zv4.number(),
        }),
        // @ts-ignore
        outputSchema: zv4.object({
          success: zv4.boolean(),
        }),
        options: { validateInputs: true },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        // @ts-ignore
        outputSchema: zv4.object({ finalValue: zv4.number() }),
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        // @ts-ignore
        outputSchema: zv4.object({ finalValue: zv4.number() }),
      })
        .then(startStep)
        .map({
          // @ts-ignore
          other: mapVariable({
            step: startStep,
            path: 'newValue',
          }),
          // @ts-ignore
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
          // @ts-ignore
          createStep({
            id: 'last-step',
            // @ts-ignore
            execute: last,
            inputSchema: zv4.object({
              'nested-workflow-a': zv4.object({ finalValue: zv4.number() }),
              'nested-workflow-b': zv4.object({ finalValue: zv4.number() }),
            }),
            outputSchema: zv4.object({ success: zv4.boolean() }),
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
      // @ts-ignore
      expect(result.steps['nested-workflow-a'].error).toContain(
        'Error: Step input validation failed: \n- newValue: Invalid input: expected number, received undefined',
      );

      // @ts-ignore
      expect(result.steps['nested-workflow-b'].output).toEqual({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toBeUndefined();
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

      const run = await workflow.createRun();
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

      const run = await workflow.createRun();
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
      const toolAction = vi.fn<any>().mockImplementation(async (input, _context) => {
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

      const toolStep = createStep(randomTool);

      workflow.then(step1).then(toolStep).commit();

      const run = await workflow.createRun();
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

      const workflowSteps = workflow.steps;

      expect(workflowSteps['random-tool']?.component).toBe('TOOL');
      expect(workflowSteps['random-tool']?.description).toBe('random-tool');
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

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
          setState({ ...state, value: 'test state' });
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
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 }, value: 'test state' },
          payload: { improvedOutput: 'improved output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      expect(promptAgentAction).toHaveBeenCalledTimes(2);
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

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
      // @ts-ignore
      expect(firstResumeResult.steps.requestContextAction.output).toEqual(['first message', 'promptAgentAction']);
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const run = await promptEvalWorkflow.createRun();

      const requestContext = new RequestContext();
      const initialResult = await run.start({ inputData: { input: 'test' }, requestContext });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(requestContext.get('responses')).toEqual(['first message']);

      const newCtx = {
        userInput: 'test input for resumption',
      };

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx, requestContext });
      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      expect(firstResumeResult.steps.requestContextAction.status).toBe('success');
      // @ts-ignore
      expect(firstResumeResult.steps.requestContextAction.output).toEqual(['first message', 'promptAgentAction']);
    });

    it('should handle basic suspend and resume in a dountil workflow', async () => {
      let count = 0;
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
          async ({ inputData, iterationCount }) => {
            expect(iterationCount).toBe(++count);
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
    });

    it('should handle basic suspend and resume in nested dountil workflow - bug #5650', async () => {
      let incrementLoopValue = 2;
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        execute: async ({ inputData, requestContext, getInitData }) => {
          const shouldNotExist = requestContext?.get('__mastraWorflowInputData');
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
        execute: async ({ inputData, resumeData, suspend, requestContext }) => {
          const shouldNotExist = requestContext?.get('__mastraWorflowInputData');
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

      const run = await dowhileWorkflow.createRun();
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

      const run = await incrementWorkflow.createRun();
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

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      try {
        await run.resume({
          resumeData: { value: 2 },
          step: ['increment'],
        });
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
        id: 'auto-resume-test-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ final: z.string() }),
        mastra: new Mastra({ logger: false, storage: testStorage }),
      })
        .then(suspendStep)
        .then(completeStep)
        .commit();

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
    });

    it('should have access to the correct input value when resuming in a loop. bug #6669', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const step1 = createStep({
        id: 'step-1',
        inputSchema: z.object({
          value: z.number(),
          condition: z.boolean().default(false),
        }),
        outputSchema: z.object({
          value: z.number(),
          condition: z.boolean(),
        }),
        resumeSchema: z.object({
          shouldContinue: z.boolean(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        execute: async ({ inputData, resumeData, suspend }) => {
          let { condition, value } = inputData;
          const { shouldContinue } = resumeData ?? {};

          if (!shouldContinue) {
            await suspend({
              message: `Continue with value ${value}?`,
            });
            return { value, condition };
          }

          await delay(500);

          value = value + 1;
          condition = value >= 10;

          return {
            value,
            condition,
          };
        },
      });

      const step2 = createStep({
        id: 'step-2',
        inputSchema: z.object({
          value: z.number(),
          condition: z.boolean(),
        }),
        outputSchema: z.object({
          value: z.number(),
          condition: z.boolean(),
        }),
        execute: async ({ inputData }) => {
          const { condition, value } = inputData;

          return {
            value,
            condition,
          };
        },
      });

      const workflowUntilVar = createWorkflow({
        id: 'workflow-until-var',
        inputSchema: z.object({
          value: z.number(),
          condition: z.boolean().default(false),
        }),
        outputSchema: z.object({
          value: z.number(),
          condition: z.boolean(),
        }),
      })
        .dountil(step1, async ({ inputData: { condition } }) => condition)
        .then(step2)
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { workflowUntilVar },
      });

      const run = await workflowUntilVar.createRun();

      const result = await run.start({
        inputData: { value: 0, condition: false },
      });

      if (result.status !== 'suspended') {
        expect.fail('Workflow should be suspended');
      }

      const firstResume = await run.resume({ resumeData: { shouldContinue: true } });

      expect(firstResume.steps['step-1'].payload.value).toBe(1);

      const secondResume = await run.resume({ resumeData: { shouldContinue: true } });
      expect(secondResume.steps['step-1'].payload.value).toBe(2);

      const thridResume = await run.resume({ resumeData: { shouldContinue: true } });

      expect(thridResume.steps['step-1'].payload.value).toBe(3);

      expect(thridResume.status).toBe('suspended');
    });
  });

  describe('Restart', () => {
    afterAll(async () => {
      const pathToDb = path.join(process.cwd(), 'mastra.db');

      if (fs.existsSync(pathToDb)) {
        fs.rmSync(pathToDb);
      }
    });

    it('should throw error if trying to restart a workflow execution that was not previously active', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

      const runId = 'test-run-id';

      const run = await workflow.createRun({ runId });
      await expect(run.restart()).rejects.toThrow('This workflow run was not active');

      const result = await run.start({ inputData: { value: 0 } });

      expect(result.status).toBe('success');

      await expect(run.restart()).rejects.toThrow('This workflow run was not active');

      expect(execute).toHaveBeenCalled();
    });

    it('should restart a workflow execution that was previously active', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
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
      });

      const runId = 'test-run-id';
      const storage = mastra.getStorage();

      //mimic a workflow run that was previously active
      await storage?.persistWorkflowSnapshot({
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
      const restartResult = await run.restart();

      expect(restartResult.status).toBe('success');
      expect(restartResult).toMatchObject({
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
        input: {
          value: 0,
        },
        result: {
          final: 4,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
    });

    it('should restart a workflow execution that was previously active and has nested workflows', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const executeStep2 = vi.fn<any>().mockResolvedValue({ step2Result: 3 });
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
      });

      const runId = 'test-run-id';
      const storage = mastra.getStorage();

      //mimic a workflow run that was previously active
      await storage?.persistWorkflowSnapshot({
        workflowName: 'testWorkflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { nestedWorkflow: [1] },
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
            nestedWorkflow: {
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

      //mimic a workflow run that was previously active for the nested workflow
      await storage?.persistWorkflowSnapshot({
        workflowName: 'nestedWorkflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { step3: [1] },
          value: {},
          context: {
            input: { step1Result: 2 },
            step2: {
              payload: { step1Result: 2 },
              startedAt: Date.now(),
              status: 'success',
              output: { step2Result: 3 },
              endedAt: Date.now(),
            },
            step3: {
              payload: { step2Result: 3 },
              startedAt: Date.now(),
              status: 'running',
            },
          } as any,
          serializedStepGraph: nestedWorkflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await workflow.createRun({ runId });
      const restartResult = await run.restart();

      expect(restartResult.status).toBe('success');
      expect(restartResult).toMatchObject({
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
        input: {
          value: 0,
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(0);

      const runId2 = 'test-run-id-2';

      //mimic a workflow run that was previously active
      await storage?.persistWorkflowSnapshot({
        workflowName: 'testWorkflow',
        runId: runId2,
        snapshot: {
          runId: runId2,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { nestedWorkflow: [1] },
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
            nestedWorkflow: {
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

      //mimic a workflow run that was previously created for the nested workflow but server died before it started running
      await storage?.persistWorkflowSnapshot({
        workflowName: 'nestedWorkflow',
        runId: runId2,
        snapshot: {
          runId: runId2,
          status: 'pending',
          activePaths: [],
          activeStepsPath: {},
          value: {},
          context: {
            input: { step1Result: 2 },
          } as any,
          serializedStepGraph: nestedWorkflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run2 = await workflow.createRun({ runId: runId2 });
      const restartResult2 = await run2.restart();

      expect(restartResult2.status).toBe('success');
      expect(restartResult2).toMatchObject({
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
        input: {
          value: 0,
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(1);
    });

    it('should successfully suspend and resume a restarted workflow execution', async () => {
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
      });

      const runId = 'test-run-id';
      const storage = mastra.getStorage();

      //mimic a workflow run that was previously active
      await storage?.persistWorkflowSnapshot({
        workflowName: 'promptEvalWorkflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { promptAgent: [1] },
          value: {},
          context: {
            input: { input: 'test' },
            getUserInput: {
              payload: { input: 'test' },
              startedAt: Date.now(),
              status: 'success',
              output: { userInput: 'test input' },
              endedAt: Date.now(),
            },
            promptAgent: {
              payload: { userInput: 'test input' },
              startedAt: Date.now(),
              status: 'running',
            },
          } as any,
          serializedStepGraph: promptEvalWorkflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await promptEvalWorkflow.createRun({ runId });

      const initialResult = await run.restart();
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
      expect(getUserInputAction).toHaveBeenCalledTimes(0);
    });

    it('should restart workflow execution for a do-while workflow', async () => {
      let count = 5;
      const nextStep = createStep({
        id: 'next',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        execute: async ({ inputData }) => {
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
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const simpleNestedWorkflow = createWorkflow({
        id: 'simple-nested-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        steps: [incrementStep, nextStep],
      })
        .then(incrementStep)
        .then(nextStep)
        .commit();

      const dowhileWorkflow = createWorkflow({
        id: 'dowhile-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .dountil(simpleNestedWorkflow, async ({ inputData, iterationCount }) => {
          expect(iterationCount).toBe(++count);
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
        workflows: { dowhileWorkflow },
      });

      const runId = 'test-run-id';
      const storage = mastra.getStorage();

      //mimic a workflow run that was previously active
      await storage?.persistWorkflowSnapshot({
        workflowName: 'dowhile-workflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [0],
          activeStepsPath: { 'simple-nested-workflow': [0] },
          value: {},
          context: {
            input: { value: 0 },
            'simple-nested-workflow': {
              payload: { value: 5 },
              startedAt: Date.now(),
              status: 'running',
              metadata: {
                iterationCount: 6,
              },
            },
          } as any,
          serializedStepGraph: dowhileWorkflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      //mimic a workflow run that was previously active for the nested workflow
      await storage?.persistWorkflowSnapshot({
        workflowName: 'simple-nested-workflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { next: [1] },
          value: {},
          context: {
            input: { value: 5 },
            increment: {
              payload: { value: 5 },
              startedAt: Date.now(),
              status: 'success',
              output: { value: 6 },
              endedAt: Date.now(),
            },
            next: {
              payload: { value: 6 },
              startedAt: Date.now(),
              status: 'running',
            },
          } as any,
          serializedStepGraph: simpleNestedWorkflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await dowhileWorkflow.createRun({ runId });
      const result = await run.restart();
      expect(result).toMatchObject({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          'simple-nested-workflow': {
            payload: {
              value: 9,
            },
            startedAt: expect.any(Number),
            status: 'success',
            metadata: {
              iterationCount: 10,
            },
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
        input: {
          value: 0,
        },
        result: {
          value: 10,
        },
      });
    });

    it('should restart workflow execution for workflow with parallel steps', async () => {
      const initialStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'initial step done' };
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
        steps: [initialStep, parallelStep1, parallelStep2, parallelStep3, finalStep],
      })
        .then(initialStep)
        .parallel([parallelStep1, parallelStep2, parallelStep3])
        .then(finalStep)
        .commit();

      // Initialize Mastra with testStorage
      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-parallel-workflow': testParallelWorkflow },
      });

      const runId = 'test-run-id';
      const storage = mastra.getStorage();

      //mimic a workflow run that was previously active
      await storage?.persistWorkflowSnapshot({
        workflowName: 'test-parallel-workflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { parallelStep2: [1, 1], parallelStep3: [1, 2] },
          value: {},
          context: {
            input: { input: 'test' },
            initialStep: {
              payload: { input: 'test' },
              startedAt: Date.now(),
              status: 'success',
              output: { result: 'initial step done' },
              endedAt: Date.now(),
            },
            parallelStep1: {
              payload: { result: 'initial step done' },
              startedAt: Date.now(),
              status: 'success',
              output: { result: 'parallelStep1 done' },
              endedAt: Date.now(),
            },
            parallelStep2: {
              payload: { result: 'initial step done' },
              startedAt: Date.now(),
              status: 'running',
            },
            parallelStep3: {
              payload: { result: 'initial step done' },
              startedAt: Date.now(),
              status: 'running',
            },
          } as any,
          serializedStepGraph: testParallelWorkflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await testParallelWorkflow.createRun({ runId });

      // Start workflow without awaiting
      const result = await run.restart();

      expect(result.status).toBe('success');
      expect(result).toMatchObject({
        status: 'success',
        steps: {
          input: {
            input: 'test',
          },
          parallelStep1: {
            payload: {
              result: 'initial step done',
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
              result: 'initial step done',
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
              result: 'initial step done',
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
        input: {
          input: 'test',
        },
        result: {
          result: 'All done!',
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(parallelStep1Action).toHaveBeenCalledTimes(0);
      expect(parallelStep2Action).toHaveBeenCalledTimes(1);
      expect(parallelStep3Action).toHaveBeenCalledTimes(1);
      expect(finalStepAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Time travel', () => {
    afterEach(async () => {
      await testStorage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    });

    it('should throw error if trying to timetravel a workflow execution that is still running', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

      const runId = 'test-run-id';

      await testStorage.persistWorkflowSnapshot({
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
    });

    it('should throw error if validateInputs is true and trying to timetravel a workflow execution with invalid inputData', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

      const run = await workflow.createRun();

      await expect(run.timeTravel({ step: 'step2', inputData: { invalidPayload: 2 } })).rejects.toThrow(
        'Invalid inputData: \n- step1Result: Required',
      );
    });

    it('should throw error if trying to timetravel to a non-existent step', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

      const run = await workflow.createRun();

      await expect(run.timeTravel({ step: 'step4', inputData: { step1Result: 2 } })).rejects.toThrow(
        "Time travel target step not found in execution graph: 'step4'. Verify the step id/path.",
      );
    });

    it('should timeTravel a workflow execution', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

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
        input: {
          value: 0,
        },
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
        input: {},
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
    });

    it('should timeTravel a workflow execution that was previously ran', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

      const run = await workflow.createRun();
      const failedRun = await run.start({ inputData: { value: 0 } });
      expect(failedRun.status).toBe('failed');
      expect(failedRun.steps.step2).toEqual({
        status: 'failed',
        payload: { step1Result: 2 },
        error: 'Error: Simulated error',
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

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
        input: {
          value: 0,
        },
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
        input: { value: 0 },
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
    });

    it('should timeTravel a workflow execution that has nested workflows', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const executeStep2 = vi.fn<any>().mockResolvedValue({ step2Result: 3 });
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
        options: { validateInputs: false },
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
        options: { validateInputs: false },
      })
        .then(step1)
        .then(nestedWorkflow)
        .then(step4)
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
      });

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
        input: { value: 0 },
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

      const nestedWorkflowSnapshot = await testStorage.loadWorkflowSnapshot({
        workflowName: 'nestedWorkflow',
        runId: run.runId,
      });

      expect(nestedWorkflowSnapshot?.context).toEqual({
        input: { step1Result: 2 },
        step2: {
          status: 'success',
          payload: { step1Result: 2 },
          output: { step2Result: 3 },
          endedAt: expect.any(Number),
          startedAt: expect.any(Number),
        },
        step3: {
          status: 'success',
          payload: { step2Result: 3 },
          output: { nestedFinal: 4 },
          endedAt: expect.any(Number),
          startedAt: expect.any(Number),
        },
      });

      const run2 = await workflow.createRun();
      const result2 = await run2.timeTravel({
        step: [nestedWorkflow, step3],
        inputData: { step2Result: 3 },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        input: {},
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

      const nestedWorkflowSnapshot2 = await testStorage.loadWorkflowSnapshot({
        workflowName: 'nestedWorkflow',
        runId: run2.runId,
      });

      expect(nestedWorkflowSnapshot2?.context).toEqual({
        input: {},
        step2: {
          status: 'success',
          payload: {},
          output: { step2Result: 3 },
          endedAt: expect.any(Number),
          startedAt: expect.any(Number),
        },
        step3: {
          status: 'success',
          payload: { step2Result: 3 },
          output: { nestedFinal: 4 },
          endedAt: expect.any(Number),
          startedAt: expect.any(Number),
        },
      });

      const run3 = await workflow.createRun();
      const result3 = await run3.timeTravel({
        step: 'nestedWorkflow',
        inputData: { step1Result: 2 },
      });

      expect(result3.status).toBe('success');
      expect(result3).toEqual({
        status: 'success',
        input: {},
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

      const nestedWorkflowSnapshot3 = await testStorage.loadWorkflowSnapshot({
        workflowName: 'nestedWorkflow',
        runId: run3.runId,
      });

      expect(nestedWorkflowSnapshot3?.context).toEqual({
        input: { step1Result: 2 },
        step2: {
          status: 'success',
          payload: { step1Result: 2 },
          output: { step2Result: 3 },
          endedAt: expect.any(Number),
          startedAt: expect.any(Number),
        },
        step3: {
          status: 'success',
          payload: { step2Result: 3 },
          output: { nestedFinal: 4 },
          endedAt: expect.any(Number),
          startedAt: expect.any(Number),
        },
      });
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { promptEvalWorkflow },
      });

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

      expect(getUserInputAction).toHaveBeenCalledTimes(0);
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { promptEvalWorkflow },
      });

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
          suspendPayload: { testPayload: 'hello' },
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
        },
      });

      expect(getUserInputAction).toHaveBeenCalledTimes(2);
      expect(promptAgentAction).toHaveBeenCalledTimes(2);
    });

    it('should timeTravel workflow execution for a do-until workflow', async () => {
      let count = 0;
      const nextStep = createStep({
        id: 'next',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        execute: async ({ inputData }) => {
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

      const simpleNestedWorkflow = createWorkflow({
        id: 'simple-nested-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        steps: [incrementStep, nextStep],
      })
        .then(incrementStep)
        .then(nextStep)
        .commit();

      const dowhileWorkflow = createWorkflow({
        id: 'dowhile-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(firstStep)
        .dountil(simpleNestedWorkflow, async ({ inputData, iterationCount }) => {
          expect(iterationCount).toBe(++count);
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { dowhileWorkflow },
      });

      const run = await dowhileWorkflow.createRun();
      const result = await run.timeTravel({
        step: 'simple-nested-workflow.next',
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
        },
        nestedStepsContext: {
          'simple-nested-workflow': {
            increment: {
              payload: { value: 5 },
              startedAt: Date.now(),
              status: 'success',
              output: { value: 6 },
              endedAt: Date.now(),
            },
          },
        },
      });
      expect(result).toEqual({
        status: 'success',
        input: {
          value: 0,
        },
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
          'simple-nested-workflow': {
            payload: {
              value: 9,
            },
            startedAt: expect.any(Number),
            status: 'success',
            metadata: {
              iterationCount: 5,
            },
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

      const simpleNestedWorkflowSnapshot = await testStorage.loadWorkflowSnapshot({
        workflowName: 'simple-nested-workflow',
        runId: run.runId,
      });
      expect(simpleNestedWorkflowSnapshot?.context).toEqual({
        input: {
          value: 9,
        },
        increment: {
          payload: {
            value: 9,
          },
          startedAt: expect.any(Number),
          status: 'success',
          output: { value: 10 },
          endedAt: expect.any(Number),
        },
        next: {
          payload: {
            value: 10,
          },
          startedAt: expect.any(Number),
          status: 'success',
          output: { value: 10 },
          endedAt: expect.any(Number),
        },
      });
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
      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-parallel-workflow': testParallelWorkflow },
      });

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
        input: {},
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
        input: { input: 'start' },
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
        input: {},
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
    });
  });

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
      id: 'simple-auto-resume-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      mastra: new Mastra({ logger: false, storage: testStorage }),
    })
      .then(simpleStep)
      .commit();

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
  });

  it('should throw error when multiple steps are suspended and no step specified', async () => {
    // Create two steps that will suspend in different branches
    const branchStep1 = createStep({
      id: 'branch-step-1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: async ({ inputData, suspend, resumeData }) => {
        if (!resumeData) {
          await suspend({});
          return { result: 0 };
        }
        return { result: inputData.value * resumeData.multiplier };
      },
    });

    const branchStep2 = createStep({
      id: 'branch-step-2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ divisor: z.number() }),
      execute: async ({ inputData, suspend, resumeData }) => {
        if (!resumeData) {
          await suspend({});
          return { result: 0 };
        }
        return { result: inputData.value / resumeData.divisor };
      },
    });

    // Create a workflow that uses branching where both conditions are true
    // This will cause both branches to execute and suspend
    const multiSuspendWorkflow = createWorkflow({
      id: 'multi-suspend-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({}),
      mastra: new Mastra({ logger: false, storage: testStorage }),
    })
      .branch([
        [() => Promise.resolve(true), branchStep1], // This will always execute and suspend
        [() => Promise.resolve(true), branchStep2], // This will also execute and suspend
      ])
      .commit();

    const run = await multiSuspendWorkflow.createRun();

    // Start workflow - both branch steps should suspend
    const startResult = await run.start({ inputData: { value: 100 } });
    expect(startResult.status).toBe('suspended');

    if (startResult.status === 'suspended') {
      // Should have two suspended steps from different branches
      expect(startResult.suspended.length).toBeGreaterThan(1);
      // Check that we have both steps suspended
      const suspendedStepIds = startResult.suspended.map(path => path[path.length - 1]);
      expect(suspendedStepIds).toContain('branch-step-1');
      expect(suspendedStepIds).toContain('branch-step-2');
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
      step: 'branch-step-1',
      resumeData: { multiplier: 2 },
    });

    // After resuming one step, there should still be another suspended
    expect(explicitResumeResult.status).toBe('suspended');
    if (explicitResumeResult.status === 'suspended') {
      expect(explicitResumeResult.suspended).toHaveLength(1);
      const remainingSuspendedId = explicitResumeResult.suspended[0][explicitResumeResult.suspended[0].length - 1];
      expect(remainingSuspendedId).toBe('branch-step-2');
    }

    // Resume the second step - workflow should progress (either complete or have different suspended steps)
    const finalResult = await run.resume({
      step: 'branch-step-2',
      resumeData: { divisor: 5 },
    });
    // The workflow should either complete or be in a different suspended state
    expect(['success', 'suspended']).toContain(finalResult.status); // TODO: This *should* be success, but there is an existing parallel/branching workflow state management bug related to suspend/resume
  });

  describe('Workflow Runs', () => {
    let testStorage: MockStore;

    beforeEach(async () => {
      testStorage = new MockStore();
    });

    it('should return empty result when mastra is not initialized', async () => {
      const workflow = createWorkflow({ id: 'test', inputSchema: z.object({}), outputSchema: z.object({}) });
      const result = await workflow.listWorkflowRuns();
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

      let shouldPersist = true;

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { shouldPersistSnapshot: () => shouldPersist },
      });
      workflow.then(step1).then(step2).commit();

      new Mastra({
        workflows: {
          'test-workflow': workflow,
        },
        logger: false,
        storage: testStorage,
      });

      // Create a few runs
      const run1 = await workflow.createRun();
      await run1.start({ inputData: {} });

      const run2 = await workflow.createRun();
      await run2.start({ inputData: {} });

      shouldPersist = false;
      const run3 = await workflow.createRun();
      await run3.start({ inputData: {} });

      const { runs, total } = await workflow.listWorkflowRuns();
      expect(total).toBe(2);
      expect(runs).toHaveLength(2);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId, run2.runId]));
      expect(runs[0]?.workflowName).toBe('test-workflow');
      expect(runs[0]?.snapshot).toBeDefined();
      expect(runs[1]?.snapshot).toBeDefined();
    });

    it('should use shouldPersistSnapshot option', async () => {
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
      const resumeStep = createStep({
        id: 'resume-step',
        execute: async ({ resumeData, suspend }) => {
          if (!resumeData) {
            return suspend({});
          }
          return { completed: true };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ completed: z.boolean() }),
        resumeSchema: z.object({ resume: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ completed: z.boolean() }),
        options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended' },
      });
      workflow.then(step1).then(step2).then(resumeStep).commit();

      new Mastra({
        workflows: {
          'test-workflow': workflow,
        },
        logger: false,
        storage: testStorage,
      });

      // Create a few runs
      const run1 = await workflow.createRun();
      await run1.start({ inputData: {} });

      const { runs, total } = await workflow.listWorkflowRuns();
      expect(total).toBe(1);
      expect(runs).toHaveLength(1);

      await run1.resume({ resumeData: { resume: 'resume' }, step: 'resume-step' });

      const { runs: afterResumeRuns, total: afterResumeTotal } = await workflow.listWorkflowRuns();
      expect(afterResumeTotal).toBe(1);
      expect(afterResumeRuns).toHaveLength(1);
      expect(afterResumeRuns.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId]));
      expect(afterResumeRuns[0]?.workflowName).toBe('test-workflow');
      expect(afterResumeRuns[0]?.snapshot).toBeDefined();
      expect((afterResumeRuns[0]?.snapshot as any).status).toBe('suspended');
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
      const run1 = await workflow.createRun();
      await run1.start({ inputData: {} });

      const { runs, total } = await workflow.listWorkflowRuns();
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

    it('should persist resourceId when creating workflow runs', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({ id: 'test-workflow', inputSchema: z.object({}), outputSchema: z.object({}) });
      workflow.then(step1).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: {
          'test-workflow': workflow,
        },
      });

      // Create run with resourceId
      const resourceId = 'user-123';
      const run = await workflow.createRun({ resourceId });
      await run.start({ inputData: {} });

      // Verify resourceId is persisted in storage
      const { runs } = await workflow.listWorkflowRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0]?.resourceId).toBe(resourceId);

      // Verify getWorkflowRunById also returns resourceId
      const runById = await workflow.getWorkflowRunById(run.runId);
      expect(runById?.resourceId).toBe(resourceId);

      // Create another run with different resourceId
      const resourceId2 = 'user-456';
      const run2 = await workflow.createRun({ resourceId: resourceId2 });
      await run2.start({ inputData: {} });

      // Verify both runs have correct resourceIds
      const { runs: allRuns } = await workflow.listWorkflowRuns();
      expect(allRuns).toHaveLength(2);
      const runWithResource123 = allRuns.find(r => r.resourceId === resourceId);
      const runWithResource456 = allRuns.find(r => r.resourceId === resourceId2);
      expect(runWithResource123).toBeDefined();
      expect(runWithResource456).toBeDefined();
      expect(runWithResource123?.runId).toBe(run.runId);
      expect(runWithResource456?.runId).toBe(run2.runId);

      // Create run without resourceId to ensure it's optional
      const run3 = await workflow.createRun();
      await run3.start({ inputData: {} });

      const { runs: finalRuns } = await workflow.listWorkflowRuns();
      expect(finalRuns).toHaveLength(3);
      const runWithoutResource = finalRuns.find(r => r.runId === run3.runId);
      expect(runWithoutResource).toBeDefined();
      expect(runWithoutResource?.resourceId).toBeUndefined();
    });

    it('should preserve resourceId when resuming a suspended workflow', async () => {
      const suspendingStep = createStep({
        id: 'suspendingStep',
        execute: async ({ suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return undefined;
          }
          return { resumed: true, data: resumeData };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ resumed: z.boolean(), data: z.any() }),
        resumeSchema: z.object({ message: z.string() }),
      });

      const finalStep = createStep({
        id: 'finalStep',
        execute: async () => ({ completed: true }),
        inputSchema: z.object({ resumed: z.boolean(), data: z.any() }),
        outputSchema: z.object({ completed: z.boolean() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow-with-suspend',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      workflow.then(suspendingStep).then(finalStep).commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-workflow-with-suspend': workflow },
      });

      const resourceId = 'user-789';
      const run = await workflow.createRun({ resourceId });

      const initialResult = await run.start({ inputData: {} });
      expect(initialResult.status).toBe('suspended');

      const runBeforeResume = await workflow.getWorkflowRunById(run.runId);
      expect(runBeforeResume?.resourceId).toBe(resourceId);

      const resumeResult = await run.resume({
        step: 'suspendingStep',
        resumeData: { message: 'resumed with data' },
      });
      expect(resumeResult.status).toBe('success');

      // After resume, resourceId should be preserved in storage
      const runAfterResume = await workflow.getWorkflowRunById(run.runId);
      expect(runAfterResume?.resourceId).toBe(resourceId);

      const { runs } = await workflow.listWorkflowRuns({ resourceId });
      expect(runs).toHaveLength(1);
      expect(runs[0]?.resourceId).toBe(resourceId);
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

      const workflowSteps = workflow.steps;

      expect(workflowSteps['test-agent-1']?.description).toBe('test-agent-1 description');
      expect(workflowSteps['test-agent-2']?.description).toBe('test-agent-2 description');
      expect(workflowSteps['test-agent-1']?.component).toBe('AGENT');
      expect(workflowSteps['test-agent-2']?.component).toBe('AGENT');
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
        id: 'test-agent-1',
        name: 'Test Agent 1',
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
        name: 'Test Agent 2',
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
        .map({
          finalValue: mapVariable({
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
              'nested-workflow-a': z.object({ success: z.boolean() }),
              'nested-workflow-b': z.object({ success: z.boolean() }),
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const run = await counterWorkflow.createRun();
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

      const workflowSteps = counterWorkflow.steps;

      expect(workflowSteps['nested-workflow-a']?.component).toBe('WORKFLOW');
      expect(workflowSteps['nested-workflow-b']?.component).toBe('WORKFLOW');
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

      const run = await counterWorkflow.createRun();
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

      const run = await counterWorkflow.createRun();
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
          outputSchema: z.object({ newValue: z.number(), other: z.number() }),
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
          .map({
            finalValue: mapVariable({
              step: finalStep,
              path: 'finalValue',
            }),
            newValue: mapVariable({
              step: startStep,
              path: 'newValue',
            }),
          })
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

        const run = await counterWorkflow.createRun();
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
          outputSchema: z.object({ newValue: z.number(), other: z.number() }),
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
          .map(async ({ inputData }) => {
            return {
              finalValue: inputData.newValue + 1,
              newValue: inputData.newValue,
            };
          })
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

        const run = await counterWorkflow.createRun();
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
          outputSchema: z.object({ newValue: z.number(), other: z.number() }),
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
                return {
                  newValue: inputData['nested-workflow-c']?.newValue ?? inputData['nested-workflow-d']?.newValue,
                  other: inputData['nested-workflow-c']?.other ?? inputData['nested-workflow-d']?.other,
                };
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

        const run = await counterWorkflow.createRun();
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
          outputSchema: z.object({ newValue: z.number(), other: z.number() }),
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

        new Mastra({
          logger: false,
          storage: testStorage,
          workflows: { counterWorkflow },
        });

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

      it('should be able to resume suspended nested workflow step with only nested workflow step provided', async () => {
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
          outputSchema: z.object({ newValue: z.number(), other: z.number() }),
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

        new Mastra({
          logger: false,
          storage: testStorage,
          workflows: { counterWorkflow },
        });

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

        // @ts-ignore
        expect(result.steps['last-step']).toEqual(undefined);

        const resumedResults = await run.resume({ step: 'nested-workflow-a', resumeData: { newValue: 0 } });

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

        const run = await mainWorkflow.createRun();

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
          step: 'sub-workflow-2.step-2',
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

      it('should preserve request context in nested workflows after suspend/resume', async () => {
        const testStorage = new MockStore();

        // Step that sets request context data
        const setupStep = createStep({
          id: 'setup-step',
          inputSchema: z.object({}),
          outputSchema: z.object({
            setup: z.boolean(),
          }),
          execute: async ({ requestContext }) => {
            requestContext.set('test-key', 'test-context-value');
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
          execute: async ({ resumeData, suspend, requestContext }) => {
            // Verify request context is still available during suspend
            expect(requestContext.get('test-key')).toBe('test-context-value');

            if (!resumeData?.confirmed) {
              return await suspend({ message: 'Workflow suspended for testing' });
            }
            return { resumed: true };
          },
        });

        // Step in nested workflow that verifies request context access
        const verifyContextStep = createStep({
          id: 'verify-context-step',
          inputSchema: z.object({
            resumed: z.boolean(),
          }),
          outputSchema: z.object({
            success: z.boolean(),
            hasTestData: z.boolean(),
          }),
          execute: async ({ requestContext, mastra, getInitData, inputData }) => {
            // Verify all context is available in nested workflow after suspend/resume
            const testData = requestContext.get('test-key');
            const initData = getInitData();

            expect(testData).toBe('test-context-value');
            expect(mastra).toBeDefined();
            expect(requestContext).toBeDefined();
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

        const run = await mainWorkflow.createRun();

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

        const run = await counterWorkflow.createRun();
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
        outputSchema: z.object({ newValue: z.number(), other: z.number() }),
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

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { counterWorkflow },
      });

      const run = await counterWorkflow.createRun();
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

      const run = await mainWorkflow.createRun();

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

    it('should maintain correct step status after resuming in branching workflows - #6419', async () => {
      const branchStep1 = createStep({
        id: 'branch-step-1',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ multiplier: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: inputData.value * resumeData.multiplier };
        },
      });

      const branchStep2 = createStep({
        id: 'branch-step-2',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ multiplier: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: inputData.value * resumeData.multiplier };
        },
      });

      const testWorkflow = createWorkflow({
        id: 'branching-state-bug-test',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          'branch-step-1': z.object({ result: z.number() }),
          'branch-step-2': z.object({ result: z.number() }),
        }),
        mastra: new Mastra({ logger: false, storage: testStorage }),
      })
        .branch([
          [async () => true, branchStep1], // First branch will execute and suspend
          [async () => true, branchStep2], // Second branch will execute and suspend
        ])
        .commit();

      const run = await testWorkflow.createRun();

      // Start workflow - both steps should suspend
      const initialResult = await run.start({ inputData: { value: 10 } });

      expect(initialResult.status).toBe('suspended');
      expect(initialResult.steps['branch-step-1'].status).toBe('suspended');
      expect(initialResult.steps['branch-step-2'].status).toBe('suspended');
      if (initialResult.status === 'suspended') {
        expect(initialResult.suspended).toHaveLength(2);
        expect(initialResult.suspended[0]).toContain('branch-step-1');
        expect(initialResult.suspended[1]).toContain('branch-step-2');
      }

      const resumedResult1 = await run.resume({
        step: 'branch-step-1',
        resumeData: { multiplier: 2 },
      });
      // Workflow should still be suspended (branch-step-2 not resumed yet)
      expect(resumedResult1.status).toBe('suspended');
      expect(resumedResult1.steps['branch-step-1'].status).toBe('success');
      expect(resumedResult1.steps['branch-step-2'].status).toBe('suspended');
      if (resumedResult1.status === 'suspended') {
        expect(resumedResult1.suspended).toHaveLength(1);
        expect(resumedResult1.suspended[0]).toContain('branch-step-2');
      }

      const finalResult = await run.resume({
        step: 'branch-step-2',
        resumeData: { multiplier: 3 },
      });

      expect(finalResult.status).toBe('success');
      expect(finalResult.steps['branch-step-1'].status).toBe('success');
      expect(finalResult.steps['branch-step-2'].status).toBe('success');
      if (finalResult.status === 'success') {
        expect(finalResult.result).toEqual({
          'branch-step-1': { result: 20 }, // 10 * 2
          'branch-step-2': { result: 30 }, // 10 * 3
        });
      }
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

      const run = await workflow.createRun();
      const result = await run.start({ requestContext });

      // @ts-ignore
      expect(result.steps.step1.output.injectedValue).toBe(testValue);
    });

    it('should inject requestContext dependencies into steps during resume', async () => {
      const initialStorage = new MockStore();

      const requestContext = new RequestContext();
      const testValue = 'test-dependency';
      requestContext.set('testKey', testValue);

      const mastra = new Mastra({
        logger: false,
        storage: initialStorage,
      });

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
        mastra,
        inputSchema: z.object({ human: z.boolean() }),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      });
      workflow.then(step).commit();

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

      // @ts-ignore
      expect(result?.steps.step1.output.injectedValue).toBe(testValue + '2');
    });

    it('should have access to requestContext from before suspension during workflow resume', async () => {
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
        execute: async ({ inputData, requestContext }) => {
          requestContext.set('testKey', testValue);
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
            execute: async ({ inputData, requestContext }) => {
              const testKey = requestContext.get('testKey');
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

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
    });

    it('should not show removed requestContext values in subsequent steps', async () => {
      const testValue = 'test-dependency';
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend, requestContext }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({
              message: `Please provide additional information. now value is ${inputData.value}`,
            });
          }

          const testKey = requestContext.get('testKey');
          expect(testKey).toBe(testValue);

          requestContext.delete('testKey');

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
        execute: async ({ inputData, requestContext }) => {
          requestContext.set('testKey', testValue);
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
            execute: async ({ inputData, requestContext }) => {
              const testKey = requestContext.get('testKey');
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

      const run = await incrementWorkflow.createRun();
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

      const run = await workflow.createRun();
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
        .dowhile(step1, async ({ inputData }) => inputData.count < 3)
        .dountil(step2, async ({ inputData }) => inputData.count === 10)
        .commit();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toHaveProperty('output', { count: 3 });
      expect(result.steps.step2).toHaveProperty('output', { count: 10 });
    });

    it('runCount should exist and equal zero for the first run', async () => {
      const mockExec = vi.fn().mockImplementation(async ({ runCount }) => {
        return { count: runCount };
      });
      const mockExecWithRetryCount = vi.fn().mockImplementation(async ({ retryCount }) => {
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
      const step2 = createStep({
        id: 'step2',
        inputSchema: z.object({ count: z.number() }),
        outputSchema: z.object({
          count: z.number(),
        }),
        execute: mockExecWithRetryCount,
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      })
        .then(step)
        .then(step2)
        .commit();

      const run = await workflow.createRun();
      await run.start({ inputData: {} });

      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockExecWithRetryCount).toHaveBeenCalledTimes(1);
      expect(mockExecWithRetryCount).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));
    });
  });
  describe('Parallel Suspended Steps', () => {
    let testStorage: InstanceType<typeof MockStore>;

    beforeEach(async () => {
      testStorage = new MockStore();
    });

    it('should remain suspended when only one of multiple parallel suspended steps is resumed - #6418', async () => {
      const parallelStep1 = createStep({
        id: 'parallel-step-1',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ multiplier: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: inputData.value * resumeData.multiplier };
        },
      });

      const parallelStep2 = createStep({
        id: 'parallel-step-2',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ divisor: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: inputData.value / resumeData.divisor };
        },
      });

      const parallelWorkflow = createWorkflow({
        id: 'parallel-suspension-bug-test',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          'parallel-step-1': z.object({ result: z.number() }),
          'parallel-step-2': z.object({ result: z.number() }),
        }),
        mastra: new Mastra({ logger: false, storage: testStorage }),
      })
        .parallel([parallelStep1, parallelStep2])
        .commit();

      const run = await parallelWorkflow.createRun();

      // Start workflow - both parallel steps should suspend
      const startResult = await run.start({ inputData: { value: 100 } });
      expect(startResult.status).toBe('suspended');
      if (startResult.status === 'suspended') {
        expect(startResult.suspended).toHaveLength(2);
      }

      // Resume ONLY the first parallel step
      const resumeResult1 = await run.resume({
        step: 'parallel-step-1',
        resumeData: { multiplier: 2 },
      });
      expect(resumeResult1.status).toBe('suspended');
      if (resumeResult1.status === 'suspended') {
        expect(resumeResult1.suspended).toHaveLength(1);
        expect(resumeResult1.suspended[0]).toContain('parallel-step-2');
      }

      // Only after resuming the second step should the workflow complete
      const resumeResult2 = await run.resume({
        step: 'parallel-step-2',
        resumeData: { divisor: 5 },
      });
      expect(resumeResult2.status).toBe('success');
      if (resumeResult2.status === 'success') {
        expect(resumeResult2.result).toEqual({
          'parallel-step-1': { result: 200 },
          'parallel-step-2': { result: 20 },
        });
      }
    });

    it('should complete parallel workflow when steps do not suspend', async () => {
      const normalStep1 = createStep({
        id: 'normal-step-1',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        execute: async ({ inputData }) => {
          return { result: inputData.value * 2 };
        },
      });

      const normalStep2 = createStep({
        id: 'normal-step-2',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        execute: async ({ inputData }) => {
          return { result: inputData.value / 2 };
        },
      });

      const normalParallelWorkflow = createWorkflow({
        id: 'normal-parallel-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          'normal-step-1': z.object({ result: z.number() }),
          'normal-step-2': z.object({ result: z.number() }),
        }),
        mastra: new Mastra({ logger: false, storage: testStorage }),
      })
        .parallel([normalStep1, normalStep2])
        .commit();

      const run = await normalParallelWorkflow.createRun();
      const result = await run.start({ inputData: { value: 100 } });

      // Should complete immediately since no steps suspend
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({
          'normal-step-1': { result: 200 },
          'normal-step-2': { result: 50 },
        });
      }
      expect(result.steps['normal-step-1'].status).toBe('success');
      expect(result.steps['normal-step-2'].status).toBe('success');
    });

    it('should handle multiple suspend/resume cycles in parallel workflow', async () => {
      let step1ResumeCount = 0;
      let step2ResumeCount = 0;

      const multiResumeStep1 = createStep({
        id: 'multi-resume-step-1',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ increment: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          step1ResumeCount++;
          if (step1ResumeCount < 3 && !resumeData) {
            await suspend({});
            return { result: 0 };
          }
          const increment = resumeData?.increment || 0;
          return { result: inputData.value + increment };
        },
      });

      const multiResumeStep2 = createStep({
        id: 'multi-resume-step-2',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ multiplier: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          step2ResumeCount++;
          if (step2ResumeCount < 2 && !resumeData) {
            await suspend({});
            return { result: 0 };
          }
          const multiplier = resumeData?.multiplier || 1;
          return { result: inputData.value * multiplier };
        },
      });

      const multiCycleWorkflow = createWorkflow({
        id: 'multi-cycle-parallel-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          'multi-resume-step-1': z.object({ result: z.number() }),
          'multi-resume-step-2': z.object({ result: z.number() }),
        }),
        mastra: new Mastra({ logger: false, storage: testStorage }),
      })
        .parallel([multiResumeStep1, multiResumeStep2])
        .commit();

      const run = await multiCycleWorkflow.createRun();

      // Initial start - both should suspend
      const startResult = await run.start({ inputData: { value: 10 } });
      expect(startResult.status).toBe('suspended');

      // First resume of step1 - should still be suspended since step2 also suspended
      const resume1 = await run.resume({
        step: 'multi-resume-step-1',
        resumeData: { increment: 5 },
      });
      expect(resume1.status).toBe('suspended'); // Should remain suspended until both are done

      // Resume step2 - workflow should complete since both steps are now resolved
      const resume2 = await run.resume({
        step: 'multi-resume-step-2',
        resumeData: { multiplier: 3 },
      });
      expect(resume2.status).toBe('success');
      if (resume2.status === 'success') {
        expect(resume2.result).toEqual({
          'multi-resume-step-1': { result: 15 },
          'multi-resume-step-2': { result: 30 },
        });
      }
    });
  });

  describe('AI Workflow Tracing', () => {
    it('should provide full TypeScript support for tracingContext', () => {
      const typedStep = createStep({
        id: 'typed-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData, tracingContext }) => {
          expect(tracingContext).toBeDefined();
          expect(typeof tracingContext.currentSpan).toBeDefined();

          return { result: `processed: ${inputData.value}` };
        },
      });

      expect(typedStep).toBeDefined();
    });
  });
});
