import stringSimilarity from 'string-similarity';

import { ScorerOptions, ScoringResult } from '../types';

export class ContentSimilarityScorer {
  private options: ScorerOptions;

  constructor(options: ScorerOptions = {}) {
    this.options = {
      ignoreCase: true,
      ignoreWhitespace: true,
      ...options,
    };
  }

  async score(text1: string, text2: string): Promise<ScoringResult> {
    let processedText1 = text1;
    let processedText2 = text2;

    if (this.options.ignoreCase) {
      processedText1 = processedText1.toLowerCase();
      processedText2 = processedText2.toLowerCase();
    }

    if (this.options.ignoreWhitespace) {
      processedText1 = processedText1.replace(/\s+/g, ' ').trim();
      processedText2 = processedText2.replace(/\s+/g, ' ').trim();
    }

    const similarity = stringSimilarity.compareTwoStrings(processedText1, processedText2);

    return {
      score: similarity,
      details: `Content similarity: ${(similarity * 100).toFixed(1)}%`,
      confidence: 0.9,
      metrics: { similarity },
    };
  }
}
