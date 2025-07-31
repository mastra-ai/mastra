import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, beforeEach } from 'vitest';
import z from 'zod';
import { createNewScorer } from './scorer';
import { FunctionBasedScorerBuilders, MixedScorerBuilders, PromptBasedScorerBuilders } from './scorer.test-utils';

export const AsyncFunctionBasedScorerBuilders = {
  basic: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  }).generateScore(async () => {
    return 1;
  }),

  withPreprocess: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(async ({ run }) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .generateScore(async ({ results }) => {
      if (
        results.preprocessStepResult?.reformattedInput.length > 0 &&
        results.preprocessStepResult?.reformattedOutput.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  withPreprocessFunctionAndAnalyzePromptObject: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(async ({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .analyze({
      description: 'Analyze the input and output',
      outputSchema: z.object({
        inputFromAnalyze: z.string(),
        outputFromAnalyze: z.string(),
      }),
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: `{
                "inputFromAnalyze": "TEST INPUT",
                "outputFromAnalyze": "TEST OUTPUT"
              }`,
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        instructions: 'Analyze the input and output',
      },
      createPrompt: ({ run }) => {
        return `Analyze the input and output: ${run.input?.[0]?.content} and ${run.output.text}`;
      },
    })
    .generateScore(async ({ results }) => {
      if (
        results.analyzeStepResult?.inputFromAnalyze.length > 0 &&
        results.analyzeStepResult?.outputFromAnalyze.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  withPreprocessPromptObjectAndAnalyzeFunction: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess({
      description: 'Preprocess the input and output',
      outputSchema: z.object({
        reformattedInput: z.string(),
        reformattedOutput: z.string(),
      }),
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: `{
              "reformattedInput": "TEST INPUT",
              "reformattedOutput": "TEST OUTPUT"
            }`,
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        instructions: 'Analyze the input and output',
      },
      createPrompt: ({ run }) => {
        return `Analyze the input and output: ${run.input?.[0]?.content} and ${run.output.text}`;
      },
    })
    .analyze(async ({ results }) => {
      return {
        inputFromAnalyze: results.preprocessStepResult?.reformattedInput.toUpperCase(),
        outputFromAnalyze: results.preprocessStepResult?.reformattedOutput.toUpperCase(),
      };
    })
    .generateScore(async ({ results }) => {
      if (
        results.analyzeStepResult?.inputFromAnalyze.length > 0 &&
        results.analyzeStepResult?.outputFromAnalyze.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  // Test async createPrompt in preprocess
  withAsyncCreatePromptInPreprocess: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess({
      description: 'Preprocess with async createPrompt',
      outputSchema: z.object({
        reformattedInput: z.string(),
        reformattedOutput: z.string(),
      }),
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: `{
              "reformattedInput": "ASYNC TEST INPUT",
              "reformattedOutput": "ASYNC TEST OUTPUT"
            }`,
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        instructions: 'Analyze the input and output',
      },
      createPrompt: async ({ run }) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 5));
        return `Async prompt: ${run.input?.[0]?.content} and ${run.output.text}`;
      },
    })
    .generateScore(async ({ results }) => {
      if (
        results.preprocessStepResult?.reformattedInput.length > 0 &&
        results.preprocessStepResult?.reformattedOutput.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  // Test async createPrompt in analyze
  withAsyncCreatePromptInAnalyze: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(async ({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .analyze({
      description: 'Analyze with async createPrompt',
      outputSchema: z.object({
        inputFromAnalyze: z.string(),
        outputFromAnalyze: z.string(),
      }),
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: `{
              "inputFromAnalyze": "ASYNC ANALYZE INPUT",
              "outputFromAnalyze": "ASYNC ANALYZE OUTPUT"
            }`,
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        instructions: 'Analyze the input and output',
      },
      createPrompt: async ({ results }) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 5));
        const preprocessResult = results.preprocessStepResult as {
          reformattedInput: string;
          reformattedOutput: string;
        };
        return `Async analyze prompt: ${preprocessResult?.reformattedInput} and ${preprocessResult?.reformattedOutput}`;
      },
    })
    .generateScore(async ({ results }) => {
      if (
        results.analyzeStepResult?.inputFromAnalyze.length > 0 &&
        results.analyzeStepResult?.outputFromAnalyze.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  // Test async createPrompt in generateScore
  withAsyncCreatePromptInGenerateScore: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(async ({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .generateScore({
      description: 'Generate score with async createPrompt',
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: `{"score": 0.85}`,
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        instructions: 'Generate a score',
      },
      createPrompt: async ({ results }) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 5));
        const preprocessResult = results.preprocessStepResult as {
          reformattedInput: string;
          reformattedOutput: string;
        };
        return `Async score prompt: ${preprocessResult?.reformattedInput} and ${preprocessResult?.reformattedOutput}`;
      },
    }),

  // Test async createPrompt in generateReason
  withAsyncCreatePromptInGenerateReason: createNewScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(async ({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .generateScore(async ({ results }) => {
      if (
        results.preprocessStepResult?.reformattedInput.length > 0 &&
        results.preprocessStepResult?.reformattedOutput.length > 0
      ) {
        return 1;
      }
      return 0;
    })
    .generateReason({
      description: 'Generate reason with async createPrompt',
      judge: {
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            text: 'This is an async reason for the score',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        instructions: 'Generate a reason',
      },
      createPrompt: async ({ results, score }) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 5));
        const preprocessResult = results.preprocessStepResult as {
          reformattedInput: string;
          reformattedOutput: string;
        };
        return `Async reason prompt: Score ${score} for ${preprocessResult?.reformattedInput} and ${preprocessResult?.reformattedOutput}`;
      },
    }),
};

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
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withReason;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndReason;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and analyze', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyze;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess only', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocess;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess, analyze, and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyzeAndReason;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze only', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyze;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyzeAndReason;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });
  });

  describe('Steps as prompt objects scorer', () => {
    it('with analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyze;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with preprocess and analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withPreprocessAndAnalyze;

      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with analyze and reason prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyzeAndReason;
      const result = await scorer.run(testData.scoringInput);

      expect(typeof result.reason).toBe('string');
      expect(result).toMatchSnapshot();
    });

    it('with generate score as prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withGenerateScoreAsPromptObject;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with all steps', async () => {
      const scorer = PromptBasedScorerBuilders.withAllSteps;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });
  });

  describe('Mixed scorer', () => {
    it('with preprocess function and analyze prompt object', async () => {
      const scorer = MixedScorerBuilders.withPreprocessFunctionAnalyzePrompt;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withPreprocessPromptAnalyzeFunction;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with reason function and analyze prompt', async () => {
      const scorer = MixedScorerBuilders.withReasonFunctionAnalyzePrompt;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with reason prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withReasonPromptAnalyzeFunction;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });
  });

  describe('Async scorer', () => {
    it('with basic', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.basic;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocess;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with preprocess function and analyze as prompt object', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessFunctionAndAnalyzePromptObject;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt object and analyze function', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessPromptObjectAndAnalyzeFunction;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInPreprocess;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in analyze', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInAnalyze;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateScore', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateScore;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateReason', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateReason;
      const result = await scorer.run(testData.scoringInput);

      expect(result).toMatchSnapshot();
    });
  });
});
