import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import stringSimilarity from 'string-similarity';

interface ContentSimilarityResult extends MetricResult {
  info: {
    similarity: number;
  };
}

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export class ContentSimilarityMetric extends Metric {
  private options: ContentSimilarityOptions;

  constructor(options: ContentSimilarityOptions = {}) {
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
