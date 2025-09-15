import { openai } from '@ai-sdk/openai';
import { createAnswerRelevancyScorer, createPromptAlignmentScorerLLM } from '@mastra/evals/scorers/llm';
import { createCompletenessScorer, createToneScorer } from '@mastra/evals/scorers/code';
import { createWeatherAccuracyScorer } from './weather-accuracy';
import { createActivityRelevanceScorer } from './activity-relevance';

/**
 * Scorer Configuration for Weather Agent Template
 *
 * This file demonstrates how to configure both custom and off-the-shelf scorers
 * for a production-ready agent system. The scorers are configured with appropriate
 * models and sampling rates based on their importance and cost considerations.
 */

// Use a smaller model for high-frequency evaluations to optimize costs
const evalModel = openai('gpt-4o-mini');

// Off-the-shelf scorers for the weather agent
export const answerRelevancyScorer = createAnswerRelevancyScorer({
  model: evalModel,
  options: {
    uncertaintyWeight: 0.3, // Partial credit for uncertain relevance
    scale: 1, // Score range 0-1
  },
});

export const promptAlignmentScorer = createPromptAlignmentScorerLLM({
  model: evalModel,
  options: {
    scale: 1,
    evaluationMode: 'both', // Evaluate both user intent and system compliance
  },
});

export const completenessScorer = createCompletenessScorer();

export const toneConsistencyScorer = createToneScorer();

// Custom scorers specific to weather domain
export const weatherAccuracyScorer = createWeatherAccuracyScorer({
  model: evalModel,
});

export const activityRelevanceScorer = createActivityRelevanceScorer({
  model: evalModel,
});

/**
 * Scorer configurations with sampling rates
 *
 * Sampling rates are set based on:
 * - 1.0 (100%): Critical scorers that should evaluate every response
 * - 0.5 (50%): Important scorers with moderate cost
 * - 0.2 (20%): Nice-to-have scorers for periodic quality checks
 */
export const weatherAgentScorers = {
  // Critical: Ensure responses are relevant to weather queries
  answerRelevancy: {
    scorer: answerRelevancyScorer,
    sampling: { type: 'ratio' as const, rate: 1.0 },
  },
  // Important: Check instruction following
  promptAlignment: {
    scorer: promptAlignmentScorer,
    sampling: { type: 'ratio' as const, rate: 0.5 },
  },
  // Important: Verify all weather data is included
  completeness: {
    scorer: completenessScorer,
    sampling: { type: 'ratio' as const, rate: 0.5 },
  },
  // Critical for weather domain: Validate weather data accuracy
  weatherAccuracy: {
    scorer: weatherAccuracyScorer,
    sampling: { type: 'ratio' as const, rate: 1.0 },
  },
};

export const weatherWorkflowScorers = {
  // Important: Ensure consistent tone in activity suggestions
  toneConsistency: {
    scorer: toneConsistencyScorer,
    sampling: { type: 'ratio' as const, rate: 0.5 },
  },
  // Critical: Validate activity-weather alignment
  activityRelevance: {
    scorer: activityRelevanceScorer,
    sampling: { type: 'ratio' as const, rate: 1.0 },
  },
};

// Export all scorers for potential direct use
export { createWeatherAccuracyScorer, createActivityRelevanceScorer };
