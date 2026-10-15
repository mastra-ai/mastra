import { createAnswerSimilarityScorer, createToneScorer } from '@mastra/evals/scorers/prebuilt';

// Scorers for the docs agent experiments. Answer similarity compares the output
// against the dataset item's ground truth.
export const toneScorer = createToneScorer();
export const answerSimilarityScorer = createAnswerSimilarityScorer({ model: 'openai/gpt-5.4-mini' });
