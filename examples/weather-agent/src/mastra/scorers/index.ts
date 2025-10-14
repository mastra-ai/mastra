import { openai } from '@ai-sdk/openai';
import { createPromptAlignmentScorerLLM } from '@mastra/evals/scorers/llm';
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/code';
import { createCompletenessScorer } from '@mastra/evals/scorers/code';
import { weatherTool } from '../tools';

export const promptAlignmentScorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
});

export const toolCallAccuracyScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weatherTool',
  strictMode: false,
});

export const completenessScorer = createCompletenessScorer();

export const scorers = {
  toolCallAccuracyScorer,
  promptAlignmentScorer,
  completenessScorer,
};
