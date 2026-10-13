import { describe, expect, it } from 'vitest';
import { costDeltaFormatter, formatCostValue, formatTokenCount, totalTokens } from '../comparison-metric-format';

describe('formatCostValue', () => {
  describe('when the cost is a fraction of a cent', () => {
    it('keeps three significant digits so small costs stay distinguishable', () => {
      expect(formatCostValue(0.0015, 'usd')).toBe('$0.0015');
    });
  });

  describe('when the cost is a dollar or more', () => {
    it('rounds to cents', () => {
      expect(formatCostValue(1.234, 'usd')).toBe('$1.23');
    });
  });

  describe('when the cost is exactly zero', () => {
    it('shows zero cents', () => {
      expect(formatCostValue(0, 'usd')).toBe('$0.00');
    });
  });

  describe('when the unit is not a currency', () => {
    it('appends the unit after the amount', () => {
      expect(formatCostValue(0.5, 'credits')).toBe('0.5 credits');
    });
  });

  describe('when the unit is missing', () => {
    it('defaults to dollars', () => {
      expect(formatCostValue(0.25, null)).toBe('$0.25');
    });
  });

  describe('when the cost is unknown', () => {
    it('shows a dash', () => {
      expect(formatCostValue(null, 'usd')).toBe('-');
    });
  });
});

describe('formatTokenCount', () => {
  describe('when the count is known', () => {
    it('groups the thousands', () => {
      expect(formatTokenCount(12400)).toBe('12,400');
    });
  });

  describe('when the count is unknown', () => {
    it('shows a dash', () => {
      expect(formatTokenCount(null)).toBe('-');
    });
  });
});

describe('totalTokens', () => {
  describe('when only one direction is known', () => {
    it('counts the known side', () => {
      expect(totalTokens({ inputTokens: 120, outputTokens: null })).toBe(120);
    });
  });

  describe('when neither direction is known', () => {
    it('returns null', () => {
      expect(totalTokens({ inputTokens: null, outputTokens: null })).toBeNull();
    });
  });

  describe('when there is no usage', () => {
    it('returns null', () => {
      expect(totalTokens(null)).toBeNull();
    });
  });
});

describe('costDeltaFormatter', () => {
  describe('when given the unit of the compared costs', () => {
    it('formats the difference with that unit', () => {
      expect(costDeltaFormatter('usd')(0.0025000000000000005)).toBe('$0.0025');
    });
  });
});
