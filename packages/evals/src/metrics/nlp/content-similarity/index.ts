import { Metric, MetricResult } from '@mastra/core';
import stringSimilarity from 'string-similarity';

import { MetricOptions } from '../types';

interface ContentSimilarityResult extends MetricResult {
  info: {
    similarity: number;
  };
}

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

  async measure(input: string, output: string): Promise<ContentSimilarityResult> {
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
      info: { similarity },
    };
  }
}
