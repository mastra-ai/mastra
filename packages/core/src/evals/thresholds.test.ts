import { describe, expect, it } from 'vitest';
import { checkThresholdPassed, isScorerWithThreshold, validateThresholdConfig } from './thresholds';
import type { ScorerEntry } from './thresholds';

describe('thresholds', () => {
  describe('checkThresholdPassed', () => {
    it('treats a numeric threshold as an inclusive minimum', () => {
      expect(checkThresholdPassed(0.7, 0.7)).toBe(true);
      expect(checkThresholdPassed(0.69, 0.7)).toBe(false);
    });

    it('treats min and max bounds as inclusive', () => {
      const threshold = { min: 0.3, max: 0.7 };

      expect(checkThresholdPassed(0.3, threshold)).toBe(true);
      expect(checkThresholdPassed(0.7, threshold)).toBe(true);
      expect(checkThresholdPassed(0.29, threshold)).toBe(false);
      expect(checkThresholdPassed(0.71, threshold)).toBe(false);
    });
  });

  describe('validateThresholdConfig', () => {
    it('accepts valid numeric and range thresholds', () => {
      expect(() => validateThresholdConfig(0, 'quality')).not.toThrow();
      expect(() => validateThresholdConfig(1, 'quality')).not.toThrow();
      expect(() => validateThresholdConfig({ min: 0.2, max: 0.8 }, 'quality')).not.toThrow();
    });

    it.each([-0.1, 1.1, Number.POSITIVE_INFINITY, Number.NaN])(
      'rejects an invalid numeric threshold: %s',
      threshold => {
        expect(() => validateThresholdConfig(threshold, 'quality')).toThrow(/between 0 and 1/);
      },
    );

    it('rejects a minimum greater than the maximum', () => {
      expect(() => validateThresholdConfig({ min: 0.8, max: 0.2 }, 'quality')).toThrow(
        /min \(0.8\) greater than max \(0.2\)/,
      );
    });
  });

  it('detects threshold wrappers for generic scorer references', () => {
    const registeredScorer: ScorerEntry<string> = { scorer: 'quality', threshold: 0.7 };

    expect(isScorerWithThreshold(registeredScorer)).toBe(true);
    expect(isScorerWithThreshold<string>('quality')).toBe(false);
  });
});
