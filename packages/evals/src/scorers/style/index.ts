import nlp from 'compromise';

import { ScoringResult } from '../types';

export class StyleConsistencyScorer {
  async score(response: string): Promise<ScoringResult> {
    const doc = nlp(response);

    // Add debugging logs
    console.log('Analyzing text:', response);

    const sentences = doc.sentences().json() as Record<string, any>[];
    console.log('Sentences:', sentences.length);

    // Simpler scoring approach
    const patterns = sentences.map(s => ({
      length: s.terms?.length || 0,
    }));

    console.log(
      'Sentence lengths:',
      patterns.map(p => p.length),
    );

    // Normalize the score between 0 and 1
    const avgLength = patterns.reduce((sum, p) => sum + p.length, 0) / patterns.length;
    const variance =
      patterns.map(p => Math.pow(p.length - avgLength, 2)).reduce((sum, v) => sum + v, 0) / patterns.length;

    // Cap the variance impact
    const normalizedScore = Math.min(Math.max(1 - variance / 100, 0), 1);

    return {
      score: normalizedScore,
      details: `Style consistency: ${(normalizedScore * 100).toFixed(1)}%`,
      confidence: 0.8,
      metrics: {
        averageSentenceLength: avgLength,
        variance,
        sentenceLengths: patterns.map(p => p.length),
      },
    };
  }

  // private calculateVariance(numbers: number[]): number {
  //     const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  //     return numbers.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / numbers.length;
  // }

  // private calculateConsistency(items: string[]): number {
  //     const counts = items.reduce((acc, item) => {
  //         acc[item] = (acc[item] || 0) + 1;
  //         return acc;
  //     }, {} as Record<string, number>);

  //     const mostCommon = Math.max(...Object.values(counts));
  //     return mostCommon / items.length;
  // }
}
