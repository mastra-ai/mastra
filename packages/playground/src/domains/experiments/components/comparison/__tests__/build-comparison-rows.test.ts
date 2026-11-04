import { describe, expect, it } from 'vitest';

import { buildComparisonRows } from '../build-comparison-rows';
import {
  BASELINE_ID,
  CHALLENGER_ID,
  CONTENDER_ID,
  baselineResults,
  baselineScores,
  baselineUsage,
  challengerResults,
  challengerScores,
  comparisonResponse,
  contenderResults,
  contenderScores,
  contenderUsage,
  threeWayComparisonResponse,
} from './fixtures/comparison';

const rows = () =>
  buildComparisonRows({
    comparison: comparisonResponse,
    experimentIds: [BASELINE_ID, CONTENDER_ID],
    resultsById: { [BASELINE_ID]: baselineResults, [CONTENDER_ID]: contenderResults },
    scoresById: { [BASELINE_ID]: baselineScores, [CONTENDER_ID]: contenderScores },
  });

const threeWayRows = () =>
  buildComparisonRows({
    comparison: threeWayComparisonResponse,
    experimentIds: [BASELINE_ID, CONTENDER_ID, CHALLENGER_ID],
    resultsById: {
      [BASELINE_ID]: baselineResults,
      [CONTENDER_ID]: contenderResults,
      [CHALLENGER_ID]: challengerResults,
    },
    scoresById: {
      [BASELINE_ID]: baselineScores,
      [CONTENDER_ID]: contenderScores,
      [CHALLENGER_ID]: challengerScores,
    },
  });

describe('buildComparisonRows', () => {
  describe('when both experiments ran the item', () => {
    it('joins the experiment result details onto each side', () => {
      const [baseline, contender] = rows()[0].sides;

      expect(rows()[0].itemId).toBe('item-a');
      expect(baseline.present).toBe(true);
      expect(baseline.output).toEqual({ answer: 'Paris' });
      expect(baseline.metadata).toEqual({ model: 'model-a', temperature: 0 });
      expect(baseline.comment).toBe('Baseline answer is too terse');
      expect(contender.present).toBe(true);
      expect(contender.output).toEqual({ answer: 'Paris, France' });
    });

    it('exposes scores with their scorer reason', () => {
      const [baseline, contender] = rows()[0].sides;

      expect(baseline.scores).toEqual([
        { scorerId: 'accuracy', value: 0.5, reason: 'Missing the country' },
        { scorerId: 'relevancy', value: 0.9, reason: null },
      ]);
      expect(contender.scores[0]).toEqual({ scorerId: 'accuracy', value: 0.9, reason: 'Complete answer' });
    });

    it('computes the baseline to contender delta per scorer on the contender side', () => {
      const [baseline, contender] = rows()[0].sides;

      expect(baseline.deltas).toBeNull();
      expect(contender.deltas?.accuracy).toBeCloseTo(0.4);
      expect(contender.deltas?.relevancy).toBe(0);
    });

    it('computes the run duration delta on the contender side', () => {
      const [baseline, contender] = rows()[0].sides;

      expect(baseline.durationDeltaMs).toBeNull();
      // Both fixtures ran for 5s.
      expect(contender.durationDeltaMs).toBe(0);
    });

    it('computes the average score delta on the contender side', () => {
      const [baseline, contender] = rows()[0].sides;

      expect(baseline.averageScoreDelta).toBeUndefined();
      // Baseline averages (0.5 + 0.9) / 2, the contender (0.9 + 0.9) / 2.
      expect(contender.averageScoreDelta).toBeCloseTo(0.2);
    });
  });

  describe('when comparing a baseline and two contenders', () => {
    it('returns one side per experiment, baseline first', () => {
      const { sides } = threeWayRows()[0];

      expect(sides.map(side => [side.experimentId, side.role])).toEqual([
        [BASELINE_ID, 'baseline'],
        [CONTENDER_ID, 'contender'],
        [CHALLENGER_ID, 'contender'],
      ]);
    });

    it('measures each contender against the baseline', () => {
      const [, contender, challenger] = threeWayRows()[0].sides;

      expect(contender.deltas?.accuracy).toBeCloseTo(0.4);
      expect(challenger.deltas?.accuracy).toBeCloseTo(0.1);
      expect(challenger.deltas?.relevancy).toBeCloseTo(-0.1);
    });

    it('joins each contender with its own result details and scorer reasons', () => {
      const [, , challenger] = threeWayRows()[0].sides;

      expect(challenger.comment).toBe('Challenger matches the baseline');
      expect(challenger.scores[0]).toEqual({ scorerId: 'accuracy', value: 0.6, reason: 'Close enough' });
    });
  });

  describe('when a side has no score for a scorer', () => {
    it('leaves the delta null', () => {
      const [, contender] = rows()[1].sides;

      expect(contender.deltas?.accuracy).toBeNull();
    });

    it('leaves the average score delta undefined when that side has no score left', () => {
      const [, contender] = rows()[1].sides;

      expect(contender.averageScoreDelta).toBeUndefined();
    });
  });

  describe('when the contender errored', () => {
    it('surfaces the error on that side only', () => {
      const [baseline, contender] = rows()[1].sides;

      expect(contender.present).toBe(true);
      expect(contender.error).toEqual({
        message: 'Agent run failed: rate limited',
        stack: 'Error: rate limited\n    at run()',
      });
      expect(baseline.error).toBeNull();
    });
  });

  describe('when a contender did not run the item', () => {
    it('marks that side as absent with no deltas while keeping the baseline', () => {
      const row = threeWayRows()[2];
      const [baseline, contender, challenger] = row.sides;

      expect(row.itemId).toBe('item-c');
      expect(baseline.present).toBe(true);
      expect(contender.present).toBe(false);
      expect(contender.scores).toEqual([]);
      expect(contender.deltas).toEqual({ accuracy: null });
      expect(challenger.present).toBe(false);
    });
  });

  describe('when the experiment results have not loaded yet', () => {
    it('still returns rows built from the comparison payload alone', () => {
      const built = buildComparisonRows({
        comparison: comparisonResponse,
        experimentIds: [BASELINE_ID, CONTENDER_ID],
      });
      const [baseline] = built[0].sides;

      expect(built).toHaveLength(3);
      expect(baseline.output).toEqual({ answer: 'Paris' });
      expect(baseline.scores).toEqual([
        { scorerId: 'accuracy', value: 0.5, reason: null },
        { scorerId: 'relevancy', value: 0.9, reason: null },
      ]);
      expect(baseline.metadata).toBeNull();
    });
  });

  describe('when per-item usage has loaded', () => {
    const usageRows = () =>
      buildComparisonRows({
        comparison: comparisonResponse,
        experimentIds: [BASELINE_ID, CONTENDER_ID],
        resultsById: { [BASELINE_ID]: baselineResults, [CONTENDER_ID]: contenderResults },
        usageById: { [BASELINE_ID]: baselineUsage, [CONTENDER_ID]: contenderUsage },
      });

    it("attaches the usage of each side's own trace", () => {
      const [baseline, contender] = usageRows()[0].sides;

      expect(baseline.usage).toEqual({ inputTokens: 120, outputTokens: 30, estimatedCost: 0.0015, costUnit: 'usd' });
      expect(contender.usage).toEqual({ inputTokens: 200, outputTokens: 60, estimatedCost: 0.004, costUnit: 'usd' });
    });

    it('computes the cost delta against the baseline on the contender side', () => {
      const [baseline, contender] = usageRows()[0].sides;

      expect(baseline.costDelta).toBeUndefined();
      expect(contender.costDelta).toBeCloseTo(0.0025);
    });

    it('computes the token delta against the baseline on the contender side', () => {
      const [baseline, contender] = usageRows()[0].sides;

      expect(baseline.tokenDelta).toBeUndefined();
      expect(contender.tokenDelta).toBe(260 - 150);
    });
  });

  describe("when a side's trace is missing from the usage", () => {
    const missingUsageContender = () =>
      buildComparisonRows({
        comparison: comparisonResponse,
        experimentIds: [BASELINE_ID, CONTENDER_ID],
        resultsById: { [BASELINE_ID]: baselineResults, [CONTENDER_ID]: contenderResults },
        usageById: { [BASELINE_ID]: baselineUsage, [CONTENDER_ID]: contenderUsage },
      })[1].sides[1];

    it('leaves that side without usage', () => {
      expect(missingUsageContender().usage).toBeUndefined();
    });

    it('leaves the cost delta undefined', () => {
      expect(missingUsageContender().costDelta).toBeUndefined();
    });

    it('leaves the token delta undefined', () => {
      expect(missingUsageContender().tokenDelta).toBeUndefined();
    });
  });

  describe('when the two sides are priced in different units', () => {
    it('leaves the cost delta undefined', () => {
      const [, contender] = buildComparisonRows({
        comparison: comparisonResponse,
        experimentIds: [BASELINE_ID, CONTENDER_ID],
        resultsById: { [BASELINE_ID]: baselineResults, [CONTENDER_ID]: contenderResults },
        usageById: {
          [BASELINE_ID]: baselineUsage,
          [CONTENDER_ID]: {
            ...contenderUsage,
            traces: {
              'trace-res-contender-a': { inputTokens: 200, outputTokens: 60, estimatedCost: 0.004, costUnit: 'eur' },
            },
          },
        },
      })[0].sides;

      expect(contender.costDelta).toBeUndefined();
    });
  });

  describe('when there is no comparison payload', () => {
    it('returns an empty list', () => {
      expect(
        buildComparisonRows({
          comparison: undefined,
          experimentIds: [BASELINE_ID, CONTENDER_ID],
        }),
      ).toEqual([]);
    });
  });
});
