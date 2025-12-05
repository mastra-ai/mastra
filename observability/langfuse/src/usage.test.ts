import type { UsageStats } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { normalizeUsage } from './tracing';

describe('normalizeUsage', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = normalizeUsage(usage);
    expect(result?.input).toBe(100);
    expect(result?.output).toBe(50);
    expect(result?.total).toBe(150);
  });

  it('should extract cacheRead from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = normalizeUsage(usage);
    expect(result?.cachedInput).toBe(800);
  });

  it('should extract cacheWrite from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = normalizeUsage(usage);
    expect(result?.cacheWrite).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } };
    const result = normalizeUsage(usage);
    expect(result?.reasoning).toBe(400);
  });
});
