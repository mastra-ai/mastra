import { MockLanguageModelV1 } from 'ai/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { RuntimeContext } from '../../runtime-context';
import { createWorkflow, createStep } from '../../workflows';
import { createScorer } from '../base';
import type { MastraScorer } from '../base';
import { runExperiment } from '.';

const createMockScorer = (name: string, score: number = 0.8): MastraScorer => {
  const scorer = createScorer({
    description: 'Mock scorer',
    name,
  }).generateScore(() => {
    console.log('Generating name', name, score);
    return score;
  });

  vi.spyOn(scorer, 'run');

  return scorer;
};

const createMockAgent = (response: string = 'Dummy response'): Agent => {
  const dummyModel = new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: response,
    }),
  });

  const agent = new Agent({
    name: 'mockAgent',
    instructions: 'Mock agent',
    model: dummyModel,
  });

  // Add a spy to the generate method (without mocking the return value)
  vi.spyOn(agent, 'generate');

  return agent;
};

const createMockAgentV2 = (response: string = 'Dummy response'): Agent => {
  const dummyModel = new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: response },
        { type: 'text-delta', id: '1', delta: `sup` },
        { type: 'text-end', id: '1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });

  const agent = new Agent({
    name: 'mockAgent',
    instructions: 'Mock agent',
    model: dummyModel,
  });

  // Add a spy to the generate method (without mocking the return value)
  vi.spyOn(agent, 'generateVNext');

  return agent;
};

describe('runExperiment', () => {
  let mockAgent: Agent;
  let mockScorers: MastraScorer[];
  let testData: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent = createMockAgent();
    mockScorers = [createMockScorer('toxicity', 0.9), createMockScorer('relevance', 0.7)];
    testData = [
      { input: 'Test input 1', groundTruth: 'Expected 1' },
      { input: 'Test input 2', groundTruth: 'Expected 2' },
    ];
  });

  describe('Basic functionality', () => {
    it('should run experiment with single scorer', async () => {
      const result = await runExperiment({
        data: testData,
        scorers: [createMockScorer('toxicity', 0.9)],
        target: mockAgent,
      });

      expect(result.scores.toxicity).toBe(0.9);
      expect(result.summary.totalItems).toBe(2);
    });

    it('should run experiment with multiple scorers', async () => {
      const result = await runExperiment({
        data: testData,
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(result.scores.toxicity).toBe(0.9);
      expect(result.scores.relevance).toBe(0.7);
      expect(result.summary.totalItems).toBe(2);
    });

    it('should calculate average scores correctly', async () => {
      const scorers = [createMockScorer('test', 0.8)];
      // Mock different scores for different items
      scorers[0].run = vi
        .fn()
        .mockResolvedValueOnce({ score: 0.6, reason: 'test' })
        .mockResolvedValueOnce({ score: 1.0, reason: 'test' });

      const result = await runExperiment({
        data: testData,
        scorers,
        target: mockAgent,
      });

      expect(result.scores.test).toBe(0.8);
    });
  });

  describe('V2 Agent integration', () => {
    it('should call agent.generate with correct parameters', async () => {
      const mockAgent = createMockAgentV2();
      await runExperiment({
        data: [{ input: 'test input', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(mockScorers[0].run).toHaveBeenCalledTimes(1);
      expect(mockScorers[1].run).toHaveBeenCalledTimes(1);

      expect(mockScorers[0].run).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(Object),
          output: expect.any(Object),
        }),
      );
    });
  });

  describe('Agent integration', () => {
    it('should call agent.generate with correct parameters', async () => {
      await runExperiment({
        data: [{ input: 'test input', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(mockAgent.generate).toHaveBeenCalledTimes(1);
      expect(mockAgent.generate).toHaveBeenCalledWith('test input', {
        scorers: {},
        returnScorerData: true,
        runtimeContext: undefined,
      });
    });

    it('should pass runtimeContext when provided', async () => {
      const runtimeContext = new RuntimeContext([['userId', 'test-user']]);

      await runExperiment({
        data: [
          {
            input: 'test input',
            groundTruth: 'truth',
            runtimeContext,
          },
        ],
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(mockAgent.generate).toHaveBeenCalledTimes(1);
      expect(mockAgent.generate).toHaveBeenCalledWith('test input', {
        scorers: {},
        returnScorerData: true,
        runtimeContext,
      });
    });
  });

  describe('Scorer integration', () => {
    it('should call scorers with correct data', async () => {
      const mockResponse = {
        scoringData: {
          input: { inputMessages: ['test'], rememberedMessages: [], systemMessages: [], taggedSystemMessages: {} },
          output: 'response',
        },
      };

      // Mock the agent's generate method to return the expected response
      mockAgent.generate = vi.fn().mockResolvedValue(mockResponse);

      await runExperiment({
        data: [{ input: 'test', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(mockScorers[0].run).toHaveBeenCalledWith({
        input: mockResponse.scoringData.input,
        output: mockResponse.scoringData.output,
        groundTruth: 'truth',
      });
    });

    it('should handle missing scoringData gracefully', async () => {
      mockAgent.generate = vi.fn().mockResolvedValue({ response: 'test' });

      await runExperiment({
        data: [{ input: 'test', groundTruth: 'truth' }],
        scorers: [mockScorers[0]],
        target: mockAgent,
      });

      expect(mockScorers[0].run).toHaveBeenCalledWith({
        input: undefined,
        output: undefined,
        groundTruth: 'truth',
      });
    });
  });

  describe('onItemComplete callback', () => {
    it('should call onItemComplete for each item', async () => {
      const onItemComplete = vi.fn();

      await runExperiment({
        data: testData,
        scorers: mockScorers,
        target: mockAgent,
        onItemComplete,
      });

      expect(onItemComplete).toHaveBeenCalledTimes(2);

      expect(onItemComplete).toHaveBeenNthCalledWith(1, {
        item: testData[0],
        targetResult: expect.any(Object),
        scorerResults: expect.objectContaining({
          toxicity: expect.any(Object),
          relevance: expect.any(Object),
        }),
      });
    });
  });
  describe('Error handling', () => {
    it('should handle agent generate errors', async () => {
      mockAgent.generate = vi.fn().mockRejectedValue(new Error('Agent error'));

      await expect(
        runExperiment({
          data: testData,
          scorers: mockScorers,
          target: mockAgent,
        }),
      ).rejects.toThrow();
    });

    it('should handle scorer errors', async () => {
      mockScorers[0].run = vi.fn().mockRejectedValue(new Error('Scorer error'));

      await expect(
        runExperiment({
          data: testData,
          scorers: mockScorers,
          target: mockAgent,
        }),
      ).rejects.toThrow();
    });

    it('should handle empty data array', async () => {
      await expect(
        runExperiment({
          data: [],
          scorers: mockScorers,
          target: mockAgent,
        }),
      ).rejects.toThrow();
    });

    it('should handle empty scorers array', async () => {
      await expect(
        runExperiment({
          data: testData,
          scorers: [],
          target: mockAgent,
        }),
      ).rejects.toThrow();
    });
  });

  describe('Workflow integration', () => {
    it('should run experiment with workflow target', async () => {
      // Create a simple workflow
      const mockStep = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `Processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      })
        .then(mockStep)
        .commit();

      const result = await runExperiment({
        data: [
          { input: { input: 'Test input 1' }, groundTruth: 'Expected 1' },
          { input: { input: 'Test input 2' }, groundTruth: 'Expected 2' },
        ],
        scorers: [mockScorers[0]],
        target: workflow,
      });

      expect(result.scores.toxicity).toBe(0.9);
      expect(result.summary.totalItems).toBe(2);
    });

    it('should override step scorers to be empty during workflow execution', async () => {
      // Create a step with scorers already attached
      const mockStep = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        scorers: { existingScorer: { scorer: mockScorers[0] } },
        execute: async ({ inputData }) => {
          return { output: `Processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      })
        .then(mockStep)
        .commit();

      await runExperiment({
        data: [{ input: { input: 'Test input' }, groundTruth: 'Expected' }],
        scorers: {
          steps: {
            'test-step': [mockScorers[1]],
          },
        },
        target: workflow,
      });

      expect(mockScorers[0].run).not.toHaveBeenCalled();
      expect(mockScorers[1].run).toHaveBeenCalled();
    });

    it('should run scorers on individual step results', async () => {
      const mockStep = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `Processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      })
        .then(mockStep)
        .commit();

      // Mock the scorer to track what it receives
      const mockScorer = createMockScorer('step-scorer', 0.8);
      const scorerSpy = vi.spyOn(mockScorer, 'run');

      await runExperiment({
        data: [{ input: { input: 'Test input' }, groundTruth: 'Expected' }],
        scorers: {
          steps: {
            'test-step': [mockScorer],
          },
        },
        target: workflow,
      });

      // Verify the scorer was called with step-specific data
      expect(scorerSpy).toHaveBeenCalledWith({
        input: { input: 'Test input' }, // step payload
        output: { output: 'Processed: Test input' }, // step output
        groundTruth: 'Expected',
        runtimeContext: undefined,
      });
    });

    it('should capture step scorer results in experiment output', async () => {
      const mockStep = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `Processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      })
        .then(mockStep)
        .commit();

      const mockScorer = createMockScorer('step-scorer', 0.8);

      const result = await runExperiment({
        data: [{ input: { input: 'Test input' }, groundTruth: 'Expected' }],
        scorers: {
          workflow: [mockScorers[0]],
          steps: {
            'test-step': [mockScorer],
          },
        },
        target: workflow,
      });

      console.log(`result`, JSON.stringify(result, null, 2));

      // Verify the experiment result includes step scorer results
      expect(result.scores.steps?.[`test-step`]?.[`step-scorer`]).toBe(0.8);
      expect(result.scores.workflow?.toxicity).toBe(0.9);
      expect(result.summary.totalItems).toBe(1);
    });
  });
});
