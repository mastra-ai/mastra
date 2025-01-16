import nlp from 'compromise';

import { ScoringResult } from '../types';

export class ReadabilityScorer {
  async score(response: string): Promise<ScoringResult> {
    const doc = nlp(response);

    // Get base metrics from compromise
    const sentences = doc.sentences().json() as Record<string, any>[];
    const words = doc.terms().json() as Record<string, any>[];

    // Calculate readability metrics
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllables = words.reduce((acc, word) => acc + this.countSyllables(word.text), 0) / words.length;

    // Flesch-Kincaid Grade Level
    const fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllables - 15.59;

    // Calculate percentage of complex words (3+ syllables)
    const complexWords = words.filter(w => this.countSyllables(w.text) >= 3).length;
    const complexWordPercent = complexWords / words.length;

    // Looking at sentence complexity
    const compoundSentences = sentences.filter(
      s => s.text.includes(' and ') || s.text.includes(' but ') || s.text.includes(' or '),
    ).length;
    const compoundPercent = compoundSentences / sentences.length;

    const score = this.normalizeScore(fleschKincaid);

    return {
      score,
      details: `Readability score: ${(score * 100).toFixed(1)}%`,
      confidence: 0.8,
      metrics: {
        gradeLevel: fleschKincaid,
        avgWordsPerSentence,
        avgSyllablesPerWord: avgSyllables,
        complexWordPercentage: complexWordPercent,
        compoundSentencePercentage: compoundPercent,
      },
    };
  }

  private countSyllables(word: string): number {
    // Basic syllable counting logic
    // Could be improved with a dictionary or ML approach
    return (
      word
        .toLowerCase()
        .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
        .match(/[aeiouy]{1,2}/g)?.length || 1
    );
  }

  private normalizeScore(gradeLevel: number): number {
    // Convert grade level to a 0-1 score
    // Assuming target grade level is 5 (elementary)
    // Score decreases as we deviate from target
    const target = 5;
    const deviation = Math.abs(gradeLevel - target);
    return Math.max(0, 1 - deviation / 10);
  }
}
