import { createScorer } from '@mastra/core/scores';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Activity Relevance Scorer
 *
 * This custom scorer evaluates whether suggested activities are appropriate
 * for the given weather conditions. It's designed specifically for the weather
 * workflow that suggests activities based on weather forecasts.
 *
 * Evaluation criteria:
 * - Weather appropriateness (40%): Are activities suitable for the conditions?
 * - Safety consideration (30%): Are safety warnings provided when needed?
 * - Variety (20%): Does it offer diverse activity options?
 * - Practicality (10%): Are suggestions realistic and actionable?
 */

export function createActivityRelevanceScorer({ model = openai('gpt-4o-mini') } = {}) {
  return createScorer({
    name: 'Activity Relevance',
    description: 'Evaluates if suggested activities match weather conditions appropriately',
    judge: {
      model,
      instructions: `You are an outdoor activity expert evaluating activity suggestions.
      Consider:
      1. Weather appropriateness - activities should match the conditions
      2. Safety - dangerous conditions should have appropriate warnings
      3. Variety - mix of indoor/outdoor options based on weather
      4. Practicality - suggestions should be realistic and actionable`,
    },
  })
    .preprocess(({ run }) => {
      // Extract weather conditions and activities from the workflow output
      const output = run.output?.text || '';
      const input = run.input?.[0]?.content?.toString() || '';

      // Parse weather conditions from the output
      const temperatureMatch = output.match(/(\d+)°[CF]/g);
      const temperatures = temperatureMatch?.map(t => parseInt(t)) || [];
      const avgTemp = temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : null;

      // Detect weather conditions
      const conditions = {
        rain: /rain|drizzle|precipitation|shower/i.test(output),
        snow: /snow|blizzard|sleet/i.test(output),
        clear: /clear|sunny|fair/i.test(output),
        cloudy: /cloud|overcast/i.test(output),
        extreme: /storm|thunder|hurricane|tornado|extreme/i.test(output),
        cold: avgTemp !== null && avgTemp < 50, // Fahrenheit
        hot: avgTemp !== null && avgTemp > 85, // Fahrenheit
      };

      // Extract activities mentioned
      const outdoorActivities = output.match(/outdoor:?\s*[\n•\-]?\s*([^•\n\-]+)/gi) || [];
      const indoorActivities = output.match(/indoor\s*(?:alternatives?)?:?\s*[\n•\-]?\s*([^•\n\-]+)/gi) || [];
      const hasWarnings = /warning|caution|careful|avoid|dangerous|safety/i.test(output);

      return {
        city: input,
        avgTemperature: avgTemp,
        conditions,
        outdoorActivities: outdoorActivities.map(a => a.trim()),
        indoorActivities: indoorActivities.map(a => a.trim()),
        hasWarnings,
        fullOutput: output,
      };
    })
    .analyze({
      description: 'Analyze activity-weather alignment',
      outputSchema: z.object({
        appropriatenessScore: z.number().min(0).max(1),
        safetyScore: z.number().min(0).max(1),
        varietyScore: z.number().min(0).max(1),
        practicalityScore: z.number().min(0).max(1),
        issues: z.array(z.string()),
        strengths: z.array(z.string()),
      }),
      createPrompt: ({ results }) => {
        const data = results.preprocessStepResult;
        return `
Analyze these activity suggestions for weather appropriateness:

Weather Conditions:
- Average Temperature: ${data.avgTemperature || 'Unknown'}°F
- Rain: ${data.conditions.rain}
- Snow: ${data.conditions.snow}
- Clear: ${data.conditions.clear}
- Extreme Weather: ${data.conditions.extreme}
- Cold (<50°F): ${data.conditions.cold}
- Hot (>85°F): ${data.conditions.hot}

Suggested Activities:
Outdoor (${data.outdoorActivities.length}): ${data.outdoorActivities.join(', ') || 'None'}
Indoor (${data.indoorActivities.length}): ${data.indoorActivities.join(', ') || 'None'}
Safety Warnings Present: ${data.hasWarnings}

Full Output:
"${data.fullOutput.substring(0, 500)}..."

Evaluate and score (0-1) for:
1. appropriatenessScore: How well do activities match the weather?
2. safetyScore: Are appropriate safety considerations included?
3. varietyScore: Is there good variety of options?
4. practicalityScore: Are suggestions realistic and actionable?

Also list any issues and strengths found.`;
      },
    })
    .generateScore(({ results }) => {
      const analysis = results.analyzeStepResult;
      const data = results.preprocessStepResult;

      // Additional deterministic checks
      let bonusPoints = 0;

      // Check for indoor alternatives when weather is bad
      if (
        (data.conditions.rain || data.conditions.snow || data.conditions.extreme) &&
        data.indoorActivities.length > 0
      ) {
        bonusPoints += 0.05;
      }

      // Check for warnings in extreme conditions
      if (data.conditions.extreme && data.hasWarnings) {
        bonusPoints += 0.05;
      }

      // Weighted final score
      const baseScore =
        analysis.appropriatenessScore * 0.4 + // 40% for weather appropriateness
        analysis.safetyScore * 0.3 + // 30% for safety
        analysis.varietyScore * 0.2 + // 20% for variety
        analysis.practicalityScore * 0.1; // 10% for practicality

      // Cap the final score at 1.0
      const finalScore = Math.min(1.0, baseScore + bonusPoints);

      return Math.round(finalScore * 100) / 100;
    })
    .generateReason(({ results, score }) => {
      const analysis = results.analyzeStepResult;
      const data = results.preprocessStepResult;

      // Build reason based on analysis
      let reason = `Activity Relevance Score: ${score}. `;

      if (analysis.strengths.length > 0) {
        reason += `Strengths: ${analysis.strengths.join(', ')}. `;
      }

      if (analysis.issues.length > 0) {
        reason += `Areas for improvement: ${analysis.issues.join(', ')}. `;
      }

      // Add specific observations
      if (data.conditions.extreme && !data.hasWarnings) {
        reason += 'Consider adding safety warnings for extreme weather. ';
      }

      if (data.outdoorActivities.length === 0 && data.conditions.clear) {
        reason += 'Good weather conditions could support more outdoor activities. ';
      }

      return reason.trim();
    });
}
