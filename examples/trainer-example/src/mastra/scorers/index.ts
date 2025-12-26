import { openai } from '@ai-sdk/openai';
import {
  createAnswerRelevancyScorer,
  createToneScorer,
  createCompletenessScorer,
} from '@mastra/evals/scorers/prebuilt';

/**
 * Answer Relevancy Scorer
 *
 * Evaluates how well the agent's response addresses the user's question.
 * Higher scores indicate more relevant and on-topic responses.
 */
export const relevancyScorer = createAnswerRelevancyScorer({
  model: openai('gpt-4o-mini'),
  options: {
    uncertaintyWeight: 0.3,
    scale: 1,
  },
});

/**
 * Tone Scorer
 *
 * Analyzes the tone and sentiment of agent responses.
 * Uses sentiment analysis to evaluate tone consistency.
 */
export const toneScorer = createToneScorer({
  // Optional: provide a reference tone to compare against
  // referenceTone: 'friendly and professional',
});

/**
 * Completeness Scorer
 *
 * Evaluates whether the agent's response covers all the key elements
 * from the user's input using NLP-based element extraction.
 */
export const completenessScorer = createCompletenessScorer();

// Export all scorers as a record for Mastra configuration
export const scorers = {
  relevancy: relevancyScorer,
  tone: toneScorer,
  completeness: completenessScorer,
};
