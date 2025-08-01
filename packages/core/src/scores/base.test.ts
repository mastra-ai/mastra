import { describe, it, expect, beforeEach } from 'vitest';
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
});
