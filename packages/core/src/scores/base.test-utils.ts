import { MockLanguageModelV1 } from 'ai/test';
import z from 'zod';
import { createScorer } from './base';

// Function-based scorer builders
export const FunctionBasedScorerBuilders = {
  basic: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  }).generateScore(({ run }) => {
    if (run.input?.[0]?.content.length > 0 && run.output.text.length > 0) {
      return 1;
    }
    return 0;
  }),

  withPreprocess: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .generateScore(({ results }) => {
      if (
        results.preprocessStepResult?.reformattedInput.length > 0 &&
        results.preprocessStepResult?.reformattedOutput.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  withPreprocessAndAnalyze: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .analyze(({ results }) => {
      return {
        inputFromAnalyze: results.preprocessStepResult?.reformattedInput + `!`,
        outputFromAnalyze: results.preprocessStepResult?.reformattedOutput + `!`,
      };
    })
    .generateScore(({ results }) => {
      if (
        results.analyzeStepResult?.inputFromAnalyze.length > 0 &&
        results.analyzeStepResult?.outputFromAnalyze.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  withPreprocessAndAnalyzeAndReason: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .analyze(({ results }) => {
      return {
        inputFromAnalyze: results.preprocessStepResult?.reformattedInput + `!`,
        outputFromAnalyze: results.preprocessStepResult?.reformattedOutput + `!`,
      };
    })
    .generateScore(({ results }) => {
      if (
        results.analyzeStepResult?.inputFromAnalyze.length > 0 &&
        results.analyzeStepResult?.outputFromAnalyze.length > 0
      ) {
        return 1;
      }
      return 0;
    })
    .generateReason(({ score, results }) => {
      return `the reason the score is ${score} is because the input is ${results.analyzeStepResult?.inputFromAnalyze} and the output is ${results.analyzeStepResult?.outputFromAnalyze}`;
    }),

  withPreprocessAndReason: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(({ run }) => {
      return {
        reformattedInput: run.input?.[0]?.content.toUpperCase(),
        reformattedOutput: run.output.text.toUpperCase(),
      };
    })
    .generateScore(({ results }) => {
      if (
        results.preprocessStepResult?.reformattedInput.length > 0 &&
        results.preprocessStepResult?.reformattedOutput.length > 0
      ) {
        return 1;
      }
      return 0;
    })
    .generateReason(({ score, results }) => {
      return `the reason the score is ${score} is because the input is ${results.preprocessStepResult?.reformattedInput} and the output is ${results.preprocessStepResult?.reformattedOutput}`;
    }),

  withAnalyze: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .analyze(({ run }) => {
      return {
        inputFromAnalyze: run.input?.[0]?.content + `!`,
        outputFromAnalyze: run.output.text + `!`,
      };
    })
    .generateScore(({ results }) => {
      if (
        results.analyzeStepResult?.inputFromAnalyze.length > 0 &&
        results.analyzeStepResult?.outputFromAnalyze.length > 0
      ) {
        return 1;
      }
      return 0;
    }),

  withAnalyzeAndReason: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .analyze(({ run }) => {
      return {
        inputFromAnalyze: run.input?.[0]?.content + `!`,
        outputFromAnalyze: run.output.text + `!`,
      };
    })
    .generateScore(({ results }) => {
      if (
        results.analyzeStepResult?.inputFromAnalyze.length > 0 &&
        results.analyzeStepResult?.outputFromAnalyze.length > 0
      ) {
        return 1;
      }
      return 0;
    })
    .generateReason(({ score, results }) => {
      return `the reason the score is ${score} is because the input is ${results.analyzeStepResult?.inputFromAnalyze} and the output is ${results.analyzeStepResult?.outputFromAnalyze}`;
    }),

  withReason: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .generateScore(({ run }) => {
      return run.input ? 1 : 0;
    })
    .generateReason(({ score, run }) => {
      return `the reason the score is ${score} is because the input is ${run.input?.[0]?.content} and the output is ${run.output.text}`;
    }),
};

export const PromptBasedScorerBuilders = {
  withAnalyze: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .analyze({
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                        "inputLength": 10,
                        "outputLength": 11
                    }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Analyze the input and output',
      outputSchema: z.object({
        inputLength: z.number(),
        outputLength: z.number(),
      }),
      createPrompt: () => {
        return `Test Analyze prompt`;
      },
    })
    .generateScore(({ results }) => {
      const inputLength = results.analyzeStepResult?.inputLength;
      const outputLength = results.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    }),

  withPreprocessAndAnalyze: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess({
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                              "reformattedInput": "TEST INPUT",
                              "reformattedOutput": "TEST OUTPUT"
                          }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Preprocess the input and output',
      outputSchema: z.object({
        reformattedInput: z.string(),
        reformattedOutput: z.string(),
      }),
      createPrompt: () => {
        return `Test Preprocess prompt`;
      },
    })
    .analyze({
      description: 'Analyze the input and output',
      outputSchema: z.object({
        inputLength: z.number(),
        outputLength: z.number(),
      }),
      createPrompt: () => {
        return `Test Analyze prompt`;
      },
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                          "inputLength": 10,
                          "outputLength": 11
                      }`,
          }),
        }),
        instructions: `Test instructions`,
      },
    })
    .generateScore(({ results }) => {
      const inputLength = results.analyzeStepResult?.inputLength;
      const outputLength = results.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    }),

  withAnalyzeAndReason: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .analyze({
      description: 'Analyze the input and output',
      outputSchema: z.object({
        inputLength: z.number(),
        outputLength: z.number(),
      }),
      createPrompt: () => {
        return `Test Analyze prompt`;
      },
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                          "inputLength": 10,
                          "outputLength": 11
                      }`,
          }),
        }),
        instructions: `Test instructions`,
      },
    })
    .generateScore(({ results }) => {
      const inputLength = results.analyzeStepResult?.inputLength;
      const outputLength = results.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    })
    .generateReason({
      judge: {
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `This is a test reason`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Generate a reason for the score',
      createPrompt: () => {
        return `Test Generate Reason prompt`;
      },
    }),

  withGenerateScoreAsPromptObject: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .generateScore({
      description: 'Generate a score',
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{"score": 1}`,
          }),
        }),
        instructions: `Test instructions`,
      },
      createPrompt: () => {
        return `Test Generate Score prompt`;
      },
    })
    .generateReason(({ score, run }) => {
      return `the reason the score is ${score} is because the input is ${JSON.stringify(run.input)} and the output is ${JSON.stringify(run.output)}`;
    }),

  withAllSteps: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess({
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                              "reformattedInput": "TEST INPUT",
                              "reformattedOutput": "TEST OUTPUT"
                          }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Preprocess the input and output',
      outputSchema: z.object({
        reformattedInput: z.string(),
        reformattedOutput: z.string(),
      }),
      createPrompt: () => {
        return `Test Preprocess prompt`;
      },
    })
    .analyze({
      description: 'Analyze the input and output',
      outputSchema: z.object({
        inputLength: z.number(),
        outputLength: z.number(),
      }),
      createPrompt: () => {
        return `Test Analyze prompt`;
      },
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                          "inputLength": 10,
                          "outputLength": 11
                      }`,
          }),
        }),
        instructions: `Test instructions`,
      },
    })
    .generateScore(({ results }) => {
      const inputLength = results.analyzeStepResult?.inputLength;
      const outputLength = results.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    })
    .generateReason({
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `this is a reason.`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Generate a reason for the score',
      createPrompt: () => {
        return `Test Generate Reason prompt`;
      },
    }),
};

export const MixedScorerBuilders = {
  withPreprocessFunctionAnalyzePrompt: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess(({ run }) => ({
      reformattedInput: run.input?.[0]?.content.toUpperCase() + ' from preprocess function!',
      reformattedOutput: run.output.text.toUpperCase() + ' from preprocess function!',
    }))
    .analyze({
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                          "inputLength": 10,
                          "outputLength": 11
                      }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Analyze the input and output',
      outputSchema: z.object({
        inputLength: z.number(),
        outputLength: z.number(),
      }),
      createPrompt: () => {
        return `Test Analyze prompt`;
      },
    })
    .generateScore(({ results }) => {
      const inputLength = results.analyzeStepResult?.inputLength;
      const outputLength = results.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    }),

  withPreprocessPromptAnalyzeFunction: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .preprocess({
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                              "reformattedInput": "TEST INPUT from preprocess prompt!",
                              "reformattedOutput": "TEST OUTPUT from preprocess prompt!"
                          }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Preprocess the input and output',
      outputSchema: z.object({
        reformattedInput: z.string(),
        reformattedOutput: z.string(),
      }),
      createPrompt: () => {
        return `Test Preprocess prompt`;
      },
    })
    .analyze(({ results }) => ({
      inputFromAnalyze: results.preprocessStepResult?.reformattedInput + `!`,
      outputFromAnalyze: results.preprocessStepResult?.reformattedOutput + `!`,
    }))
    .generateScore(({ results }) => {
      const { analyzeStepResult, preprocessStepResult } = results;
      const lengths = [
        analyzeStepResult?.inputFromAnalyze.length,
        results.analyzeStepResult?.outputFromAnalyze.length,
        preprocessStepResult?.reformattedInput.length,
        preprocessStepResult?.reformattedOutput.length,
      ];
      return lengths.every(len => len !== undefined) ? 1 : 0;
    }),

  withReasonFunctionAnalyzePrompt: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .analyze({
      description: 'Analyze the input and output',
      outputSchema: z.object({
        inputLength: z.number(),
        outputLength: z.number(),
      }),
      createPrompt: () => {
        return `Test Analyze prompt`;
      },
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                          "inputLength": 10,
                          "outputLength": 11
                      }`,
          }),
        }),
        instructions: `Test instructions`,
      },
    })
    .generateScore(({ results }) => {
      const inputLength = results.analyzeStepResult?.inputLength;
      const outputLength = results.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    })
    .generateReason(
      ({ results }) =>
        `the reason is because the input is ${results.analyzeStepResult?.inputLength} and the output is ${results.analyzeStepResult?.outputLength} from generateReason function`,
    ),

  withReasonPromptAnalyzeFunction: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  })
    .analyze(({ run }) => ({
      inputFromAnalyze: run.input?.[0]?.content + ` from analyze function!`,
      outputFromAnalyze: run.output.text + ` from analyze function!`,
    }))
    .generateScore(({ results }) => {
      const inputLength = results.analyzeStepResult?.inputFromAnalyze.length;
      const outputLength = results.analyzeStepResult?.outputFromAnalyze.length;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    })
    .generateReason({
      judge: {
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `This is the reason.`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Generate a reason for the score',
      createPrompt: () => {
        return `Test Generate Reason prompt`;
      },
    }),
};

export const AsyncFunctionBasedScorerBuilders = {
  basic: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
  }).generateScore(async () => {
    return 1;
  }),

  withPreprocess: createScorer({
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

  withPreprocessFunctionAndAnalyzePromptObject: createScorer({
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

  withPreprocessPromptObjectAndAnalyzeFunction: createScorer({
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
  withAsyncCreatePromptInPreprocess: createScorer({
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
  withAsyncCreatePromptInAnalyze: createScorer({
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
  withAsyncCreatePromptInGenerateScore: createScorer({
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
  withAsyncCreatePromptInGenerateReason: createScorer({
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
