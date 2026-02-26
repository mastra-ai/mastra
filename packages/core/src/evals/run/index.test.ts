import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { NoOpObservability } from '../../observability';
import { RequestContext } from '../../request-context';
import { createWorkflow, createStep } from '../../workflows';
import { createScorer } from '../base';
import type { MastraScorer } from '../base';
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

      console.log(`result`, JSON.stringify(result, null, 2));

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
        agents: {
          testAgent: agent,
        },
        logger: false,
        storage: mockStorage as any,
      });

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
});
