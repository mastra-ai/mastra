import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraScorer } from './base';
import type {
  ScorerOptions,
  ScoringInput,
  PreprocessStepFn,
  InternalAnalyzeStepFn,
  InternalReasonStepFn,
  GenerateScoreStepFn,
} from './types';

describe('MastraScorer', () => {
  let mockPreprocessFn: PreprocessStepFn;
  let mockAnalyzeFn: InternalAnalyzeStepFn;
  let mockGenerateScoreFn: GenerateScoreStepFn;
  let mockReasonFn: InternalReasonStepFn;
  let baseScoringInput: ScoringInput;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock functions
    mockPreprocessFn = vi.fn().mockResolvedValue({ result: { extractedData: 'test' } });
    mockAnalyzeFn = vi.fn().mockResolvedValue({
      result: { results: [{ result: 'good', reason: 'quality analysis' }] },
      prompt: 'Analyze this content',
    });
    mockGenerateScoreFn = vi.fn().mockResolvedValue(0.8);
    mockReasonFn = vi.fn().mockResolvedValue({
      reason: 'test reasoning',
      prompt: 'Why did you score this way?',
    });

    // Base scoring input for tests
    baseScoringInput = {
      runId: 'test-run-id',
      input: [{ message: 'test input' }],
      output: { response: 'test output' },
      additionalContext: { context: 'test' },
      runtimeContext: { runtime: 'test' },
    };
  });

  describe('constructor', () => {
    it('should initialize with required properties', () => {
      const options: ScorerOptions = {
        name: 'test-scorer',
        description: 'A test scorer',
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      };

      const scorer = new MastraScorer(options);

      expect(scorer.name).toBe('test-scorer');
      expect(scorer.description).toBe('A test scorer');
      expect(scorer.analyze).toBe(mockAnalyzeFn);
      expect(scorer.generateScore).toBe(mockGenerateScoreFn);
      expect(scorer.preprocess).toBeUndefined();
      expect(scorer.reason).toBeUndefined();
      expect(scorer.metadata).toEqual({});
    });

    it('should initialize with all optional properties', () => {
      const options: ScorerOptions = {
        name: 'test-scorer',
        description: 'A test scorer',
        preprocess: mockPreprocessFn,
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
        reason: mockReasonFn,
        metadata: { custom: 'data' },
        isLLMScorer: true,
      };

      const scorer = new MastraScorer(options);

      expect(scorer.name).toBe('test-scorer');
      expect(scorer.description).toBe('A test scorer');
      expect(scorer.preprocess).toBe(mockPreprocessFn);
      expect(scorer.analyze).toBe(mockAnalyzeFn);
      expect(scorer.generateScore).toBe(mockGenerateScoreFn);
      expect(scorer.reason).toBe(mockReasonFn);
      expect(scorer.metadata).toEqual({ custom: 'data' });
    });

    it('should initialize metadata as empty object when not provided', () => {
      const options: ScorerOptions = {
        name: 'test-scorer',
        description: 'A test scorer',
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      };

      const scorer = new MastraScorer(options);

      expect(scorer.metadata).toEqual({});
    });
  });

  describe('run method', () => {
    it('should execute workflow without preprocess function', async () => {
      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(mockAnalyzeFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: undefined,
        },
      });
      expect(mockGenerateScoreFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: undefined,
          analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
          analyzePrompt: 'Analyze this content',
        },
      });
      expect(result).toMatchObject({
        runId: baseScoringInput.runId,
        preprocessStepResult: undefined,
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
        analyzePrompt: 'Analyze this content',
      });
    });

    it('should execute workflow with preprocess function', async () => {
      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        preprocess: mockPreprocessFn,
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(mockPreprocessFn).toHaveBeenCalledWith({
        run: baseScoringInput,
      });
      expect(mockAnalyzeFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: { extractedData: 'test' },
        },
      });
      expect(mockGenerateScoreFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: { extractedData: 'test' },
          analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
          analyzePrompt: 'Analyze this content',
        },
      });
      expect(result).toMatchObject({
        runId: baseScoringInput.runId,
        preprocessStepResult: { extractedData: 'test' },
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
        analyzePrompt: 'Analyze this content',
      });
    });

    it('should execute workflow with reason function', async () => {
      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        preprocess: mockPreprocessFn,
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
        reason: mockReasonFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(mockPreprocessFn).toHaveBeenCalledWith({
        run: baseScoringInput,
      });
      expect(mockAnalyzeFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: { extractedData: 'test' },
        },
      });
      expect(mockGenerateScoreFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: { extractedData: 'test' },
          analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
          analyzePrompt: 'Analyze this content',
        },
      });
      expect(mockReasonFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: { extractedData: 'test' },
          analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
          score: 0.8,
        },
      });

      expect(result).toMatchObject({
        runId: baseScoringInput.runId,
        preprocessStepResult: { extractedData: 'test' },
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
        reason: 'test reasoning',
        reasonPrompt: 'Why did you score this way?',
      });
    });

    it('should handle LLM scorer properly', async () => {
      const llmAnalyzeFn = vi.fn().mockResolvedValue({
        result: { analysis: 'detailed analysis' },
        prompt: 'Analyze this content',
      });

      const scorer = new MastraScorer({
        name: 'llm-scorer',
        description: 'An LLM scorer',
        analyze: llmAnalyzeFn,
        generateScore: mockGenerateScoreFn,
        isLLMScorer: true,
      });

      const result = await scorer.run(baseScoringInput);

      expect(llmAnalyzeFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: undefined,
        },
      });

      expect(result).toMatchObject({
        runId: baseScoringInput.runId,
        preprocessStepResult: undefined,
        score: 0.8,
        analyzeStepResult: { analysis: 'detailed analysis' },
        analyzePrompt: 'Analyze this content',
      });
    });

    it('should handle non-LLM scorer properly', async () => {
      const nonLlmAnalyzeFn = vi.fn().mockResolvedValue({
        result: { additionalInfo: 'some info' },
      });

      const scorer = new MastraScorer({
        name: 'non-llm-scorer',
        description: 'A non-LLM scorer',
        analyze: nonLlmAnalyzeFn,
        generateScore: mockGenerateScoreFn,
        isLLMScorer: false,
      });

      const result = await scorer.run(baseScoringInput);

      expect(nonLlmAnalyzeFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: undefined,
        },
      });

      expect(result).toMatchObject({
        runId: baseScoringInput.runId,
        preprocessStepResult: undefined,
        score: 0.8,
        analyzeStepResult: { additionalInfo: 'some info' },
      });
    });

    it('should handle reason function returning null', async () => {
      const nullReasonFn = vi.fn().mockResolvedValue(null);

      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
        reason: nullReasonFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(nullReasonFn).toHaveBeenCalledWith({
        run: {
          ...baseScoringInput,
          preprocessStepResult: undefined,
          analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
          score: 0.8,
        },
      });
      expect(result).toMatchObject({
        runId: baseScoringInput.runId,
        preprocessStepResult: undefined,
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
        analyzePrompt: 'Analyze this content',
      });
    });

    it('should throw error when workflow execution fails', async () => {
      const failingAnalyzeFn = vi.fn().mockRejectedValue(new Error('Analysis failed'));

      const scorer = new MastraScorer({
        name: 'failing-scorer',
        description: 'A failing scorer',
        analyze: failingAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      });

      await expect(scorer.run(baseScoringInput)).rejects.toThrow('Scoring pipeline failed: failed');
    });

    it('should handle preprocess function throwing error', async () => {
      const failingPreprocessFn = vi.fn().mockRejectedValue(new Error('Preprocess failed'));

      const scorer = new MastraScorer({
        name: 'failing-preprocess-scorer',
        description: 'A scorer with failing preprocess',
        preprocess: failingPreprocessFn,
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      });

      await expect(scorer.run(baseScoringInput)).rejects.toThrow('Scoring pipeline failed: failed');
    });

    it('should handle reason function throwing error', async () => {
      const failingReasonFn = vi.fn().mockRejectedValue(new Error('Reason failed'));

      const scorer = new MastraScorer({
        name: 'failing-reason-scorer',
        description: 'A scorer with failing reason',
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
        reason: failingReasonFn,
      });

      await expect(scorer.run(baseScoringInput)).rejects.toThrow('Scoring pipeline failed: failed');
    });

    it('should create unique workflow pipeline for each scorer', async () => {
      const scorer1 = new MastraScorer({
        name: 'scorer-1',
        description: 'First scorer',
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      });

      const scorer2 = new MastraScorer({
        name: 'scorer-2',
        description: 'Second scorer',
        analyze: mockAnalyzeFn,
        generateScore: mockGenerateScoreFn,
      });

      const result1 = await scorer1.run(baseScoringInput);
      const result2 = await scorer2.run(baseScoringInput);

      expect(result1).toEqual(result2);
      expect(mockAnalyzeFn).toHaveBeenCalledTimes(2);
      expect(mockGenerateScoreFn).toHaveBeenCalledTimes(2);
    });
  });
});
