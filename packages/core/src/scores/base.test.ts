import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraScorer } from './base';
import type { ScorerOptions, ScoringInput, ExtractionStepFn, AnalyzeStepFn, ReasonStepFn } from './types';

describe('MastraScorer', () => {
  let mockExtractFn: ExtractionStepFn;
  let mockAnalyzeFn: AnalyzeStepFn;
  let mockReasonFn: ReasonStepFn;
  let baseScoringInput: ScoringInput;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock functions
    mockExtractFn = vi.fn().mockResolvedValue({ result: { extractedData: 'test' } });
    mockAnalyzeFn = vi.fn().mockResolvedValue({
      score: 0.8,
      result: { results: [{ result: 'good', reason: 'quality analysis' }] },
    });
    mockReasonFn = vi.fn().mockResolvedValue({
      reason: 'test reasoning',
      reasonPrompt: 'Why did you score this way?',
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
      };

      const scorer = new MastraScorer(options);

      expect(scorer.name).toBe('test-scorer');
      expect(scorer.description).toBe('A test scorer');
      expect(scorer.analyze).toBe(mockAnalyzeFn);
      expect(scorer.extract).toBeUndefined();
      expect(scorer.reason).toBeUndefined();
      expect(scorer.metadata).toEqual({});
      expect(scorer.isLLMScorer).toBeUndefined();
    });

    it('should initialize with all optional properties', () => {
      const options: ScorerOptions = {
        name: 'test-scorer',
        description: 'A test scorer',
        extract: mockExtractFn,
        analyze: mockAnalyzeFn,
        reason: mockReasonFn,
        metadata: { custom: 'data' },
        isLLMScorer: true,
      };

      const scorer = new MastraScorer(options);

      expect(scorer.name).toBe('test-scorer');
      expect(scorer.description).toBe('A test scorer');
      expect(scorer.extract).toBe(mockExtractFn);
      expect(scorer.analyze).toBe(mockAnalyzeFn);
      expect(scorer.reason).toBe(mockReasonFn);
      expect(scorer.metadata).toEqual({ custom: 'data' });
      expect(scorer.isLLMScorer).toBe(true);
    });

    it('should initialize metadata as empty object when not provided', () => {
      const options: ScorerOptions = {
        name: 'test-scorer',
        description: 'A test scorer',
        analyze: mockAnalyzeFn,
      };

      const scorer = new MastraScorer(options);

      expect(scorer.metadata).toEqual({});
    });
  });

  describe('run method', () => {
    it('should execute workflow without extract function', async () => {
      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        analyze: mockAnalyzeFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(mockAnalyzeFn).toHaveBeenCalledWith({
        ...baseScoringInput,
        extractStepResult: undefined,
      });
      expect(result).toMatchObject({
        extractStepResult: undefined,
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
      });
    });

    it('should execute workflow with extract function', async () => {
      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        extract: mockExtractFn,
        analyze: mockAnalyzeFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(mockExtractFn).toHaveBeenCalledWith(baseScoringInput);
      expect(mockAnalyzeFn).toHaveBeenCalledWith({
        ...baseScoringInput,
        extractStepResult: { extractedData: 'test' },
      });
      expect(result).toMatchObject({
        extractStepResult: { extractedData: 'test' },
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
      });
    });

    it('should execute workflow with reason function', async () => {
      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        extract: mockExtractFn,
        analyze: mockAnalyzeFn,
        reason: mockReasonFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(mockExtractFn).toHaveBeenCalledWith(baseScoringInput);
      expect(mockAnalyzeFn).toHaveBeenCalledWith({
        ...baseScoringInput,
        extractStepResult: { extractedData: 'test' },
      });
      expect(mockReasonFn).toHaveBeenCalledWith({
        ...baseScoringInput,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
        score: 0.8,
      });
      expect(result).toMatchObject({
        extractStepResult: { extractedData: 'test' },
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
        reason: 'test reasoning',
        reasonPrompt: 'Why did you score this way?',
      });
    });

    it('should handle LLM scorer properly', async () => {
      const llmAnalyzeFn = vi.fn().mockResolvedValue({
        score: 0.9,
        result: { analysis: 'detailed analysis' },
        prompt: 'Analyze this content',
      });

      const scorer = new MastraScorer({
        name: 'llm-scorer',
        description: 'An LLM scorer',
        analyze: llmAnalyzeFn,
        isLLMScorer: true,
      });

      const result = await scorer.run(baseScoringInput);

      expect(llmAnalyzeFn).toHaveBeenCalledWith({
        ...baseScoringInput,
        extractStepResult: undefined,
      });

      expect(result).toMatchObject({
        extractStepResult: undefined,
        score: 0.9,
        analyzeStepResult: { analysis: 'detailed analysis' },
        analyzePrompt: 'Analyze this content',
      });
    });

    it('should handle non-LLM scorer properly', async () => {
      const nonLlmAnalyzeFn = vi.fn().mockResolvedValue({
        result: { additionalInfo: 'some info' },
        score: 0.7,
        additionalInfo: 'some info',
      });

      const scorer = new MastraScorer({
        name: 'non-llm-scorer',
        description: 'A non-LLM scorer',
        analyze: nonLlmAnalyzeFn,
        isLLMScorer: false,
      });

      const result = await scorer.run(baseScoringInput);

      expect(nonLlmAnalyzeFn).toHaveBeenCalledWith({
        ...baseScoringInput,
        extractStepResult: undefined,
      });

      expect(result).toMatchObject({
        extractStepResult: undefined,
        score: 0.7,
        analyzeStepResult: { additionalInfo: 'some info' },
      });
    });

    it('should handle reason function returning null', async () => {
      const nullReasonFn = vi.fn().mockResolvedValue(null);

      const scorer = new MastraScorer({
        name: 'test-scorer',
        description: 'A test scorer',
        analyze: mockAnalyzeFn,
        reason: nullReasonFn,
      });

      const result = await scorer.run(baseScoringInput);

      expect(nullReasonFn).toHaveBeenCalledWith({
        ...baseScoringInput,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
        score: 0.8,
      });
      expect(result).toMatchObject({
        extractStepResult: undefined,
        score: 0.8,
        analyzeStepResult: { results: [{ result: 'good', reason: 'quality analysis' }] },
      });
    });

    it('should throw error when workflow execution fails', async () => {
      const failingAnalyzeFn = vi.fn().mockRejectedValue(new Error('Analysis failed'));

      const scorer = new MastraScorer({
        name: 'failing-scorer',
        description: 'A failing scorer',
        analyze: failingAnalyzeFn,
      });

      await expect(scorer.run(baseScoringInput)).rejects.toThrow('Scoring pipeline failed: failed');
    });

    it('should handle extract function throwing error', async () => {
      const failingExtractFn = vi.fn().mockRejectedValue(new Error('Extract failed'));

      const scorer = new MastraScorer({
        name: 'failing-extract-scorer',
        description: 'A scorer with failing extract',
        extract: failingExtractFn,
        analyze: mockAnalyzeFn,
      });

      await expect(scorer.run(baseScoringInput)).rejects.toThrow('Scoring pipeline failed: failed');
    });

    it('should handle reason function throwing error', async () => {
      const failingReasonFn = vi.fn().mockRejectedValue(new Error('Reason failed'));

      const scorer = new MastraScorer({
        name: 'failing-reason-scorer',
        description: 'A scorer with failing reason',
        analyze: mockAnalyzeFn,
        reason: failingReasonFn,
      });

      await expect(scorer.run(baseScoringInput)).rejects.toThrow('Scoring pipeline failed: failed');
    });

    it('should create unique workflow pipeline for each scorer', async () => {
      const scorer1 = new MastraScorer({
        name: 'scorer-1',
        description: 'First scorer',
        analyze: mockAnalyzeFn,
      });

      const scorer2 = new MastraScorer({
        name: 'scorer-2',
        description: 'Second scorer',
        analyze: mockAnalyzeFn,
      });

      const result1 = await scorer1.run(baseScoringInput);
      const result2 = await scorer2.run(baseScoringInput);

      expect(result1).toEqual(result2);
      expect(mockAnalyzeFn).toHaveBeenCalledTimes(2);
    });
  });
});
