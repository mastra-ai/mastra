import nlp from 'compromise';

import { ScoringResult } from '../types';

export class StructuralScorer {
  async score(text: string): Promise<ScoringResult> {
    const doc = nlp(text);

    // Analyze sentence structure
    const sentences = doc.sentences().length;
    const avgWordsPerSentence = doc.terms().length / sentences;

    // Analyze parts of speech distribution
    const nouns = doc.nouns().length;
    const verbs = doc.verbs().length;
    const adjectives = doc.adjectives().length;

    // Calculate structural completeness score
    const posBalance = Math.min(1, ((nouns + verbs + adjectives) / doc.terms().length) * 1.5);

    // Sentence length score (optimal range: 10-25 words)
    const sentenceLengthScore = Math.max(0, 1 - Math.abs(avgWordsPerSentence - 17.5) / 17.5);

    const score = (posBalance + sentenceLengthScore) / 2;

    return {
      score,
      details: `Structural score: ${(score * 100).toFixed(1)}%`,
      confidence: 0.8,
      metrics: {
        sentences,
        avgWordsPerSentence,
        nouns,
        verbs,
        adjectives,
        posBalance,
        sentenceLengthScore,
      },
    };
  }
}
