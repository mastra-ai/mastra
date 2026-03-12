import { z } from 'zod';
import { createScorer } from '@mastra/core/evals';
import { createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';
import { getAssistantMessageFromRunOutput } from '@mastra/evals/scorers/utils';

/**
 * Evaluates whether the agent's summary contains concrete, actionable recommendations
 * rather than vague observations. A good feedback summary should tell the team
 * exactly what to do, not just what customers said.
 */
export const actionabilityScorer = createScorer({
  id: 'actionability-scorer',
  name: 'Actionability',
  description:
    "Evaluates whether the agent's feedback summary contains concrete, actionable recommendations that a product team could act on immediately.",
  type: 'agent',
  judge: {
    model: 'openai/gpt-5.2',
    instructions:
      'You are an expert evaluator of product feedback summaries. Your job is to assess whether a summary contains specific, actionable recommendations. Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { assistantText };
  })
  .analyze({
    description: 'Determine if the summary contains specific, actionable recommendations',
    outputSchema: z.object({
      hasRecommendations: z.boolean().describe('Whether the response contains a recommendations section'),
      recommendationCount: z.number().describe('Number of distinct recommendations made'),
      areSpecific: z.boolean().describe('Whether recommendations are specific vs vague'),
      arePrioritized: z.boolean().describe('Whether recommendations are ordered by priority or impact'),
      tiedToFeedback: z.boolean().describe('Whether recommendations reference specific feedback or data points'),
      confidence: z.number().min(0).max(1).default(1).describe('Confidence in this analysis from 0 to 1'),
    }),
    createPrompt: ({ results }) => {
      const r = results as any;
      return `Analyze the following feedback summary for actionability. Does it contain specific, concrete recommendations that a product team could act on?

Summary to analyze:
${r.preprocessStepResult.assistantText}

Evaluate:
1. Does it have a clear recommendations section?
2. How many distinct recommendations are made?
3. Are they specific (e.g., "fix the checkout crash when applying discount codes") or vague (e.g., "improve the checkout experience")?
4. Are they prioritized by impact?
5. Do they reference specific feedback data?

Return JSON with fields:
{
  "hasRecommendations": boolean,
  "recommendationCount": number,
  "areSpecific": boolean,
  "arePrioritized": boolean,
  "tiedToFeedback": boolean,
  "confidence": number
}`;
    },
  })
  .generateScore(({ results }) => {
    const analysis = (results as any)?.analyzeStepResult;
    if (!analysis || !analysis.hasRecommendations) return 0;

    let score = 0;

    // Has recommendations at all (base)
    score += 0.2;

    // Multiple recommendations
    if (analysis.recommendationCount >= 3) score += 0.2;
    else if (analysis.recommendationCount >= 1) score += 0.1;

    // Specificity is the most important factor
    if (analysis.areSpecific) score += 0.3;

    // Prioritization
    if (analysis.arePrioritized) score += 0.15;

    // Tied to feedback data
    if (analysis.tiedToFeedback) score += 0.15;

    return Math.min(score * (analysis.confidence ?? 1), 1);
  })
  .generateReason(({ results, score }) => {
    const analysis = (results as any)?.analyzeStepResult;
    if (!analysis) return 'Could not analyze the response for actionability.';
    if (!analysis.hasRecommendations) return 'The response does not contain actionable recommendations.';

    const parts = [
      `Found ${analysis.recommendationCount} recommendation(s).`,
      analysis.areSpecific
        ? 'Recommendations are specific and actionable.'
        : 'Recommendations are too vague to act on.',
      analysis.arePrioritized ? 'Recommendations are prioritized.' : 'Recommendations lack prioritization.',
      analysis.tiedToFeedback
        ? 'Recommendations reference specific feedback data.'
        : 'Recommendations are not tied to specific feedback.',
      `Score: ${score}`,
    ];

    return parts.join(' ');
  });

/**
 * Evaluates whether the agent's summary covers all the input feedback items
 * without dropping any. Uses the built-in completeness scorer.
 */
export const completenessScorer = createCompletenessScorer();
