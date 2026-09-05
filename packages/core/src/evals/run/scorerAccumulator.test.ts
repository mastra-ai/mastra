import { describe, it, expect } from 'vitest';
import { ScoreAccumulator } from './scorerAccumulator';

describe('ScoreAccumulator', () => {
  it('averages numeric scores only and skips not-scorable results', () => {
    const accumulator = new ScoreAccumulator();

    accumulator.addScores({
      relevancy: { score: 1 },
      completeness: { score: 0.5 },
    });
    accumulator.addScores({
      relevancy: { notScorable: { reason: 'tool never called' } },
      completeness: { score: 1 },
      refund: { notScorable: {} },
    });

    expect(accumulator.getAverageScores()).toEqual({ relevancy: 1, completeness: 0.75 });
  });
});
