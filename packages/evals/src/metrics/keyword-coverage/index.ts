import { Metric } from '@mastra/core';
import keyword_extractor from 'keyword-extractor';

import { ScoringResult } from '../types';

export class KeywordCoverageScorer extends Metric {
  async measure({ input, output }: { input: string; output: string }): Promise<ScoringResult> {
    const extractKeywords = (text: string) => {
      return keyword_extractor.extract(text, {
        language: 'english',
        remove_digits: true,
        return_changed_case: true,
        remove_duplicates: true,
      });
    };

    const referenceKeywords = new Set(extractKeywords(input));
    const responseKeywords = new Set(extractKeywords(output));

    const matchedKeywords = [...referenceKeywords].filter(k => responseKeywords.has(k));
    const coverage = matchedKeywords.length / referenceKeywords.size;

    return {
      score: coverage,
      details: `Keyword coverage: ${(coverage * 100).toFixed(1)}% (${matchedKeywords.length}/${referenceKeywords.size} keywords)`,
      confidence: 0.85,
      metrics: {
        totalKeywords: referenceKeywords.size,
        matchedKeywords: matchedKeywords.length,
      },
    };
  }
}
