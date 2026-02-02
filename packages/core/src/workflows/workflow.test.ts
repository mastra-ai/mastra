import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from '../loop/test-utils/MastraLanguageModelV2Mock';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import type { ChunkType, StreamEvent } from './types';
import { cloneStep, createStep, createWorkflow } from './workflow';

/**
 * Default engine-specific workflow tests.
 *
 * Tests for general workflow behavior (basic execution, conditions, loops, etc.)
 * are covered by the shared test suite in workflows/_test-utils/src/index.test.ts.
 *
 * This file contains only tests specific to the default engine implementation:
 * - Streaming (uses real streamLegacy and stream APIs with specific event structures)
 * - Restart (skipped in shared suite - requires Mastra integration for state persistence)
 * - Agent as step (uses real Agent with MockLanguageModelV1)
 * - Agent TripWire (uses real Agent with input/output processors)
 * - Agent structured output (uses real Agent with structuredOutput schema)
 * - startAsync (default engine specific API)
 */

const testStorage = new MockStore();

vi.mock('crypto', () => {
  return {
    randomUUID: vi.fn(() => 'mock-uuid-1'),
  };
});

describe('Workflow (Default Engine Specifics)', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    let counter = 0;
    (randomUUID as vi.Mock).mockImplementation(() => {
      return `mock-uuid-${++counter}`;
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
        idGenerator: () => randomUUID(),
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
  });

  describe('Streaming (vNext)', () => {
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
      const streamResult = run.stream({
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
  });

  describe('Restart', () => {
    afterAll(async () => {
      const pathToDb = path.join(process.cwd(), 'mastra.db');

      if (fs.existsSync(pathToDb)) {
        fs.rmSync(pathToDb);
      }
    });

    it('should throw error if trying to restart a workflow execution that was not previously active', async () => {
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
      });

      const runId = 'test-run-id';
      const storage = mastra.getStorage();
      const workflowsStore = await storage?.getStore('workflows');
      expect(workflowsStore).toBeDefined();

      //mimic a workflow run that was previously active
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

  describe('Agent TripWire in Workflow', () => {
    it('should bubble up tripwire from agent input processor to workflow result', async () => {
      const tripwireProcessor = {
        id: 'tripwire-processor',
        name: 'Tripwire Processor',
        processInput: async ({ messages, abort }: any) => {
          // Check for blocked content
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
        id: 'tripwire-test-agent',
        name: 'Tripwire Test Agent',
        instructions: 'You are helpful',
        model: mockModel,
        inputProcessors: [tripwireProcessor],
      });

      const workflow = createWorkflow({
        id: 'agent-tripwire-workflow',
        inputSchema: z.object({
          prompt: z.string(),
        }),
        outputSchema: z.object({
          text: z.string(),
        }),
      });

      const agentStep = createStep(agent);

      workflow.then(agentStep).commit();

      const run = await workflow.createRun();

      const result = await run.start({
        inputData: { prompt: 'This message contains blocked content' },
      });

      // Workflow should return tripwire status
      expect(result.status).toBe('tripwire');
      if (result.status === 'tripwire') {
        expect(result.tripwire.reason).toBe('Content blocked by policy');
        expect(result.tripwire.retry).toBe(true);
        expect(result.tripwire.processorId).toBe('tripwire-processor');
      }
    });
  });

  describe('Agent step with structured output schema', () => {
    it('should pass structured output from agent step to next step with correct types', async () => {
      // Define the structured output schema for the agent
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

      // Mock agent using V2 model that properly supports structured output
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

      // Create agent step WITH structuredOutput schema
      const agentStep = createStep(agent, {
        structuredOutput: {
          schema: articleSchema,
        },
      });

      // This step receives the structured output from the agent directly
      const processArticleStep = createStep({
        id: 'process-article',
        description: 'Process the generated article',
        inputSchema: articleSchema,
        outputSchema: z.object({
          processed: z.boolean(),
          tagCount: z.number(),
        }),
        execute: async ({ inputData }) => {
          // inputData should have title, summary, tags - not just text
          return {
            processed: true,
            tagCount: inputData.tags.length,
          };
        },
      });

      const workflow = createWorkflow({
        id: 'article-workflow',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ processed: z.boolean(), tagCount: z.number() }),
        steps: [agentStep, processArticleStep],
      });

      new Mastra({
        workflows: { 'article-workflow': workflow },
        agents: { 'article-generator': agent },
        idGenerator: randomUUID,
      });

      // Chain directly - no map needed if outputSchema matches inputSchema
      workflow.then(agentStep).then(processArticleStep).commit();

      const run = await workflow.createRun({ runId: 'structured-output-test' });
      const result = await run.start({
        inputData: { prompt: 'Generate an article about testing' },
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({
          processed: true,
          tagCount: 2,
        });
      }
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

      new Mastra({
        storage: testStorage,
        workflows: { 'test-startAsync-workflow': workflow },
      });

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
    });
  });
});
