import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { NoOpObservability } from '../../observability';
import { RequestContext } from '../../request-context';
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
});
