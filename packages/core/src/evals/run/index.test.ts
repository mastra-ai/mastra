import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { NoOpObservability } from '../../observability';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow, createStep } from '../../workflows';
import { createScorer } from '../base';
import type { MastraScorer } from '../base';
import type { AgentScorerConfig } from '.';
import { runEvals } from '.';

const createMockScorer = (name: string, score: number = 0.8): MastraScorer => {
  const scorer = createScorer({
    id: name,
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
    id: 'mockAgent',
    name: 'mockAgent',
    instructions: 'Mock agent',
    model: dummyModel,
  });

  // Add a spy to the generate method (without mocking the return value)
  vi.spyOn(agent, 'generateLegacy');

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
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: response },
        { type: 'text-delta', id: 'text-1', delta: `sup` },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });

  const agent = new Agent({
    id: 'mockAgent',
    name: 'mockAgent',
    instructions: 'Mock agent',
    model: dummyModel,
  });

  // Add a spy to the generate method (without mocking the return value)
  vi.spyOn(agent, 'generate');

  return agent;
};

describe('runEvals', () => {
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
      const result = await runEvals({
        data: testData,
        scorers: [createMockScorer('toxicity', 0.9)],
        target: mockAgent,
      });

      expect(result.scores.toxicity).toBe(0.9);
      expect(result.summary.totalItems).toBe(2);
    });

    it('should run experiment with multiple scorers', async () => {
      const result = await runEvals({
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

      const result = await runEvals({
        data: testData,
        scorers,
        target: mockAgent,
      });

      expect(result.scores.test).toBe(0.8);
    });
  });

  describe('V2 Agent integration', () => {
    it('should call agent.generateLegacy with correct parameters', async () => {
      const mockAgent = createMockAgentV2();
      await runEvals({
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
    it('should call agent.generateLegacy with correct parameters', async () => {
      await runEvals({
        data: [{ input: 'test input', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(mockAgent.generateLegacy).toHaveBeenCalledTimes(1);
      expect(mockAgent.generateLegacy).toHaveBeenCalledWith(
        'test input',
        expect.objectContaining({
          scorers: {},
          returnScorerData: true,
          requestContext: undefined,
        }),
      );
    });

    it('should pass requestContext when provided', async () => {
      const requestContext = new RequestContext([['userId', 'test-user']]);

      await runEvals({
        data: [
          {
            input: 'test input',
            groundTruth: 'truth',
            requestContext,
          },
        ],
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(mockAgent.generateLegacy).toHaveBeenCalledTimes(1);
      expect(mockAgent.generateLegacy).toHaveBeenCalledWith(
        'test input',
        expect.objectContaining({
          scorers: {},
          returnScorerData: true,
          requestContext,
        }),
      );
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
      mockAgent.generateLegacy = vi.fn().mockResolvedValue(mockResponse);

      await runEvals({
        data: [{ input: 'test', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockAgent,
      });

      expect(mockScorers[0].run).toHaveBeenCalledWith(
        expect.objectContaining({
          input: mockResponse.scoringData.input,
          output: mockResponse.scoringData.output,
          groundTruth: 'truth',
        }),
      );
    });

    it('should handle missing scoringData gracefully', async () => {
      mockAgent.generateLegacy = vi.fn().mockResolvedValue({ response: 'test' });

      await runEvals({
        data: [{ input: 'test', groundTruth: 'truth' }],
        scorers: [mockScorers[0]],
        target: mockAgent,
      });

      expect(mockScorers[0].run).toHaveBeenCalledWith(
        expect.objectContaining({
          input: undefined,
          output: undefined,
          groundTruth: 'truth',
        }),
      );
    });
  });

  describe('onItemComplete callback', () => {
    it('should call onItemComplete for each item', async () => {
      const onItemComplete = vi.fn();

      await runEvals({
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
      mockAgent.generateLegacy = vi.fn().mockRejectedValue(new Error('Agent error'));

      await expect(
        runEvals({
          data: testData,
          scorers: mockScorers,
          target: mockAgent,
        }),
      ).rejects.toThrow();
    });

    it('should handle scorer errors', async () => {
      mockScorers[0].run = vi.fn().mockRejectedValue(new Error('Scorer error'));

      await expect(
        runEvals({
          data: testData,
          scorers: mockScorers,
          target: mockAgent,
        }),
      ).rejects.toThrow();
    });

    it('should handle empty data array', async () => {
      await expect(
        runEvals({
          data: [],
          scorers: mockScorers,
          target: mockAgent,
        }),
      ).rejects.toThrow();
    });

    it('should handle empty scorers array', async () => {
      await expect(
        runEvals({
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      const result = await runEvals({
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      await runEvals({
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      // Mock the scorer to track what it receives
      const mockScorer = createMockScorer('step-scorer', 0.8);
      const scorerSpy = vi.spyOn(mockScorer, 'run');

      await runEvals({
        data: [{ input: { input: 'Test input' }, groundTruth: 'Expected' }],
        scorers: {
          steps: {
            'test-step': [mockScorer],
          },
        },
        target: workflow,
      });

      // Verify the scorer was called with step-specific data
      expect(scorerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { input: 'Test input' }, // step payload
          output: { output: 'Processed: Test input' }, // step output
          groundTruth: 'Expected',
          requestContext: undefined,
        }),
      );
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      const mockScorer = createMockScorer('step-scorer', 0.8);

      const result = await runEvals({
        data: [{ input: { input: 'Test input' }, groundTruth: 'Expected' }],
        scorers: {
          workflow: [mockScorers[0]],
          steps: {
            'test-step': [mockScorer],
          },
        },
        target: workflow,
      });

      // Verify the experiment result includes step scorer results
      expect(result.scores.steps?.[`test-step`]?.[`step-scorer`]).toBe(0.8);
      expect(result.scores.workflow?.toxicity).toBe(0.9);
      expect(result.summary.totalItems).toBe(1);
    });
  });

  describe('Observability integration', () => {
    it('should create tracing spans when observability is configured in Mastra', async () => {
      // Create agent with Mastra instance that has observability
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Response from agent' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'observableAgent',
        name: 'Observable Agent',
        instructions: 'Test agent with observability',
        model: dummyModel,
      });

      const observability = new NoOpObservability();

      const selectedInstance = vi.spyOn(observability, 'getSelectedInstance');

      const mastra = new Mastra({
        agents: {
          observableAgent: agent,
        },
        observability,
        logger: false,
      });

      const scorer = createScorer({
        id: 'testScorer',
        description: 'Test scorer',
        name: 'testScorer',
      }).generateScore(() => 0.9);

      // Run evals
      await runEvals({
        data: [{ input: 'test input', groundTruth: 'expected output' }],
        scorers: [scorer],
        target: mastra.getAgent('observableAgent'),
      });

      expect(selectedInstance).toHaveBeenCalled();
    });
  });

  describe('Score persistence', () => {
    it('should save scores to storage when runEvals is called', async () => {
      // Create agent
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Response from agent' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'testAgent',
        name: 'Test Agent',
        instructions: 'Test agent',
        model: dummyModel,
      });

      // The agent loop runs on the evented workflow engine, which needs a
      // functioning `workflows` store — a partial mock cannot satisfy it. Use a
      // real in-memory store and spy on the real `scores` store's saveScore.
      const storage = new InMemoryStore();

      const mastra = new Mastra({
        agents: {
          testAgent: agent,
        },
        logger: false,
        storage,
      });

      const scoresStore = (await mastra.getStorage()!.getStore('scores'))!;
      const saveScoreSpy = vi.spyOn(scoresStore, 'saveScore');

      const scorer = createScorer({
        id: 'testScorer',
        description: 'Test scorer',
        name: 'testScorer',
      }).generateScore(() => 0.85);

      // Register the scorer with Mastra so it can be found during score saving
      mastra.addScorer(scorer, 'testScorer');

      // Run evals
      await runEvals({
        data: [
          { input: 'test input 1', groundTruth: 'expected output 1' },
          { input: 'test input 2', groundTruth: 'expected output 2' },
        ],
        scorers: [scorer],
        target: mastra.getAgent('testAgent'),
      });

      // Verify scores were saved to storage
      expect(saveScoreSpy).toHaveBeenCalledTimes(2);

      // Verify the saved score structure
      expect(saveScoreSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'testScorer',
          entityId: 'testAgent',
          entityType: 'AGENT',
          score: 0.85,
          source: 'TEST',
          runId: expect.any(String),
        }),
      );
    });

    it('should save workflow scores to storage', async () => {
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      // Create mock scores storage
      const saveScoreSpy = vi.fn().mockResolvedValue({ score: {} });
      const mockScoresStore = {
        saveScore: saveScoreSpy,
      };

      // Mock workflows store with methods needed for scorer workflow runs
      const mockWorkflowsStore = {
        getWorkflowRunById: vi.fn().mockResolvedValue(null),
        deleteWorkflowRunById: vi.fn().mockResolvedValue(undefined),
        persistWorkflowSnapshot: vi.fn().mockResolvedValue(undefined),
        listWorkflowRuns: vi.fn().mockResolvedValue({ runs: [] }),
      };

      const mockStorage = {
        init: vi.fn().mockResolvedValue(undefined),
        getStore: vi.fn().mockImplementation(async (domain: string) => {
          if (domain === 'workflows') return mockWorkflowsStore;
          if (domain === 'scores') return mockScoresStore;
          return null;
        }),
        __setLogger: vi.fn(),
      };

      const mastra = new Mastra({
        workflows: {
          testWorkflow: workflow,
        },
        logger: false,
        storage: mockStorage as any,
      });

      const scorer = createScorer({
        id: 'workflowScorer',
        description: 'Workflow scorer',
        name: 'workflowScorer',
      }).generateScore(() => 0.75);

      // Register the scorer with Mastra so it can be found during score saving
      mastra.addScorer(scorer, 'workflowScorer');

      // Run evals with workflow
      await runEvals({
        data: [{ input: { input: 'Test input' }, groundTruth: 'Expected' }],
        scorers: [scorer],
        target: mastra.getWorkflow('testWorkflow'),
      });

      // Verify scores were saved
      expect(saveScoreSpy).toHaveBeenCalledTimes(1);
      expect(saveScoreSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'workflowScorer',
          entityId: 'test-workflow',
          entityType: 'WORKFLOW',
          score: 0.75,
          source: 'TEST',
        }),
      );
    });
  });

  describe('targetOptions', () => {
    it('should pass targetOptions to agent.generate (modern path)', async () => {
      const mockAgent = createMockAgentV2();

      await runEvals({
        data: [{ input: 'test input', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockAgent,
        targetOptions: { maxSteps: 3 },
      });

      expect(mockAgent.generate).toHaveBeenCalledWith('test input', expect.objectContaining({ maxSteps: 3 }));
    });

    it('should not allow targetOptions to override scorers or returnScorerData', async () => {
      const mockAgent = createMockAgentV2();

      await runEvals({
        data: [{ input: 'test input', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockAgent,
        targetOptions: { scorers: { evil: { scorer: 'evil' } } as any, returnScorerData: false } as any,
      });

      expect(mockAgent.generate).toHaveBeenCalledWith(
        'test input',
        expect.objectContaining({
          scorers: {},
          returnScorerData: true,
        }),
      );
    });

    it('should not pass targetOptions to generateLegacy (legacy path)', async () => {
      const mockLegacyAgent = createMockAgent();

      await runEvals({
        data: [{ input: 'test input', groundTruth: 'truth' }],
        scorers: mockScorers,
        target: mockLegacyAgent,
        targetOptions: { maxSteps: 5 } as any,
      });

      // Legacy path should not receive targetOptions
      expect(mockLegacyAgent.generateLegacy).toHaveBeenCalledWith(
        'test input',
        expect.objectContaining({
          scorers: {},
          returnScorerData: true,
          requestContext: undefined,
        }),
      );
    });

    it('should pass targetOptions to workflow run.start', async () => {
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      const startSpy = vi.fn();
      const origCreateRun = workflow.createRun.bind(workflow);
      vi.spyOn(workflow, 'createRun').mockImplementation(async opts => {
        const run = await origCreateRun(opts);
        startSpy.mockImplementation(run.start.bind(run));
        run.start = startSpy;
        return run;
      });

      await runEvals({
        data: [{ input: { input: 'Test' }, groundTruth: 'Expected' }],
        scorers: [mockScorers[0]],
        target: workflow,
        targetOptions: { perStep: true },
      });

      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ perStep: true }));
    });
  });

  describe('startOptions (per-item workflow options)', () => {
    it('should pass startOptions to run.start for each item', async () => {
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      const startSpy = vi.fn();
      const origCreateRun = workflow.createRun.bind(workflow);
      vi.spyOn(workflow, 'createRun').mockImplementation(async opts => {
        const run = await origCreateRun(opts);
        startSpy.mockImplementation(run.start.bind(run));
        run.start = startSpy;
        return run;
      });

      const initialState = { counter: 1 };

      await runEvals({
        data: [{ input: { input: 'Test' }, groundTruth: 'Expected', startOptions: { initialState } }],
        scorers: [mockScorers[0]],
        target: workflow,
      });

      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ initialState }));
    });

    it('per-item startOptions should override targetOptions for the same key', async () => {
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
        options: { validateInputs: false },
      })
        .then(mockStep)
        .commit();

      const startSpy = vi.fn();
      const origCreateRun = workflow.createRun.bind(workflow);
      vi.spyOn(workflow, 'createRun').mockImplementation(async opts => {
        const run = await origCreateRun(opts);
        startSpy.mockImplementation(run.start.bind(run));
        run.start = startSpy;
        return run;
      });

      const globalState = { counter: 0 };
      const itemState = { counter: 42 };

      await runEvals({
        data: [
          {
            input: { input: 'Test' },
            groundTruth: 'Expected',
            startOptions: { initialState: itemState },
          },
        ],
        scorers: [mockScorers[0]],
        target: workflow,
        targetOptions: { initialState: globalState },
      });

      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ initialState: itemState }));
    });
  });

  describe('Trajectory scoring with tool-calling agent', () => {
    // Creates a mock agent that calls tools and returns a final text response.
    // The mock model uses a call counter:
    //   1st call → returns tool call for 'weatherTool'
    //   2nd call → returns tool call for 'calendarTool'
    //   3rd call → returns final text response
    function createToolCallingAgent() {
      let callCount = 0;

      const model = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-weather-1',
                  toolName: 'weatherTool',
                  input: JSON.stringify({ city: 'London' }),
                },
              ],
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          }
          if (callCount === 2) {
            return {
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-calendar-1',
                  toolName: 'calendarTool',
                  input: JSON.stringify({ date: '2025-01-01' }),
                },
              ],
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          }
          // Final call: text response
          return {
            content: [{ type: 'text' as const, text: 'The weather is sunny and your calendar is clear.' }],
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const weatherTool = createTool({
        id: 'weatherTool',
        description: 'Get weather for a city',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
        execute: async () => {
          return { temperature: 22, condition: 'sunny' };
        },
      });

      const calendarTool = createTool({
        id: 'calendarTool',
        description: 'Get calendar events for a date',
        inputSchema: z.object({ date: z.string() }),
        outputSchema: z.object({ events: z.array(z.string()) }),
        execute: async () => {
          return { events: [] };
        },
      });

      const agent = new Agent({
        id: 'tool-calling-agent',
        name: 'Tool Calling Agent',
        instructions: 'You are a helpful agent that checks weather and calendar.',
        model,
        tools: { weatherTool, calendarTool },
      });

      return { agent, callCount: () => callCount };
    }

    it('should pass flat scorers with raw MastraDBMessage[] output', async () => {
      const { agent } = createToolCallingAgent();

      // Helper to extract tool names from MastraDBMessage[] output
      function extractToolNames(output: any[]): string[] {
        const names: string[] = [];
        for (const msg of output) {
          const invocations = msg.content?.toolInvocations ?? [];
          for (const inv of invocations) {
            names.push(inv.toolName);
          }
        }
        return names;
      }

      // This scorer inspects the raw output to verify toolInvocations are present
      const inspectorScorer = createScorer({
        id: 'trajectory-inspector',
        name: 'Trajectory Inspector',
        description: 'Inspects output for toolInvocations',
      }).generateScore(({ run }) => {
        const output = run.output;
        if (!Array.isArray(output)) return 0;

        const toolNames = extractToolNames(output);
        const hasWeather = toolNames.includes('weatherTool');
        const hasCalendar = toolNames.includes('calendarTool');

        return hasWeather && hasCalendar ? 1.0 : 0.5;
      });

      const result = await runEvals({
        data: [{ input: 'What is the weather and my calendar for today?' }],
        scorers: [inspectorScorer],
        target: agent,
      });

      expect(result.scores['trajectory-inspector']).toBe(1.0);
    });

    it('should pre-extract trajectory for trajectory scorers in AgentScorerConfig', async () => {
      const { agent } = createToolCallingAgent();

      const agentLevelScorer = createMockScorer('agent-overall', 0.9);

      // Trajectory scorers receive a Trajectory object with .steps, not raw messages
      const trajectoryScorer = createScorer({
        id: 'trajectory-steps',
        name: 'Trajectory Steps',
        description: 'Verifies trajectory steps are pre-extracted',
      }).generateScore(({ run }: any) => {
        const trajectory = run.output;

        // Should be a Trajectory object, not an array of messages
        if (Array.isArray(trajectory)) return 0;
        if (!trajectory?.steps) return 0;

        const stepNames = trajectory.steps.map((s: any) => s.name);
        const hasWeather = stepNames.includes('weatherTool');
        const hasCalendar = stepNames.includes('calendarTool');

        return hasWeather && hasCalendar ? 1.0 : 0.0;
      });

      const scorerConfig: AgentScorerConfig = {
        agent: [agentLevelScorer],
        trajectory: [trajectoryScorer],
      };

      const result = await runEvals({
        data: [{ input: 'What is the weather and my calendar?' }],
        scorers: scorerConfig,
        target: agent,
      });

      // Agent-level scorers should be under 'agent' key
      expect(result.scores.agent).toBeDefined();
      expect(result.scores.agent['agent-overall']).toBe(0.9);

      // Trajectory scorers should be under 'trajectory' key
      expect(result.scores.trajectory).toBeDefined();
      expect(result.scores.trajectory['trajectory-steps']).toBe(1.0);
    });

    it('should preserve step ordering in the extracted trajectory', async () => {
      const { agent } = createToolCallingAgent();

      // Verify correct order: weatherTool first, calendarTool second
      const orderScorer = createScorer({
        id: 'step-order',
        name: 'Step Order',
        description: 'Checks trajectory step ordering',
      }).generateScore(({ run }: any) => {
        const trajectory = run.output;
        if (!trajectory?.steps || trajectory.steps.length < 2) return 0;

        const first = trajectory.steps[0]?.name;
        const second = trajectory.steps[1]?.name;

        return first === 'weatherTool' && second === 'calendarTool' ? 1.0 : 0.0;
      });

      // Wrong order scorer expects the opposite
      const wrongOrderScorer = createScorer({
        id: 'wrong-order',
        name: 'Wrong Order',
        description: 'Expects calendar before weather',
      }).generateScore(({ run }: any) => {
        const trajectory = run.output;
        if (!trajectory?.steps || trajectory.steps.length < 2) return 0;

        const first = trajectory.steps[0]?.name;
        const second = trajectory.steps[1]?.name;

        return first === 'calendarTool' && second === 'weatherTool' ? 1.0 : 0.0;
      });

      const result = await runEvals({
        data: [{ input: 'Check weather and calendar' }],
        scorers: { trajectory: [orderScorer, wrongOrderScorer] } satisfies AgentScorerConfig,
        target: agent,
      });

      expect(result.scores.trajectory['step-order']).toBe(1.0);
      expect(result.scores.trajectory['wrong-order']).toBe(0.0);
    });

    it('should pass groundTruth to trajectory scorers', async () => {
      const { agent } = createToolCallingAgent();

      const groundTruthScorer = createScorer({
        id: 'gt-trajectory',
        name: 'Ground Truth Trajectory',
        description: 'Uses groundTruth to check trajectory',
      }).generateScore(({ run }: any) => {
        const gt = run.groundTruth;
        if (!gt?.expectedTools) return 0;

        const trajectory = run.output;
        if (!trajectory?.steps) return 0;

        const stepNames = trajectory.steps.map((s: any) => s.name);
        const allPresent = gt.expectedTools.every((t: string) => stepNames.includes(t));
        return allPresent ? 1.0 : 0.0;
      });

      const result = await runEvals({
        data: [
          {
            input: 'What is the weather?',
            groundTruth: { expectedTools: ['weatherTool', 'calendarTool'] },
          },
        ],
        scorers: { trajectory: [groundTruthScorer] } satisfies AgentScorerConfig,
        target: agent,
      });

      expect(result.scores.trajectory['gt-trajectory']).toBe(1.0);
    });

    it('should include step input/output data in trajectory steps', async () => {
      const { agent } = createToolCallingAgent();

      // Verifies the trajectory steps contain args and results from tool invocations
      const detailScorer = createScorer({
        id: 'step-detail',
        name: 'Step Detail',
        description: 'Checks trajectory step data',
      }).generateScore(({ run }: any) => {
        const trajectory = run.output;
        if (!trajectory?.steps) return 0;

        const weatherStep = trajectory.steps.find((s: any) => s.name === 'weatherTool');
        if (!weatherStep) return 0;

        // toolArgs should contain the tool call arguments
        const toolArgs = weatherStep.toolArgs;
        if (!toolArgs || toolArgs.city !== 'London') return 0;

        // toolResult should contain the tool result
        const toolResult = weatherStep.toolResult;
        if (!toolResult || toolResult.temperature !== 22 || toolResult.condition !== 'sunny') return 0;

        return 1.0;
      });

      const result = await runEvals({
        data: [{ input: 'Check the London weather' }],
        scorers: { trajectory: [detailScorer] } satisfies AgentScorerConfig,
        target: agent,
      });

      expect(result.scores.trajectory['step-detail']).toBe(1.0);
    });

    it('should preserve rawOutput on trajectory for scorers that need message context', async () => {
      const { agent } = createToolCallingAgent();

      const rawOutputScorer = createScorer({
        id: 'raw-output-check',
        name: 'Raw Output Check',
        description: 'Verifies rawOutput is available on trajectory',
      }).generateScore(({ run }: any) => {
        const trajectory = run.output;
        if (!trajectory?.rawOutput) return 0;

        // rawOutput should be the original MastraDBMessage[] array
        if (!Array.isArray(trajectory.rawOutput)) return 0;
        return trajectory.rawOutput.length > 0 ? 1.0 : 0.0;
      });

      const result = await runEvals({
        data: [{ input: 'Check weather' }],
        scorers: { trajectory: [rawOutputScorer] } satisfies AgentScorerConfig,
        target: agent,
      });

      expect(result.scores.trajectory['raw-output-check']).toBe(1.0);
    });
  });

  describe('gates and verdict', () => {
    it('should return verdict: passed when all gates score 1.0', async () => {
      const agent = createMockAgentV2('It is sunny and warm');
      const alwaysPassGate = createScorer({
        id: 'always-pass',
        description: 'Always passes',
      }).generateScore(() => 1.0);

      const result = await runEvals({
        data: [{ input: 'Weather?' }],
        scorers: [createMockScorer('basic', 0.9)],
        gates: [alwaysPassGate],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.gateResults).toHaveLength(1);
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.gateResults![0]!.score).toBe(1.0);
    });

    it('should return verdict: failed when a gate scores below 1.0', async () => {
      const agent = createMockAgentV2('response');
      const failingGate = createScorer({
        id: 'failing-gate',
        description: 'Always fails',
      }).generateScore(() => 0.5);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [createMockScorer('basic', 0.9)],
        gates: [failingGate],
        target: agent,
      });

      expect(result.verdict).toBe('failed');
      expect(result.gateResults![0]!.passed).toBe(false);
    });

    it('should return verdict: scored when gates pass but threshold fails', async () => {
      const agent = createMockAgentV2('response');
      const passingGate = createScorer({
        id: 'gate-pass',
        description: 'Passes',
      }).generateScore(() => 1.0);

      const lowScorer = createScorer({
        id: 'low-scorer',
        description: 'Scores low',
      }).generateScore(() => 0.3);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: lowScorer, threshold: 0.7 }],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.passed).toBe(false);
      expect(result.thresholdResults![0]!.averageScore).toBe(0.3);
    });

    it('should not include verdict when no gates or thresholds are provided', async () => {
      const agent = createMockAgentV2('response');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [createMockScorer('basic', 0.8)],
        target: agent,
      });

      expect(result.verdict).toBeUndefined();
      expect(result.gateResults).toBeUndefined();
      expect(result.thresholdResults).toBeUndefined();
    });

    it('should support threshold-only mode without gates', async () => {
      const agent = createMockAgentV2('response');
      const goodScorer = createScorer({
        id: 'good-scorer',
        description: 'High score',
      }).generateScore(() => 0.9);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: goodScorer, threshold: 0.7 }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.gateResults).toBeUndefined();
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });

    it('should work with mixed bare scorers and threshold scorers', async () => {
      const agent = createMockAgentV2('response');
      const bareScorer = createMockScorer('bare', 0.8);
      const thresholdScorer = createScorer({
        id: 'threshold-scorer',
        description: 'Has threshold',
      }).generateScore(() => 0.85);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [bareScorer, { scorer: thresholdScorer, threshold: 0.8 }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.scores['bare']).toBeDefined();
      expect(result.scores['threshold-scorer']).toBeDefined();
    });

    it('should convert a throwing gate into score 0 and verdict failed', async () => {
      const agent = createMockAgentV2('response');
      const throwingGate = createScorer({
        id: 'throwing-gate',
        description: 'Always throws',
      }).generateScore(() => {
        throw new Error('Boom');
      });

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [createMockScorer('basic', 0.8)],
        gates: [throwingGate],
        target: agent,
      });

      expect(result.verdict).toBe('failed');
      expect(result.gateResults).toHaveLength(1);
      expect(result.gateResults![0]!.passed).toBe(false);
      expect(result.gateResults![0]!.score).toBe(0);
    });

    it('should reject invalid threshold values', async () => {
      const agent = createMockAgentV2('response');
      const scorer = createScorer({
        id: 'some-scorer',
        description: 'test',
      }).generateScore(() => 0.8);

      await expect(
        runEvals({
          data: [{ input: 'Test' }],
          scorers: [{ scorer, threshold: 1.5 }],
          target: agent,
        }),
      ).rejects.toThrow(/between 0 and 1/);

      await expect(
        runEvals({
          data: [{ input: 'Test' }],
          scorers: [{ scorer, threshold: -0.1 }],
          target: agent,
        }),
      ).rejects.toThrow(/between 0 and 1/);

      await expect(
        runEvals({
          data: [{ input: 'Test' }],
          scorers: [{ scorer, threshold: NaN }],
          target: agent,
        }),
      ).rejects.toThrow(/between 0 and 1/);
    });

    it('should average gate scores across multiple data items', async () => {
      const agent = createMockAgentV2('response');
      let callCount = 0;
      const sometimesFailsGate = createScorer({
        id: 'sometimes-fails',
        description: 'Fails on second call',
      }).generateScore(() => {
        callCount++;
        return callCount === 2 ? 0.0 : 1.0;
      });

      const result = await runEvals({
        data: [{ input: 'Test1' }, { input: 'Test2' }, { input: 'Test3' }],
        scorers: [createMockScorer('basic', 0.8)],
        gates: [sometimesFailsGate],
        target: agent,
      });

      // Average score: (1.0 + 0.0 + 1.0) / 3 ≈ 0.67, which is < 1.0 → failed
      expect(result.verdict).toBe('failed');
      expect(result.gateResults![0]!.passed).toBe(false);
    });

    it('should support max threshold (score must be at or below max)', async () => {
      const agent = createMockAgentV2('response');
      const highScorer = createScorer({
        id: 'hallucination',
        description: 'Scores high when hallucinating',
      }).generateScore(() => 0.9);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: highScorer, threshold: { max: 0.3 } }],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.passed).toBe(false);
      expect(result.thresholdResults![0]!.averageScore).toBe(0.9);
    });

    it('should pass max threshold when score is at or below max', async () => {
      const agent = createMockAgentV2('response');
      const lowScorer = createScorer({
        id: 'hallucination',
        description: 'Scores low when not hallucinating',
      }).generateScore(() => 0.1);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: lowScorer, threshold: { max: 0.3 } }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });

    it('should support { min, max } range threshold', async () => {
      const agent = createMockAgentV2('response');
      const midScorer = createScorer({
        id: 'balanced',
        description: 'Scores in the middle',
      }).generateScore(() => 0.5);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: midScorer, threshold: { min: 0.3, max: 0.7 } }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });

    it('should fail when score is outside { min, max } range', async () => {
      const agent = createMockAgentV2('response');
      const highScorer = createScorer({
        id: 'out-of-range',
        description: 'Scores too high',
      }).generateScore(() => 0.9);

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: highScorer, threshold: { min: 0.3, max: 0.7 } }],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.thresholdResults![0]!.passed).toBe(false);
    });

    it('should reject invalid { min, max } threshold values', async () => {
      const agent = createMockAgentV2('response');
      const scorer = createScorer({
        id: 'some-scorer',
        description: 'test',
      }).generateScore(() => 0.5);

      await expect(
        runEvals({
          data: [{ input: 'Test' }],
          scorers: [{ scorer, threshold: { min: 0.8, max: 0.3 } }],
          target: agent,
        }),
      ).rejects.toThrow(/min.*greater than max/);

      await expect(
        runEvals({
          data: [{ input: 'Test' }],
          scorers: [{ scorer, threshold: { max: 1.5 } }],
          target: agent,
        }),
      ).rejects.toThrow(/between 0 and 1/);
    });
  });

  describe('multi-turn (inputs array)', () => {
    it('should execute multiple turns sequentially and accumulate outputs', async () => {
      let turnCount = 0;
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => {
          turnCount++;
          return {
            content: [{ type: 'text', text: `Turn ${turnCount} response` }],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'stream response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'multiTurnAgent',
        name: 'multiTurnAgent',
        instructions: 'Mock agent for multi-turn',
        model: dummyModel,
      });

      // Scorer checks accumulated output contains all turns
      const multiTurnScorer = createScorer({
        id: 'multi-turn-check',
        description: 'Checks all turns are in output',
      }).generateScore(({ run }: any) => {
        const output = run.output;
        if (!Array.isArray(output)) return 0;
        return output.length === 3 ? 1.0 : 0.0;
      });

      const result = await runEvals({
        data: [
          {
            input: 'First question', // fallback input
            inputs: ['First question', 'Follow-up question', 'Third question'],
          },
        ],
        scorers: [multiTurnScorer],
        target: agent,
      });

      expect(turnCount).toBe(3);
      expect(result.scores['multi-turn-check']).toBe(1.0);
    });

    it('should use the same threadId across all turns', async () => {
      const receivedMemoryOptions: any[] = [];
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'response' }],
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
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'threadAgent',
        name: 'threadAgent',
        instructions: 'Mock',
        model: dummyModel,
      });

      // Spy on generate to capture memory options
      const originalGenerate = agent.generate.bind(agent);
      vi.spyOn(agent, 'generate').mockImplementation(async (input: any, options: any) => {
        receivedMemoryOptions.push(options?.memory);
        return originalGenerate(input, options);
      });

      const basicScorer = createMockScorer('basic', 0.9);

      await runEvals({
        data: [
          {
            input: 'ignored',
            inputs: ['Turn 1', 'Turn 2'],
          },
        ],
        scorers: [basicScorer],
        target: agent,
      });

      // All turns should have received the same threadId
      expect(receivedMemoryOptions.length).toBe(2);
      expect(receivedMemoryOptions[0]?.thread).toBeDefined();
      expect(receivedMemoryOptions[0]?.thread).toBe(receivedMemoryOptions[1]?.thread);
    });

    it('should validate that inputs is a non-empty array', async () => {
      const agent = createMockAgentV2('response');

      await expect(
        runEvals({
          data: [{ input: 'test', inputs: [] }] as any,
          scorers: [createMockScorer('basic', 0.8)],
          target: agent,
        }),
      ).rejects.toThrow("'inputs' must be a non-empty array");
    });

    it('should work with gates in multi-turn mode', async () => {
      let turnCount = 0;
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => {
          turnCount++;
          return {
            content: [{ type: 'text', text: `Response ${turnCount}` }],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'gateMultiTurnAgent',
        name: 'gateMultiTurnAgent',
        instructions: 'Mock',
        model: dummyModel,
      });

      const alwaysPassGate = createScorer({
        id: 'pass-gate',
        description: 'Asserts multi-turn payload',
      }).generateScore(({ run }: any) => {
        return Array.isArray(run.output) && run.output.length === 2 ? 1.0 : 0.0;
      });

      const result = await runEvals({
        data: [
          {
            input: 'ignored',
            inputs: ['Question 1', 'Question 2'],
          },
        ],
        scorers: [createMockScorer('basic', 0.8)],
        gates: [alwaysPassGate],
        target: agent,
      });

      expect(turnCount).toBe(2);
      expect(result.verdict).toBe('passed');
    });
  });

  describe('multi-turn memory integration (real Memory + storage)', () => {
    const buildModel = (capturedPrompts: string[]) =>
      new MockLanguageModelV2({
        doGenerate: async (options: any) => {
          capturedPrompts.push(JSON.stringify(options.prompt));
          return {
            content: [{ type: 'text', text: `reply ${capturedPrompts.length}` }],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'reply' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

    it('injects a resourceId so a memory-backed agent persists and recalls across turns', async () => {
      const capturedPrompts: string[] = [];
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'memoryMultiTurnAgent',
        name: 'memoryMultiTurnAgent',
        instructions: 'Mock',
        model: buildModel(capturedPrompts),
        memory,
      });

      let capturedThread: string | undefined;
      let capturedResource: string | undefined;
      const originalGenerate = agent.generate.bind(agent);
      vi.spyOn(agent, 'generate').mockImplementation(async (input: any, options: any) => {
        const thread = options?.memory?.thread;
        capturedThread = typeof thread === 'string' ? thread : thread?.id;
        capturedResource = options?.memory?.resource;
        return originalGenerate(input, options);
      });

      await runEvals({
        data: [{ inputs: ['My favorite city is Brooklyn.', 'What did I say my favorite city was?'] }],
        scorers: [createMockScorer('basic', 1)],
        target: agent,
      });

      // runEvals owns the thread; it must also inject a resource (defaulting to the
      // thread id) so real Mastra memory can create the thread and recall history.
      expect(capturedThread).toBeDefined();
      expect(capturedResource).toBe(capturedThread);

      // The thread was actually created in storage with the injected resource.
      const thread = await memory.getThreadById({ threadId: capturedThread! });
      expect(thread).not.toBeNull();
      expect(thread?.resourceId).toBe(capturedResource);

      // Both turns were persisted to the one shared thread.
      const { messages } = await memory.recall({ threadId: capturedThread!, perPage: false });
      expect(messages.filter(m => m.role === 'user').length).toBe(2);
      expect(messages.filter(m => m.role === 'assistant').length).toBe(2);

      // Cross-turn recall: the second turn's prompt includes the first turn's content.
      expect(capturedPrompts.length).toBe(2);
      expect(capturedPrompts[1]).toContain('Brooklyn');
    });

    it('preserves a caller-provided memory.resource (thread optional in options)', async () => {
      const capturedPrompts: string[] = [];
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'memoryResourceAgent',
        name: 'memoryResourceAgent',
        instructions: 'Mock',
        model: buildModel(capturedPrompts),
        memory,
      });

      let capturedResource: string | undefined;
      let capturedThread: string | undefined;
      const originalGenerate = agent.generate.bind(agent);
      vi.spyOn(agent, 'generate').mockImplementation(async (input: any, options: any) => {
        capturedResource = options?.memory?.resource;
        const thread = options?.memory?.thread;
        capturedThread = typeof thread === 'string' ? thread : thread?.id;
        return originalGenerate(input, options);
      });

      await runEvals({
        data: [{ inputs: ['Turn 1', 'Turn 2'] }],
        scorers: [createMockScorer('basic', 1)],
        target: agent,
        // No thread supplied — runEvals injects it; only resource is provided.
        targetOptions: { memory: { resource: 'user-42' } },
      });

      expect(capturedResource).toBe('user-42');
      expect(capturedThread).toBeDefined();

      const thread = await memory.getThreadById({ threadId: capturedThread! });
      expect(thread?.resourceId).toBe('user-42');
    });
  });

  describe('turns (per-turn assertions)', () => {
    const createTurnAgent = (id: string, counter?: { count: number }): Agent => {
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => {
          if (counter) counter.count++;
          return {
            content: [{ type: 'text', text: 'turn response' }],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'turn response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });
      return new Agent({ id, name: id, instructions: 'Mock', model: dummyModel });
    };

    it('scores each turn against only its own output and returns turnResults', async () => {
      const counter = { count: 0 };
      const agent = createTurnAgent('turnsAgent', counter);

      // A per-turn scorer only sees that turn's output (length 1), unlike a holistic
      // accumulated scorer which would see every turn.
      const perTurnScorer = createScorer({
        id: 'per-turn-length',
        description: 'Each turn produces exactly one output message',
      }).generateScore(({ run }: any) => (Array.isArray(run.output) && run.output.length === 1 ? 1.0 : 0.0));

      const holisticScorer = createScorer({
        id: 'holistic-length',
        description: 'Holistic scorer sees accumulated output',
      }).generateScore(({ run }: any) => (Array.isArray(run.output) && run.output.length === 2 ? 1.0 : 0.0));

      const result = await runEvals({
        data: [
          {
            turns: [
              { input: 'Turn one', scorers: [perTurnScorer] },
              { input: 'Turn two', scorers: [perTurnScorer] },
            ],
          },
        ],
        scorers: [holisticScorer],
        target: agent,
      });

      expect(counter.count).toBe(2);
      // Holistic scorer sees both turns accumulated.
      expect(result.scores['holistic-length']).toBe(1.0);
      // Per-turn scorer saw one message per turn.
      expect(result.turnResults).toBeDefined();
      expect(result.turnResults!.length).toBe(2);
      expect(result.turnResults![0]!.scores!['per-turn-length']).toBe(1.0);
      expect(result.turnResults![1]!.scores!['per-turn-length']).toBe(1.0);
    });

    it('fails the verdict when a per-turn gate fails on one turn (wrong turn cannot satisfy)', async () => {
      const agent = createTurnAgent('turnGateAgent');

      // Gate passes only when the turn's own input asks to call the tool.
      const perTurnGate = createScorer({
        id: 'per-turn-gate',
        description: 'Turn input must request a tool call',
      }).generateScore(({ run }: any) => (typeof run.input === 'string' && run.input.includes('call') ? 1.0 : 0.0));

      const result = await runEvals({
        data: [
          {
            turns: [
              { input: 'please call the tool', gates: [perTurnGate] },
              { input: 'do not do anything', gates: [perTurnGate] },
            ],
          },
        ],
        target: agent,
      });

      expect(result.verdict).toBe('failed');
      expect(result.turnResults![0]!.gateResults![0]!.passed).toBe(true);
      expect(result.turnResults![1]!.gateResults![0]!.passed).toBe(false);
    });

    it("yields 'scored' when a per-turn threshold is missed but gates pass", async () => {
      const agent = createTurnAgent('turnThresholdAgent');

      const lowScorer = createMockScorer('turn-low', 0.3);

      const result = await runEvals({
        data: [
          {
            turns: [{ input: 'A question', scorers: [{ scorer: lowScorer, threshold: 0.8 }] }],
          },
        ],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.turnResults![0]!.thresholdResults![0]!.passed).toBe(false);
    });

    it('rejects an empty turns array', async () => {
      const agent = createTurnAgent('emptyTurnsAgent');
      await expect(
        runEvals({
          data: [{ turns: [] }] as any,
          scorers: [createMockScorer('basic', 0.8)],
          target: agent,
        }),
      ).rejects.toThrow("'turns' must be a non-empty array");
    });

    it('rejects a turn without an input', async () => {
      const agent = createTurnAgent('badTurnAgent');
      await expect(
        runEvals({
          data: [{ turns: [{ scorers: [createMockScorer('basic', 0.8)] }] }] as any,
          target: agent,
        }),
      ).rejects.toThrow("must be an object with an 'input' property");
    });

    it('rejects combining turns with input', async () => {
      const agent = createTurnAgent('conflictAgent');
      await expect(
        runEvals({
          data: [{ input: 'x', turns: [{ input: 'y' }] }] as any,
          scorers: [createMockScorer('basic', 0.8)],
          target: agent,
        }),
      ).rejects.toThrow("'turns' cannot be combined with 'input' or 'inputs'");
    });

    it('rejects turns for Workflow targets', async () => {
      const step = createStep({
        id: 'turns-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => ({ output: `Processed: ${inputData.input}` }),
      });
      const workflow = createWorkflow({
        id: 'turns-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        options: { validateInputs: false },
      })
        .then(step)
        .commit();

      await expect(
        runEvals({
          data: [{ turns: [{ input: { input: 'first' } }] }] as any,
          scorers: [createMockScorer('basic', 0.8)],
          target: workflow,
        }),
      ).rejects.toThrow("'turns' is not supported for Workflow targets");
    });

    it('supports mixing a single-turn item with a turns item', async () => {
      const agent = createTurnAgent('mixedAgent');

      const perTurnScorer = createScorer({
        id: 'mixed-turn-scorer',
        description: 'per-turn',
      }).generateScore(() => 1.0);

      const result = await runEvals({
        data: [
          { input: 'single turn question' },
          {
            turns: [
              { input: 'first', scorers: [perTurnScorer] },
              { input: 'second', scorers: [perTurnScorer] },
            ],
          },
        ],
        scorers: [createMockScorer('basic', 0.9)],
        target: agent,
      });

      expect(result.summary.totalItems).toBe(2);
      expect(result.turnResults!.length).toBe(2);
      expect(result.turnResults![0]!.scores!['mixed-turn-scorer']).toBe(1.0);
    });

    it('persists per-turn scores to storage (one score per turn)', async () => {
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'turn response' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'turn response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'turnPersistAgent',
        name: 'Turn Persist Agent',
        instructions: 'Mock',
        model: dummyModel,
      });

      const storage = new InMemoryStore();
      const mastra = new Mastra({ agents: { turnPersistAgent: agent }, logger: false, storage });

      const scoresStore = (await mastra.getStorage()!.getStore('scores'))!;
      const saveScoreSpy = vi.spyOn(scoresStore, 'saveScore');

      const perTurnScorer = createScorer({
        id: 'per-turn-persisted',
        name: 'per-turn-persisted',
        description: 'per-turn',
      }).generateScore(() => 0.75);
      mastra.addScorer(perTurnScorer, 'per-turn-persisted');

      await runEvals({
        data: [
          {
            turns: [
              { input: 'first', scorers: [perTurnScorer] },
              { input: 'second', scorers: [perTurnScorer] },
            ],
          },
        ],
        target: mastra.getAgent('turnPersistAgent'),
      });

      const perTurnCalls = saveScoreSpy.mock.calls.filter(
        ([payload]: any[]) => payload?.scorerId === 'per-turn-persisted',
      );
      expect(perTurnCalls).toHaveLength(2);
      expect(perTurnCalls[0]![0]).toMatchObject({
        scorerId: 'per-turn-persisted',
        entityId: 'turnPersistAgent',
        entityType: 'AGENT',
        score: 0.75,
        source: 'TEST',
      });
      // Each persisted per-turn score is labeled with its turn index so the UI can
      // group/label them, and turns share the same conversation thread id.
      const turnIndexes = perTurnCalls.map(([payload]: any[]) => payload.metadata?.turnIndex).sort();
      expect(turnIndexes).toEqual([0, 1]);
      const threadIds = perTurnCalls.map(([payload]: any[]) => payload.threadId);
      expect(threadIds[0]).toBeTruthy();
      expect(threadIds[0]).toBe(threadIds[1]);
    });

    it('preserves existing score metadata and links each turn to its own trace span', async () => {
      let callIndex = 0;
      const dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'turn response' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'turn response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'turnProvenanceAgent',
        name: 'Turn Provenance Agent',
        instructions: 'Mock',
        model: dummyModel,
      });

      // Give each turn a deterministic, distinct trace/span pair so we can assert
      // that each persisted per-turn score links to *its own* turn's span.
      const originalGenerate = agent.generate.bind(agent);
      vi.spyOn(agent, 'generate').mockImplementation(async (input: any, options: any) => {
        const result: any = await originalGenerate(input, options);
        result.traceId = `trace-${callIndex}`;
        result.spanId = `span-${callIndex}`;
        callIndex++;
        return result;
      });

      const storage = new InMemoryStore();
      const mastra = new Mastra({ agents: { turnProvenanceAgent: agent }, logger: false, storage });

      const scoresStore = (await mastra.getStorage()!.getStore('scores'))!;
      const saveScoreSpy = vi.spyOn(scoresStore, 'saveScore');

      const perTurnScorer = createScorer({
        id: 'per-turn-meta',
        name: 'per-turn-meta',
        description: 'per-turn',
      }).generateScore(() => 0.5);
      mastra.addScorer(perTurnScorer, 'per-turn-meta');

      // Real scorer result, augmented with its own metadata (including a `turnIndex`
      // that the system-owned value must override) to prove existing metadata survives.
      const originalRun = perTurnScorer.run.bind(perTurnScorer);
      vi.spyOn(perTurnScorer, 'run').mockImplementation(async (input: any) => {
        const result: any = await originalRun(input);
        result.metadata = { ...(result.metadata ?? {}), custom: 'preserved', turnIndex: 'should-be-overwritten' };
        return result;
      });

      await runEvals({
        data: [
          {
            turns: [
              { input: 'first', scorers: [perTurnScorer] },
              { input: 'second', scorers: [perTurnScorer] },
            ],
          },
        ],
        target: mastra.getAgent('turnProvenanceAgent'),
      });

      const perTurnCalls = saveScoreSpy.mock.calls
        .map(([payload]: any[]) => payload)
        .filter((payload: any) => payload?.scorerId === 'per-turn-meta')
        .sort((a: any, b: any) => a.metadata.turnIndex - b.metadata.turnIndex);
      expect(perTurnCalls).toHaveLength(2);

      perTurnCalls.forEach((payload: any, index: number) => {
        // Existing scorer metadata survives, and the system-owned turnIndex wins.
        expect(payload.metadata.custom).toBe('preserved');
        expect(payload.metadata.turnIndex).toBe(index);
        // Each stored score links to its own turn's trace/span pair.
        expect(payload.traceId).toBe(`trace-${index}`);
        expect(payload.spanId).toBe(`span-${index}`);
      });
    });
  });
});
