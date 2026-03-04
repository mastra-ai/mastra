import type { BufferedObservationChunk } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import {
  getMaxThreshold,
  calculateDynamicThreshold,
  resolveBufferTokens,
  resolveBlockAfter,
  resolveRetentionFloor,
  resolveActivationRatio,
  calculateProjectedMessageRemoval,
} from '../thresholds';

function makeChunk(messageTokens: number): BufferedObservationChunk {
  return {
    id: `chunk-${Math.random().toString(36).slice(2, 8)}`,
    cycleId: 'cycle-1',
    observations: '',
    tokenCount: messageTokens,
    messageIds: [],
    messageTokens,
    lastObservedAt: new Date(),
    createdAt: new Date(),
  };
}

describe('thresholds', () => {
  describe('getMaxThreshold', () => {
    it('returns the number for simple thresholds', () => {
      expect(getMaxThreshold(30000)).toBe(30000);
    });

    it('returns max for range thresholds', () => {
      expect(getMaxThreshold({ min: 8000, max: 70000 })).toBe(70000);
    });

    it('handles zero', () => {
      expect(getMaxThreshold(0)).toBe(0);
    });
  });

  describe('calculateDynamicThreshold', () => {
    it('returns the number as-is for simple thresholds', () => {
      expect(calculateDynamicThreshold(30000, 10000)).toBe(30000);
      expect(calculateDynamicThreshold(30000, 0)).toBe(30000);
    });

    it('expands into unused observation space for range thresholds', () => {
      // 30k:40k → total budget 70k
      // 0 observations → can use full 70k
      expect(calculateDynamicThreshold({ min: 30000, max: 70000 }, 0)).toBe(70000);
    });

    it('shrinks as observations grow', () => {
      // 10k observations → 70k - 10k = 60k
      expect(calculateDynamicThreshold({ min: 30000, max: 70000 }, 10000)).toBe(60000);
    });

    it('never goes below the base threshold (min)', () => {
      // 50k observations → 70k - 50k = 20k, but min is 30k
      expect(calculateDynamicThreshold({ min: 30000, max: 70000 }, 50000)).toBe(30000);
    });

    it('returns min when observations exceed the total budget', () => {
      expect(calculateDynamicThreshold({ min: 30000, max: 70000 }, 100000)).toBe(30000);
    });

    it('rounds the result', () => {
      // 33333 observations → 70000 - 33333 = 36667
      expect(calculateDynamicThreshold({ min: 30000, max: 70000 }, 33333)).toBe(36667);
    });
  });

  describe('resolveBufferTokens', () => {
    it('returns undefined for false', () => {
      expect(resolveBufferTokens(false, 30000)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(resolveBufferTokens(undefined, 30000)).toBeUndefined();
    });

    it('converts fractional values to absolute using simple threshold', () => {
      // 0.25 * 20000 = 5000
      expect(resolveBufferTokens(0.25, 20000)).toBe(5000);
    });

    it('converts fractional values using range threshold max', () => {
      // 0.1 * 70000 = 7000
      expect(resolveBufferTokens(0.1, { min: 30000, max: 70000 })).toBe(7000);
    });

    it('returns absolute values as-is', () => {
      expect(resolveBufferTokens(5000, 30000)).toBe(5000);
    });

    it('returns 1 as-is (not fractional — boundary)', () => {
      // 1 is not in (0, 1) so it's treated as absolute
      expect(resolveBufferTokens(1, 30000)).toBe(1);
    });

    it('handles very small fractions', () => {
      expect(resolveBufferTokens(0.01, 100000)).toBe(1000);
    });
  });

  describe('resolveBlockAfter', () => {
    it('returns undefined for undefined', () => {
      expect(resolveBlockAfter(undefined, 30000)).toBeUndefined();
    });

    it('converts multipliers to absolute values', () => {
      // 1.5 * 20000 = 30000
      expect(resolveBlockAfter(1.5, 20000)).toBe(30000);
    });

    it('treats 1.0 as a multiplier (exactly at threshold)', () => {
      expect(resolveBlockAfter(1.0, 20000)).toBe(20000);
    });

    it('uses range max for multiplier resolution', () => {
      // 1.2 * 70000 = 84000
      expect(resolveBlockAfter(1.2, { min: 30000, max: 70000 })).toBe(84000);
    });

    it('treats values >= 100 as absolute token counts', () => {
      expect(resolveBlockAfter(50000, 20000)).toBe(50000);
      expect(resolveBlockAfter(100, 20000)).toBe(100); // 100 is >= 100, so absolute
    });

    it('rounds the result', () => {
      // 1.3 * 33333 = 43332.9
      expect(resolveBlockAfter(1.3, 33333)).toBe(43333);
    });
  });

  describe('resolveRetentionFloor', () => {
    it('uses ratio when bufferActivation < 1000', () => {
      // 0.7 ratio → retentionFloor = 30000 * (1 - 0.7) = 9000
      expect(resolveRetentionFloor(0.7, 30000)).toBeCloseTo(9000, 0);
    });

    it('returns absolute value when bufferActivation >= 1000', () => {
      expect(resolveRetentionFloor(5000, 30000)).toBe(5000);
      expect(resolveRetentionFloor(1000, 30000)).toBe(1000);
    });

    it('ratio of 1.0 means zero retention', () => {
      expect(resolveRetentionFloor(1.0, 30000)).toBe(0);
    });

    it('ratio of 0.0 means full retention', () => {
      expect(resolveRetentionFloor(0.0, 30000)).toBe(30000);
    });
  });

  describe('resolveActivationRatio', () => {
    it('returns ratio as-is when < 1000', () => {
      expect(resolveActivationRatio(0.7, 30000)).toBe(0.7);
    });

    it('converts absolute to equivalent ratio when >= 1000', () => {
      // 5000 absolute, 30000 threshold → 1 - (5000 / 30000) ≈ 0.833
      const result = resolveActivationRatio(5000, 30000);
      expect(result).toBeCloseTo(0.8333, 3);
    });

    it('clamps to [0, 1]', () => {
      // bufferActivation > threshold → ratio would be negative, clamped to 0
      expect(resolveActivationRatio(50000, 30000)).toBe(0);
      // bufferActivation = 0 (>= 1000 is false) — handled by ratio path
    });

    it('exact match returns 0', () => {
      // 30000 / 30000 = 1, 1 - 1 = 0
      expect(resolveActivationRatio(30000, 30000)).toBe(0);
    });
  });

  describe('calculateProjectedMessageRemoval', () => {
    it('returns 0 for empty chunks', () => {
      expect(calculateProjectedMessageRemoval([], 0.7, 30000, 25000)).toBe(0);
    });

    it('selects the best over-boundary when within safeguards', () => {
      const chunks = [makeChunk(5000), makeChunk(5000), makeChunk(5000)];
      // bufferActivation 0.7, threshold 30000 → retentionFloor = 9000
      // pendingTokens 25000 → target = 25000 - 9000 = 16000
      // Chunk boundaries: 5000, 10000, 15000
      // All under target, so best under = 15000
      const result = calculateProjectedMessageRemoval(chunks, 0.7, 30000, 25000);
      expect(result).toBe(15000);
    });

    it('prefers over-boundary when close to target', () => {
      const chunks = [makeChunk(8000), makeChunk(9000)];
      // bufferActivation 0.7, threshold 30000 → retentionFloor = 9000
      // pendingTokens 25000 → target = 16000
      // Boundaries: 8000 (under), 17000 (over)
      // overshoot = 17000 - 16000 = 1000, maxOvershoot = 9000 * 0.95 = 8550
      // remaining = 25000 - 17000 = 8000 >= min(1000, 9000) = 1000
      const result = calculateProjectedMessageRemoval(chunks, 0.7, 30000, 25000);
      expect(result).toBe(17000);
    });

    it('falls back to under-boundary when over would overshoot too much', () => {
      const chunks = [makeChunk(3000), makeChunk(25000)];
      // bufferActivation 0.7, threshold 30000 → retentionFloor = 9000
      // pendingTokens 25000 → target = 16000
      // Boundaries: 3000 (under), 28000 (over)
      // overshoot = 28000 - 16000 = 12000 > maxOvershoot = 8550
      // Falls back to under-boundary = 3000 (remaining = 22000 >= 1000)
      const result = calculateProjectedMessageRemoval(chunks, 0.7, 30000, 25000);
      expect(result).toBe(3000);
    });

    it('returns first chunk for single chunk', () => {
      const chunks = [makeChunk(10000)];
      // retentionFloor = 30000 * (1 - 0.7) = 9000
      // target = 25000 - 9000 = 16000
      // Only boundary at 10000, under target
      const result = calculateProjectedMessageRemoval(chunks, 0.7, 30000, 25000);
      expect(result).toBe(10000);
    });

    it('handles activation ratio of 1.0 (remove everything)', () => {
      const chunks = [makeChunk(5000), makeChunk(5000)];
      // retentionFloor = 30000 * (1 - 1.0) = 0
      // target = 10000 - 0 = 10000
      // Boundary at 10000 exactly matches target
      const result = calculateProjectedMessageRemoval(chunks, 1.0, 30000, 10000);
      expect(result).toBe(10000);
    });

    it('handles absolute retention floor (>= 1000)', () => {
      const chunks = [makeChunk(4000), makeChunk(4000), makeChunk(4000)];
      // bufferActivation = 5000 (absolute), retentionFloor = 5000
      // pendingTokens 15000 → target = 15000 - 5000 = 10000
      // Boundaries: 4000 (under), 8000 (under), 12000 (over)
      // overshoot = 12000 - 10000 = 2000, maxOvershoot = 4750
      // remaining = 15000 - 12000 = 3000 >= min(1000, 5000) = 1000
      const result = calculateProjectedMessageRemoval(chunks, 5000, 30000, 15000);
      expect(result).toBe(12000);
    });
  });
});
