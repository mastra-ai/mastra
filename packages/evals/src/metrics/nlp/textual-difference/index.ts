import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import { calculateRatio, countChanges } from '../../../ratio';

interface TextualDifferenceResult extends MetricResult {
  info: {
    ratio: number;
    changes: number;
    lengthDiff: number;
    confidence: number;
  };
}

export class TextualDifferenceMetric extends Metric {
  async measure(input: string, output: string): Promise<TextualDifferenceResult> {
    // Calculate similarity ratio using LCS approach (similar to SequenceMatcher.ratio())
    const ratio = calculateRatio(input, output);

    // Count changes by comparing words
    const changes = countChanges(input, output);

    // Calculate confidence based on text length difference
    const maxLength = Math.max(input.length, output.length);
    const lengthDiff = maxLength > 0 ? Math.abs(input.length - output.length) / maxLength : 0;
    const confidence = 1 - lengthDiff;

    return {
      score: ratio,
      info: {
        confidence,
        ratio,
        changes,
        lengthDiff,
      },
    };
  }
}
