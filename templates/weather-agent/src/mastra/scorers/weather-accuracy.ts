import { createScorer } from '@mastra/core/scores';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Weather Accuracy Scorer
 *
 * This custom scorer evaluates the accuracy and completeness of weather responses.
 * It demonstrates a hybrid approach combining deterministic functions with LLM evaluation.
 *
 * Evaluation criteria:
 * - Location accuracy (25%): Is the weather data for the requested location?
 * - Data completeness (30%): Are all key weather metrics provided?
 * - Response coherence (25%): Do weather conditions match the data?
 * - Format quality (20%): Is the response well-structured and readable?
 */

export function createWeatherAccuracyScorer({ model = openai('gpt-4o-mini') } = {}) {
  return createScorer({
    name: 'Weather Accuracy',
    description: 'Evaluates accuracy and completeness of weather information',
    judge: {
      model,
      instructions: `You are a weather data quality expert evaluating weather responses for accuracy and completeness.
      Focus on:
      1. Location matching - does the response provide weather for the requested location?
      2. Data completeness - are key metrics (temperature, humidity, wind, conditions) present?
      3. Coherence - do the weather conditions align with the metrics?
      4. Format - is the information clearly presented?`,
    },
  })
    .preprocess(({ run }) => {
      // Extract weather data from the response using deterministic parsing
      const response = run.output?.text || '';
      const requestedLocation = run.input?.[0]?.content?.toString().toLowerCase() || '';

      // Parse weather metrics from response
      const hasTemperature = /temperature|°[CF]|\d+\s*degrees/i.test(response);
      const hasHumidity = /humidity:\s*\d+%?/i.test(response);
      const hasWind = /wind\s*(speed|gusts?):\s*\d+/i.test(response);
      const hasConditions = /conditions?:\s*\w+|clear|cloudy|rain|snow|fog/i.test(response);

      // Extract mentioned location from response
      const locationMatch = response.match(/weather\s+(?:for|in|at)\s+([^.,\n]+)/i);
      const responseLocation = locationMatch?.[1]?.toLowerCase() || '';

      return {
        requestedLocation,
        responseLocation,
        hasTemperature,
        hasHumidity,
        hasWind,
        hasConditions,
        response,
      };
    })
    .analyze({
      description: 'Analyze weather response quality',
      outputSchema: z.object({
        locationMatches: z.boolean(),
        coherenceScore: z.number().min(0).max(1),
        formatQuality: z.enum(['excellent', 'good', 'fair', 'poor']),
        missingElements: z.array(z.string()),
      }),
      createPrompt: ({ results }) => {
        const data = results.preprocessStepResult;
        return `
Analyze this weather response for quality:

Requested location: "${data.requestedLocation}"
Response mentions: "${data.responseLocation}"
Full response: "${data.response}"

Weather data present:
- Temperature: ${data.hasTemperature}
- Humidity: ${data.hasHumidity}
- Wind: ${data.hasWind}
- Conditions: ${data.hasConditions}

Evaluate:
1. Does the response location match the requested location?
2. How coherent are the weather conditions with the metrics? (0-1 score)
3. Rate the format quality (excellent/good/fair/poor)
4. List any missing critical weather elements

Return as JSON with locationMatches, coherenceScore, formatQuality, and missingElements.`;
      },
    })
    .generateScore(({ results }) => {
      const preprocessData = results.preprocessStepResult;
      const analysis = results.analyzeStepResult;

      // Calculate component scores
      const locationScore = analysis.locationMatches ? 1.0 : 0.0;

      // Data completeness (check presence of key metrics)
      const metricsPresent = [
        preprocessData.hasTemperature,
        preprocessData.hasHumidity,
        preprocessData.hasWind,
        preprocessData.hasConditions,
      ];
      const completenessScore = metricsPresent.filter(Boolean).length / metricsPresent.length;

      // Coherence score from LLM analysis
      const coherenceScore = analysis.coherenceScore;

      // Format quality mapping
      const formatScores = {
        excellent: 1.0,
        good: 0.75,
        fair: 0.5,
        poor: 0.25,
      };
      const formatScore = formatScores[analysis.formatQuality] || 0.5;

      // Weighted final score
      const finalScore =
        locationScore * 0.25 + // 25% for location accuracy
        completenessScore * 0.3 + // 30% for data completeness
        coherenceScore * 0.25 + // 25% for coherence
        formatScore * 0.2; // 20% for format quality

      return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
    })
    .generateReason(({ results, score }) => {
      const analysis = results.analyzeStepResult;
      const preprocessData = results.preprocessStepResult;

      const issues = [];
      if (!analysis.locationMatches) {
        issues.push('location mismatch');
      }
      if (analysis.missingElements.length > 0) {
        issues.push(`missing ${analysis.missingElements.join(', ')}`);
      }
      if (analysis.formatQuality === 'poor' || analysis.formatQuality === 'fair') {
        issues.push('format needs improvement');
      }

      const strengths = [];
      if (preprocessData.hasTemperature && preprocessData.hasConditions) {
        strengths.push('core weather data present');
      }
      if (analysis.coherenceScore > 0.8) {
        strengths.push('highly coherent');
      }
      if (analysis.formatQuality === 'excellent') {
        strengths.push('excellent formatting');
      }

      return `Weather Accuracy Score: ${score}. ${strengths.length > 0 ? `Strengths: ${strengths.join(', ')}. ` : ''}${
        issues.length > 0 ? `Areas for improvement: ${issues.join(', ')}.` : 'Response meets all quality criteria.'
      }`;
    });
}
