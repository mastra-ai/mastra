import { Metric, type MetricResult } from '@mastra/core/eval';

interface KeywordCoverageResult extends MetricResult {
  info: {
    totalKeywords: number;
    matchedKeywords: number;
  };
}

export class KeywordCoverageMetric extends Metric {
  private referenceKeywords: Set<string>;

  constructor(keywords: string[]) {
    super();
    this.referenceKeywords = new Set(keywords);
  }

  async measure(input: string, output: string): Promise<KeywordCoverageResult> {
    // Handle empty strings case
    if (!input && !output) {
      return {
        score: 1,
        info: {
          totalKeywords: 0,
          matchedKeywords: 0,
        },
      };
    }

    const matchedKeywords = [...this.referenceKeywords].filter(k => output.includes(k));
    const totalKeywords = this.referenceKeywords.size;
    const coverage = totalKeywords > 0 ? matchedKeywords.length / totalKeywords : 0;

    return {
      score: coverage,
      info: {
        totalKeywords: this.referenceKeywords.size,
        matchedKeywords: matchedKeywords.length,
      },
    };
  }
}
