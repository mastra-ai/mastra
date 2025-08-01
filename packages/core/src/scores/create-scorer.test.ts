import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FunctionBasedScorerBuilders,
  MixedScorerBuilders,
  PromptBasedScorerBuilders,
} from './create-scorer.test-utils';

beforeEach(() => {
  vi.mock('crypto', () => ({
    randomUUID: () => 'test-uuid',
  }));
});

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

describe('createScorer', () => {
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    testData = createTestData();
  });

  describe('Steps as functions scorer', () => {
    it('should create a scorer with minimum steps required (analyze and generateScore) as functions', async () => {
      const scorer = FunctionBasedScorerBuilders.basic;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with synchronous functions', async () => {
      const scorer = FunctionBasedScorerBuilders.basicSync;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with mixed sync/async functions', async () => {
      const scorer = FunctionBasedScorerBuilders.mixedSyncAsync;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess step', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocess;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason step', async () => {
      const scorer = FunctionBasedScorerBuilders.withReason;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with all steps', async () => {
      const scorer = FunctionBasedScorerBuilders.allSteps;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and generateScore, no analyze', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessNoAnalyze;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with generateScore and generateReason, no analyze', async () => {
      const scorer = FunctionBasedScorerBuilders.withReasonNoAnalyze;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess, generateScore, and generateReason, no analyze', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndReasonNoAnalyze;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });
  });

  describe('Steps as prompt objects scorer', () => {
    it('should create a scorer with minimum steps required', async () => {
      const scorer = PromptBasedScorerBuilders.basic;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess step', async () => {
      const scorer = PromptBasedScorerBuilders.withPreprocess;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason step', async () => {
      const scorer = PromptBasedScorerBuilders.withReason;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with all steps', async () => {
      const scorer = PromptBasedScorerBuilders.withAllSteps;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });
  });

  describe('scorers with both function and prompt objects steps', () => {
    it('should create a scorer with preprocess function and analyze prompt object', async () => {
      const scorer = MixedScorerBuilders.withPreprocessFunctionAnalyzePrompt;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withPreprocessPromptAnalyzeFunction;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason function and analyze prompt object', async () => {
      const scorer = MixedScorerBuilders.withReasonFunctionAnalyzePrompt;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withReasonPromptAnalyzeFunction;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });
  });
});
