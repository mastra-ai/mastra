import { openai } from '@ai-sdk/openai';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';

export const answerRelevance = createAnswerRelevancyScorer({
  model: openai('gpt-4o'),
});
