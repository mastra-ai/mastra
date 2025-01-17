import { Metric } from '@mastra/core';
import { SequenceMatcher } from 'difflib';

import { MetricScoringResult } from '../types';

export class DifferenceMetric extends Metric {
  async measure({ input, output }: { input: string; output: string }): Promise<MetricScoringResult> {
    const matcher = new SequenceMatcher(null, input, output);
    const ratio = matcher.ratio();

    // Get detailed operations
    const ops = matcher.getOpcodes();
    const changes = ops.filter(([op]) => op !== 'equal').length;

    // Calculate confidence based on text length difference
    const maxLength = Math.max(input.length, output.length);
    const lengthDiff = maxLength > 0 ? Math.abs(input.length - output.length) / maxLength : 0;
    const confidence = 1 - lengthDiff;

    return {
      score: ratio,
      details: `Difference score: ${(ratio * 100).toFixed(1)}% with ${changes} changes`,
      confidence,
      metrics: {
        ratio,
        changes,
        lengthDiff,
      },
    };
  }
}
