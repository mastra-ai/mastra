import type { RunEvalsResult } from '@mastra/core/evals';
import { describe, expect, it } from 'vitest';

import { registerEvalMatchers } from './matchers';

registerEvalMatchers();

function makeResult(overrides: Partial<RunEvalsResult> = {}): RunEvalsResult {
  return {
    scores: { relevance: 0.8, toxicity: 0.1 },
    summary: { totalItems: 2 },
    results: [],
    ...overrides,
  } as unknown as RunEvalsResult;
}

describe('eval matchers', () => {
  describe('toHaveVerdict', () => {
    it('passes when the verdict matches', () => {
      expect(makeResult({ verdict: 'passed' })).toHaveVerdict('passed');
    });

    it('fails when the verdict differs', () => {
      expect(() => expect(makeResult({ verdict: 'failed' })).toHaveVerdict('passed')).toThrowError(
        /expected verdict "passed", got "failed"/,
      );
    });

    it('mentions missing verdict when no gates/thresholds were configured', () => {
      expect(() => expect(makeResult()).toHaveVerdict('passed')).toThrowError(/no verdict/);
    });

    it('rejects non-RunEvalsResult values', () => {
      expect(() => expect({ nope: true }).toHaveVerdict('passed')).toThrowError(/expected a RunEvalsResult/);
    });

    it('rejects results with a null score map', () => {
      expect(() => expect({ scores: null, summary: {} }).toHaveVerdict('passed')).toThrowError(
        /expected a RunEvalsResult/,
      );
      expect(() => expect({ scores: null, summary: {} }).toHaveScoreAbove('relevance', 0.5)).toThrowError(
        /expected a RunEvalsResult/,
      );
    });
  });

  describe('toHaveScoreAbove / toHaveScoreBelow', () => {
    it('passes when the score is above the minimum', () => {
      expect(makeResult()).toHaveScoreAbove('relevance', 0.5);
    });

    it('fails when the score is not above the minimum', () => {
      expect(() => expect(makeResult()).toHaveScoreAbove('relevance', 0.9)).toThrowError(
        /expected score of "relevance" \(0.8\) to be above 0.9/,
      );
    });

    it('passes when the score is below the maximum', () => {
      expect(makeResult()).toHaveScoreBelow('toxicity', 0.5);
    });

    it('lists available scorers when the scorer is unknown', () => {
      expect(() => expect(makeResult()).toHaveScoreAbove('unknown', 0.5)).toThrowError(
        /Available scorers: relevance, toxicity/,
      );
    });

    it('supports dot-paths for categorized scores', () => {
      const result = makeResult({ scores: { agent: { quality: 0.9 } } as any });
      expect(result).toHaveScoreAbove('agent.quality', 0.5);
    });

    it('supports negated matchers', () => {
      expect(makeResult()).not.toHaveScoreAbove('relevance', 0.9);
    });
  });

  describe('toPassGates', () => {
    it('passes when all gates passed', () => {
      expect(makeResult({ verdict: 'passed', gateResults: [{ id: 'safety', passed: true, score: 1 }] })).toPassGates();
    });

    it('fails and lists failed gates', () => {
      expect(() =>
        expect(
          makeResult({ verdict: 'failed', gateResults: [{ id: 'safety', passed: false, score: 0 }] }),
        ).toPassGates(),
      ).toThrowError(/✗ safety \(score: 0\)/);
    });

    it('fails when no gates were configured', () => {
      expect(() => expect(makeResult()).toPassGates()).toThrowError(/no gates were configured/);
    });
  });

  describe('toPassThresholds', () => {
    it('passes when all thresholds passed', () => {
      expect(
        makeResult({
          verdict: 'passed',
          thresholdResults: [{ id: 'relevance', passed: true, averageScore: 0.8, threshold: 0.5 }],
        }),
      ).toPassThresholds();
    });

    it('fails and lists failed thresholds', () => {
      expect(() =>
        expect(
          makeResult({
            verdict: 'failed',
            thresholdResults: [{ id: 'relevance', passed: false, averageScore: 0.3, threshold: 0.5 }],
          }),
        ).toPassThresholds(),
      ).toThrowError(/✗ relevance \(average score: 0.3, threshold: 0.5\)/);
    });

    it('fails when no thresholds were configured', () => {
      expect(() => expect(makeResult()).toPassThresholds()).toThrowError(/no scorer thresholds were configured/);
    });
  });
});
