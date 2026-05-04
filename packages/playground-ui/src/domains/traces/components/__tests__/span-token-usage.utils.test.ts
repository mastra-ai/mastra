import type { UsageStats } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { getTokenUsageView } from '../span-token-usage.utils';

describe('getTokenUsageView', () => {
  it('returns null when usage is undefined', () => {
    expect(getTokenUsageView(undefined)).toBeNull();
  });

  it('returns null when usage is null', () => {
    expect(getTokenUsageView(null)).toBeNull();
  });

  it('returns null when usage is an empty object', () => {
    expect(getTokenUsageView({} as UsageStats)).toBeNull();
  });

  it('returns null when only details are present (no top-level token counts)', () => {
    const usage = {
      inputDetails: { text: 50 },
      outputDetails: { text: 20 },
    } as UsageStats;
    expect(getTokenUsageView(usage)).toBeNull();
  });

  it('renders both columns when only the input side is present, with output defaulting to 0', () => {
    const view = getTokenUsageView({ inputTokens: 100 } as UsageStats);
    expect(view).not.toBeNull();
    expect(view!.inputValue).toBe(100);
    expect(view!.outputValue).toBe(0);
    expect(view!.total).toBe(100);
    expect(view!.showSplit).toBe(true);
    expect(view!.inputPct).toBe(100);
    expect(view!.outputPct).toBe(0);
    expect(view!.inputDetails).toBeUndefined();
    expect(view!.outputDetails).toBeUndefined();
  });

  it('drops details on a side that has no top-level token count', () => {
    const view = getTokenUsageView({
      inputTokens: 100,
      outputDetails: { text: 50 },
    } as UsageStats);
    expect(view).not.toBeNull();
    expect(view!.outputValue).toBe(0);
    expect(view!.outputDetails).toBeUndefined();
  });

  it('keeps details on a side that has a top-level token count', () => {
    const view = getTokenUsageView({
      inputTokens: 100,
      inputDetails: { text: 80, cacheRead: 20 },
      outputTokens: 25,
    } as UsageStats);
    expect(view).not.toBeNull();
    expect(view!.inputDetails).toEqual({ text: 80, cacheRead: 20 });
    expect(view!.outputDetails).toBeUndefined();
  });

  it('treats a details object with no numeric values as absent', () => {
    const view = getTokenUsageView({
      inputTokens: 100,
      inputDetails: { text: undefined } as unknown as UsageStats['inputDetails'],
    } as UsageStats);
    expect(view).not.toBeNull();
    expect(view!.inputDetails).toBeUndefined();
  });

  it('renders both columns at 0 with no split bar when both totals are 0', () => {
    const view = getTokenUsageView({ inputTokens: 0, outputTokens: 0 } as UsageStats);
    expect(view).not.toBeNull();
    expect(view!.inputValue).toBe(0);
    expect(view!.outputValue).toBe(0);
    expect(view!.total).toBe(0);
    expect(view!.showSplit).toBe(false);
    expect(view!.inputPct).toBe(0);
    expect(view!.outputPct).toBe(0);
  });

  it('splits 50/50 when input and output are equal', () => {
    const view = getTokenUsageView({ inputTokens: 100, outputTokens: 100 } as UsageStats);
    expect(view!.total).toBe(200);
    expect(view!.inputPct).toBe(50);
    expect(view!.outputPct).toBe(50);
  });

  it('produces percentages that always sum to 100 for asymmetric inputs', () => {
    const view = getTokenUsageView({ inputTokens: 1000, outputTokens: 250 } as UsageStats);
    expect(view!.total).toBe(1250);
    expect(view!.inputPct).toBe(80);
    expect(view!.outputPct).toBe(20);
    expect(view!.inputPct + view!.outputPct).toBe(100);
  });

  it('handles one side at 0 with the other positive (100/0 split)', () => {
    const view = getTokenUsageView({ inputTokens: 100, outputTokens: 0 } as UsageStats);
    expect(view!.showSplit).toBe(true);
    expect(view!.inputPct).toBe(100);
    expect(view!.outputPct).toBe(0);
  });
});
