import { SequenceMatcher } from 'difflib';

import { ScoringResult } from '../types';

export class DifferenceScorer {
  async score(text1: string, text2: string): Promise<ScoringResult> {
    const matcher = new SequenceMatcher(null, text1, text2);
    const ratio = matcher.ratio();

    // Get detailed operations
    const ops = matcher.getOpcodes();
    const changes = ops.filter(([op]) => op !== 'equal').length;

    // Calculate confidence based on text length difference
    const lengthDiff = Math.abs(text1.length - text2.length) / Math.max(text1.length, text2.length);
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
