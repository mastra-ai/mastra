import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpanType } from '../observability';
import { createScorer } from './base';
import {
  AsyncFunctionBasedScorerBuilders,
  FunctionBasedScorerBuilders,
  MixedScorerBuilders,
  PromptBasedScorerBuilders,
} from './base.test-utils';

const createTestData = () => ({
  inputText: 'test input',
  outputText: 'test output',
  get userInput() {
    return [{ role: 'user', content: this.inputText }];
  },
  get agentOutput() {
    return { role: 'assistant', text: this.outputText };
  },
  get scoringInput() {
    return { input: this.userInput, output: this.agentOutput };
  },
});

function createMockSpan(traceId: string, type: SpanType) {
  const span: any = {
    id: `${type}-${Math.random().toString(36).slice(2)}`,
    traceId,
    type,
    isValid: true,
    isInternal: false,
    parent: undefined,
    end: vi.fn(),
    update: vi.fn(),
    error: vi.fn(),
    executeInContext: async (fn: () => Promise<unknown>) => fn(),
    findParent: vi.fn((targetType: SpanType) => {
      let current = span.parent;
      while (current) {
        if (current.type === targetType) {
          return current;
        }
        current = current.parent;
      }
      return undefined;
    }),
  };

  span.createChildSpan = vi.fn((options: { type: SpanType }) => {
    const child = createMockSpan(traceId, options.type);
    child.parent = span;
    return child;
  });

  return span;
}

function createMockMastra(options?: { addScoreImpl?: ReturnType<typeof vi.fn>; startSpan?: () => unknown }) {
  const logger = {
    debug: vi.fn(),
    warn: vi.fn(),
  };

  return {
    observability: {
      addScore: options?.addScoreImpl ?? vi.fn().mockResolvedValue(undefined),
      getSelectedInstance: vi.fn().mockReturnValue(
        options?.startSpan
          ? {
              startSpan: vi.fn().mockImplementation(options.startSpan),
            }
          : undefined,
      ),
    },
    getLogger: vi.fn().mockReturnValue(logger),
  };
}

describe('createScorer', () => {
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    testData = createTestData();
  });

  describe('Steps as functions scorer', () => {
    it('should create a basic scorer with functions', async () => {
      const scorer = FunctionBasedScorerBuilders.basic;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and analyze', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess only', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess, analyze, and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze only', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Steps as prompt objects scorer', () => {
    it('with analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess and analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withPreprocessAndAnalyze;

      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with analyze and reason prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(typeof result.reason).toBe('string');
      expect(result).toMatchSnapshot();
    });

    it('with generate score as prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withGenerateScoreAsPromptObject;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with all steps', async () => {
      const scorer = PromptBasedScorerBuilders.withAllSteps;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Mixed scorer', () => {
    it('with preprocess function and analyze prompt object', async () => {
      const scorer = MixedScorerBuilders.withPreprocessFunctionAnalyzePrompt;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withPreprocessPromptAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with reason function and analyze prompt', async () => {
      const scorer = MixedScorerBuilders.withReasonFunctionAnalyzePrompt;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with reason prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withReasonPromptAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Async scorer', () => {
    it('with basic', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.basic;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess function and analyze as prompt object', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessFunctionAndAnalyzePromptObject;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt object and analyze function', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessPromptObjectAndAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in analyze', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateScore', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateScore;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateReason', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Observability score emission', () => {
    it('should emit addScore when targetTraceId is provided', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'observed-scorer',
        description: 'Observed scorer',
      })
        .generateScore(() => 0.9)
        .generateReason(() => 'great');

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'live',
        targetTraceId: 'trace-123',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-123',
        score: {
          scorerId: 'observed-scorer',
          scorerName: 'observed-scorer',
          scoreSource: 'live',
          score: 0.9,
          reason: 'great',
          metadata: {
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should emit addScore without a target trace id when unanchored scoring is allowed', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'unanchored-scorer',
        description: 'Unanchored scorer',
      }).generateScore(() => 0.75);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'experiment',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        score: {
          scorerId: 'unanchored-scorer',
          scorerName: 'unanchored-scorer',
          scoreSource: 'experiment',
          score: 0.75,
          metadata: {
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should include scoreTraceId when scorer tracing is enabled', async () => {
      const mockMastra = createMockMastra({
        startSpan: () => createMockSpan('score-trace-1', SpanType.SCORER_RUN),
      });

      const scorer = createScorer({
        id: 'traced-scorer',
        description: 'Traced scorer',
      })
        .generateScore(() => 0.42)
        .generateReason(() => 'ok');

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'trace',
        targetTraceId: 'trace-abc',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-abc',
        score: expect.objectContaining({
          scorerId: 'traced-scorer',
          scorerName: 'traced-scorer',
          scoreSource: 'trace',
          score: 0.42,
          reason: 'ok',
          scoreTraceId: 'score-trace-1',
          metadata: {
            hasGroundTruth: false,
          },
        }),
      });
    });

    it('should include hasGroundTruth metadata when ground truth is provided', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'ground-truth-scorer',
        description: 'Ground truth scorer',
      }).generateScore(() => 1);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        groundTruth: { expected: 'answer' },
        targetTraceId: 'trace-gt',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-gt',
        spanId: undefined,
        score: expect.objectContaining({
          scorerId: 'ground-truth-scorer',
          scorerName: 'ground-truth-scorer',
          metadata: {
            hasGroundTruth: true,
          },
        }),
      });
    });

    it('should forward live target correlation context and metadata to addScore', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'contextual-scorer',
        description: 'Contextual scorer',
      }).generateScore(() => 0.91);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'live',
        targetTraceId: 'trace-live',
        targetSpanId: 'span-live',
        targetCorrelationContext: {
          traceId: 'trace-live',
          spanId: 'span-live',
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
        targetMetadata: {
          sessionId: 'session-1',
          inherited: true,
        },
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-live',
        spanId: 'span-live',
        correlationContext: {
          traceId: 'trace-live',
          spanId: 'span-live',
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
        score: {
          scorerId: 'contextual-scorer',
          scorerName: 'contextual-scorer',
          scoreSource: 'live',
          score: 0.91,
          metadata: {
            sessionId: 'session-1',
            inherited: true,
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should emit addScore with correlation context even when targetTraceId is absent', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'unanchored-contextual-scorer',
        description: 'Unanchored contextual scorer',
      }).generateScore(() => 0.67);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'live',
        targetCorrelationContext: {
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        correlationContext: {
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
        score: {
          scorerId: 'unanchored-contextual-scorer',
          scorerName: 'unanchored-contextual-scorer',
          scoreSource: 'live',
          score: 0.67,
          metadata: {
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should not fail scorer.run when addScore throws', async () => {
      const mockMastra = createMockMastra({
        addScoreImpl: vi.fn().mockRejectedValue(new Error('observability failed')),
      });

      const scorer = createScorer({
        id: 'resilient-scorer',
        description: 'Resilient scorer',
      }).generateScore(() => 0.8);

      scorer.__registerMastra(mockMastra as any);

      await expect(
        scorer.run({
          ...testData.scoringInput,
          scoreSource: 'live',
          targetTraceId: 'trace-456',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          score: 0.8,
        }),
      );

      expect(mockMastra.observability.addScore).toHaveBeenCalledTimes(1);
      expect(mockMastra.getLogger().warn).toHaveBeenCalled();
    });
  });
});
