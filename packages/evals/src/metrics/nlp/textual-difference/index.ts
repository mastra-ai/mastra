import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import { SequenceMatcher } from 'difflib';

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
      info: {
        confidence,
        ratio,
        changes,
        lengthDiff,
      },
    };
  }
}
