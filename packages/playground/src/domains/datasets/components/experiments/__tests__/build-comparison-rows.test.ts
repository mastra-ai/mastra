import { describe, expect, it } from 'vitest';

import { buildComparisonRows } from '../build-comparison-rows';
import {
  BASELINE_ID,
  CONTENDER_ID,
  baselineResults,
  baselineScores,
  comparisonResponse,
  contenderResults,
  contenderScores,
} from './fixtures/comparison';

const rows = () =>
  buildComparisonRows({
    comparison: comparisonResponse,
    baselineId: BASELINE_ID,
    contenderId: CONTENDER_ID,
    baselineResults,
    contenderResults,
    baselineScores,
    contenderScores,
  });

describe('buildComparisonRows', () => {
  describe('when both experiments ran the item', () => {
    it('joins the experiment result details onto each side', () => {
      const row = rows()[0];

      expect(row.itemId).toBe('item-a');
      expect(row.baseline.present).toBe(true);
      expect(row.baseline.output).toEqual({ answer: 'Paris' });
      expect(row.baseline.metadata).toEqual({ model: 'model-a', temperature: 0 });
      expect(row.baseline.comment).toBe('Baseline answer is too terse');
      expect(row.contender.present).toBe(true);
      expect(row.contender.output).toEqual({ answer: 'Paris, France' });
    });

    it('exposes scores with their scorer reason', () => {
      const row = rows()[0];

      expect(row.baseline.scores).toEqual([
        { scorerId: 'accuracy', value: 0.5, reason: 'Missing the country' },
        { scorerId: 'relevancy', value: 0.9, reason: null },
      ]);
      expect(row.contender.scores[0]).toEqual({ scorerId: 'accuracy', value: 0.9, reason: 'Complete answer' });
    });

    it('computes the baseline to contender delta per scorer', () => {
      const row = rows()[0];

      expect(row.deltas.accuracy).toBeCloseTo(0.4);
      expect(row.deltas.relevancy).toBe(0);
    });
  });

  describe('when a side has no score for a scorer', () => {
    it('leaves the delta null', () => {
      const row = rows()[1];

      expect(row.deltas.accuracy).toBeNull();
    });
  });

  describe('when the contender errored', () => {
    it('surfaces the error on that side only', () => {
      const row = rows()[1];

      expect(row.contender.present).toBe(true);
      expect(row.contender.error).toEqual({
        message: 'Agent run failed: rate limited',
        stack: 'Error: rate limited\n    at run()',
      });
      expect(row.baseline.error).toBeNull();
    });
  });

  describe('when the item is missing from the contender experiment', () => {
    it('marks the contender side as absent while keeping the baseline', () => {
      const row = rows()[2];

      expect(row.itemId).toBe('item-c');
      expect(row.baseline.present).toBe(true);
      expect(row.contender.present).toBe(false);
      expect(row.contender.scores).toEqual([]);
    });
  });

  describe('when the experiment results have not loaded yet', () => {
    it('still returns rows built from the comparison payload alone', () => {
      const built = buildComparisonRows({
        comparison: comparisonResponse,
        baselineId: BASELINE_ID,
        contenderId: CONTENDER_ID,
        baselineResults: undefined,
        contenderResults: undefined,
      });

      expect(built).toHaveLength(3);
      expect(built[0].baseline.output).toEqual({ answer: 'Paris' });
      expect(built[0].baseline.scores).toEqual([
        { scorerId: 'accuracy', value: 0.5, reason: null },
        { scorerId: 'relevancy', value: 0.9, reason: null },
      ]);
      expect(built[0].baseline.metadata).toBeNull();
    });
  });

  describe('when there is no comparison payload', () => {
    it('returns an empty list', () => {
      expect(
        buildComparisonRows({
          comparison: undefined,
          baselineId: BASELINE_ID,
          contenderId: CONTENDER_ID,
        }),
      ).toEqual([]);
    });
  });
});
