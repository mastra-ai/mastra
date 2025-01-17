import { Metric } from '@mastra/core';
import keyword_extractor from 'keyword-extractor';

import { MetricScoringResult } from '../types';

export class KeywordCoverageMetric extends Metric {
  async measure({ input, output }: { input: string; output: string }): Promise<MetricScoringResult> {
    // Handle empty strings case
    if (!input && !output) {
      return {
        score: 1,
        details: 'Keyword coverage: 100.0% (0/0 keywords)',
        confidence: 0.85,
        metrics: {
          totalKeywords: 0,
          matchedKeywords: 0,
        },
      };
    }

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
    const totalKeywords = referenceKeywords.size;
    const coverage = totalKeywords > 0 ? matchedKeywords.length / totalKeywords : 0;

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
