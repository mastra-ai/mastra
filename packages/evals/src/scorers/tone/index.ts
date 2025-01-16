import Sentiment from 'sentiment';

import { ScoringResult } from '../types';

export class ToneConsistencyScorer {
  private sentiment = new Sentiment();

  async score(response: string, reference?: string): Promise<ScoringResult> {
    const responseSentiment = this.sentiment.analyze(response);

    if (reference) {
      // Compare sentiment with reference
      const referenceSentiment = this.sentiment.analyze(reference);
      const sentimentDiff = Math.abs(responseSentiment.comparative - referenceSentiment.comparative);
      const normalizedScore = Math.max(0, 1 - sentimentDiff);

      return {
        score: normalizedScore,
        details: `Tone consistency: ${(normalizedScore * 100).toFixed(1)}%`,
        confidence: 0.75,
        metrics: {
          responseSentiment: responseSentiment.comparative,
          referenceSentiment: referenceSentiment.comparative,
          difference: sentimentDiff,
        },
      };
    }

    // Evaluate sentiment stability across response
    const sentences = response.match(/[^.!?]+[.!?]+/g) || [response];
    const sentiments = sentences.map(s => this.sentiment.analyze(s).comparative);
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
    const stability = Math.max(0, 1 - variance);

    return {
      score: stability,
      details: `Tone stability: ${(stability * 100).toFixed(1)}%`,
      confidence: 0.7,
      metrics: {
        avgSentiment,
        sentimentVariance: variance,
      },
    };
  }
}
