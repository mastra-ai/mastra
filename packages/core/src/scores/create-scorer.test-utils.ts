import { MockLanguageModelV1 } from 'ai/test';
import { z } from 'zod';
import { createScorer } from './create-scorer';

// Function-based scorer builders
export const FunctionBasedScorerBuilders = {
  basic: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    analyze: async ({ run }) => ({
      input: run.input?.[0]?.content,
      output: run.output.text,
    }),
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.input.length;
      const outputLength = run.analyzeStepResult?.output.length;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
  }),

  // New: Sync examples
  basicSync: createScorer({
    name: 'test-scorer-sync',
    description: 'A test scorer with sync functions',
    analyze: ({ run }) => ({
      input: run.input?.[0]?.content,
      output: run.output.text,
    }),
    generateScore: ({ run }) => {
      const inputLength = run.analyzeStepResult?.input.length;
      const outputLength = run.analyzeStepResult?.output.length;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
  }),

  mixedSyncAsync: createScorer({
    name: 'test-scorer-mixed',
    description: 'A test scorer with mixed sync/async functions',
    preprocess: ({ run }) => ({
      reformattedInput: run.input?.[0]?.content.toUpperCase(),
      reformattedOutput: run.output.text.toUpperCase(),
    }),
    analyze: async ({ run }) => ({
      inputFromAnalyze: run.preprocessStepResult?.reformattedInput + `!`,
      outputFromAnalyze: run.preprocessStepResult?.reformattedOutput + `!`,
    }),
    generateScore: ({ run }) => {
      const { analyzeStepResult, preprocessStepResult } = run;
      const lengths = [
        analyzeStepResult?.inputFromAnalyze.length,
        analyzeStepResult?.outputFromAnalyze.length,
        preprocessStepResult?.reformattedInput.length,
        preprocessStepResult?.reformattedOutput.length,
      ];
      return lengths.every(len => len !== undefined) ? 1 : 0;
    },
    generateReason: ({ run }) =>
      `the reason the score is 1 is because the input is ${run.analyzeStepResult?.inputFromAnalyze} and the output is ${run.analyzeStepResult?.outputFromAnalyze}`,
  }),

  withPreprocess: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    preprocess: async ({ run }) => ({
      reformattedInput: run.input?.[0]?.content.toUpperCase(),
      reformattedOutput: run.output.text.toUpperCase(),
    }),
    analyze: async ({ run }) => ({
      inputFromAnalyze: run.preprocessStepResult?.reformattedInput + `!`,
      outputFromAnalyze: run.preprocessStepResult?.reformattedOutput + `!`,
    }),
    generateScore: async ({ run }) => {
      const { analyzeStepResult, preprocessStepResult } = run;
      const lengths = [
        analyzeStepResult?.inputFromAnalyze.length,
        analyzeStepResult?.outputFromAnalyze.length,
        preprocessStepResult?.reformattedInput.length,
        preprocessStepResult?.reformattedOutput.length,
      ];
      return lengths.every(len => len !== undefined) ? 1 : 0;
    },
  }),

  withReason: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    analyze: async ({ run }) => ({
      input: run.input?.[0]?.content,
      output: run.output.text,
    }),
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.input.length;
      const outputLength = run.analyzeStepResult?.output.length;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
    generateReason: async ({ run }) =>
      `the reason is because the input is ${run.analyzeStepResult?.input} and the output is ${run.analyzeStepResult?.output}`,
  }),

  allSteps: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    preprocess: async ({ run }) => ({
      reformattedInput: run.input?.[0]?.content.toUpperCase(),
      reformattedOutput: run.output.text.toUpperCase(),
    }),
    analyze: async ({ run }) => ({
      inputFromAnalyze: run.preprocessStepResult?.reformattedInput + `!`,
      outputFromAnalyze: run.preprocessStepResult?.reformattedOutput + `!`,
    }),
    generateScore: async ({ run }) => {
      const { analyzeStepResult, preprocessStepResult } = run;
      const lengths = [
        analyzeStepResult?.inputFromAnalyze.length,
        analyzeStepResult?.outputFromAnalyze.length,
        preprocessStepResult?.reformattedInput.length,
        preprocessStepResult?.reformattedOutput.length,
      ];
      return lengths.every(len => len !== undefined) ? 1 : 0;
    },
    generateReason: async ({ run }) =>
      `the reason the score is 1 is because the input is ${run.analyzeStepResult?.inputFromAnalyze} and the output is ${run.analyzeStepResult?.outputFromAnalyze}`,
  }),

  withPreprocessNoAnalyze: createScorer({
    name: 'preprocess-only-scorer',
    description: 'A scorer with preprocess and generateScore, no analyze',
    preprocess: async ({ run }) => ({
      cleanedInput: run.input?.[0]?.content?.trim() || '',
      cleanedOutput: run.output?.text?.trim() || '',
    }),
    generateScore: async ({ run }) => {
      if (run.preprocessStepResult?.cleanedInput.length > 0 && run.preprocessStepResult?.cleanedOutput.length > 0) {
        return 1;
      }
      return 0;
    },
  }),

  withReasonNoAnalyze: createScorer({
    name: 'score-reason-scorer',
    description: 'A scorer with generateScore and generateReason, no analyze',
    generateScore: async () => 1,
    generateReason: async ({ run }) => {
      const inputText = run.input?.[0]?.content || '';
      const outputText = run.output?.text || '';
      return `Scored ${inputText.length + outputText.length} characters total`;
    },
  }),

  withPreprocessAndReasonNoAnalyze: createScorer({
    name: 'full-no-analyze-scorer',
    description: 'A scorer with preprocess, generateScore, and generateReason, no analyze',
    preprocess: async ({ run }) => ({
      wordCount: run.input?.[0]?.content?.split(' ').length || 0,
      charCount: run.output?.text?.length || 0,
    }),
    generateScore: async ({ run }) => {
      if (run.preprocessStepResult?.wordCount > 0 && run.preprocessStepResult?.charCount > 0) {
        return 1;
      }
      return 0;
    },
    generateReason: async ({ run }) => {
      return `Input has ${run.preprocessStepResult?.wordCount} words, output has ${run.preprocessStepResult?.charCount} characters`;
    },
  }),
};

export const PromptBasedScorerBuilders = {
  basic: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    analyze: {
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
    },
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.inputLength;
      const outputLength = run.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
  }),

  withPreprocess: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    preprocess: {
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
    },
    analyze: {
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
    },
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.inputLength;
      const outputLength = run.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
  }),

  withReason: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    analyze: {
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
    },
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.inputLength;
      const outputLength = run.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
    generateReason: {
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                            "reason": "TEST REASON"
                        }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Generate a reason for the score',
      createPrompt: () => {
        return `Test Generate Reason prompt`;
      },
    },
  }),

  withAllSteps: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    preprocess: {
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
    },
    analyze: {
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
    },
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.inputLength;
      const outputLength = run.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
    generateReason: {
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                            "reason": "TEST REASON"
                        }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Generate a reason for the score',
      createPrompt: () => {
        return `Test Generate Reason prompt`;
      },
    },
  }),
};

export const MixedScorerBuilders = {
  withPreprocessFunctionAnalyzePrompt: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    preprocess: async ({ run }) => ({
      reformattedInput: run.input?.[0]?.content.toUpperCase() + ' from preprocess function!',
      reformattedOutput: run.output.text.toUpperCase() + ' from preprocess function!',
    }),
    analyze: {
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
    },
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.inputLength;
      const outputLength = run.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
  }),

  withPreprocessPromptAnalyzeFunction: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    preprocess: {
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
    },
    analyze: async ({ run }) => ({
      inputFromAnalyze: run.preprocessStepResult?.reformattedInput + `!`,
      outputFromAnalyze: run.preprocessStepResult?.reformattedOutput + `!`,
    }),
    generateScore: async ({ run }) => {
      const { analyzeStepResult, preprocessStepResult } = run;
      const lengths = [
        analyzeStepResult?.inputFromAnalyze.length,
        analyzeStepResult?.outputFromAnalyze.length,
        preprocessStepResult?.reformattedInput.length,
        preprocessStepResult?.reformattedOutput.length,
      ];
      return lengths.every(len => len !== undefined) ? 1 : 0;
    },
  }),

  withReasonFunctionAnalyzePrompt: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    analyze: {
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
    },
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.inputLength;
      const outputLength = run.analyzeStepResult?.outputLength;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
    generateReason: async ({ run }) =>
      `the reason is because the input is ${run.analyzeStepResult?.inputLength} and the output is ${run.analyzeStepResult?.outputLength} from generateReason function`,
  }),

  withReasonPromptAnalyzeFunction: createScorer({
    name: 'test-scorer',
    description: 'A test scorer',
    analyze: async ({ run }) => ({
      inputFromAnalyze: run.input?.[0]?.content + ` from analyze function!`,
      outputFromAnalyze: run.output.text + ` from analyze function!`,
    }),
    generateScore: async ({ run }) => {
      const inputLength = run.analyzeStepResult?.inputFromAnalyze.length;
      const outputLength = run.analyzeStepResult?.outputFromAnalyze.length;
      return inputLength !== undefined && outputLength !== undefined ? 1 : 0;
    },
    generateReason: {
      judge: {
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `{
                            "reason": "TEST REASON"
                        }`,
          }),
        }),
        instructions: `Test instructions`,
      },
      description: 'Generate a reason for the score',
      createPrompt: () => {
        return `Test Generate Reason prompt`;
      },
    },
  }),
};
