import { createScorer } from '@mastra/core/scores';
import Sentiment from 'sentiment';

export function createToneScorer() {
  return createScorer({
    name: 'Completeness',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
    analyze: async run => {
      const sentiment = new Sentiment();
      const input = run.input?.map(i => i.content).join(', ') || '';
      const output = run.output.text;
      const responseSentiment = sentiment.analyze(input);

      if (output) {
        // Compare sentiment with reference
        const referenceSentiment = sentiment.analyze(output);
        const sentimentDiff = Math.abs(responseSentiment.comparative - referenceSentiment.comparative);
        const normalizedScore = Math.max(0, 1 - sentimentDiff);

        return {
          score: normalizedScore,
          result: {
            responseSentiment: responseSentiment.comparative,
            referenceSentiment: referenceSentiment.comparative,
            difference: sentimentDiff,
          },
        };
      }

      // Evaluate sentiment stability across response
      const sentences = input.match(/[^.!?]+[.!?]+/g) || [input];
      const sentiments = sentences.map(s => sentiment.analyze(s).comparative);
      const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
      const stability = Math.max(0, 1 - variance);

      return {
        score: stability,
        result: {
          avgSentiment,
          sentimentVariance: variance,
        },
      };
    },
  });
}
