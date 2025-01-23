import { Metric } from '@mastra/core';
import stringSimilarity from 'string-similarity';

import { MetricOptions, MetricScoringResult } from '../types';

export class ContentSimilarityMetric extends Metric {
  private options: MetricOptions;

  constructor(options: MetricOptions = {}) {
    super();
    this.options = {
      ignoreCase: true,
      ignoreWhitespace: true,
      ...options,
    };
  }

  async measure({ input, output }: { input: string; output: string }): Promise<MetricScoringResult> {
    let processedInput = input;
    let processedOutput = output;

    if (this.options.ignoreCase) {
      processedInput = processedInput.toLowerCase();
      processedOutput = processedOutput.toLowerCase();
    }

    if (this.options.ignoreWhitespace) {
      processedInput = processedInput.replace(/\s+/g, ' ').trim();
      processedOutput = processedOutput.replace(/\s+/g, ' ').trim();
    }

    const similarity = stringSimilarity.compareTwoStrings(processedInput, processedOutput);

    return {
      score: similarity,
      details: `Content similarity: ${(similarity * 100).toFixed(1)}%`,
      confidence: 0.9,
      metrics: { similarity },
    };
  }
}
