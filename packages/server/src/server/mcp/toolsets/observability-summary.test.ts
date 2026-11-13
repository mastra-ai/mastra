import { describe, expect, it } from 'vitest';
import { summarizeMetrics, summarizeTraces } from './observability-summary';

describe('summarizeTraces', () => {
  it('lists the threads of a query grouped by thread', () => {
    const text = summarizeTraces('traces')({
      groups: [{ threadId: 'thread-1' }, { threadId: 'thread-2' }],
      page: { next: 'cursor-2' },
    });

    expect(text).toContain('2 threads matched');
    expect(text).toContain('- thread-1\n- thread-2');
    expect(text).toContain('page.after = "cursor-2"');
  });
});

describe('summarizeMetrics', () => {
  it('summarizes an aggregate', () => {
    const text = summarizeMetrics({ value: 1234.5678, previousValue: 1000, changePercent: 23.45 });
    expect(text).toContain('Value: 1234.568');
    expect(text).toContain('Previous period: 1000');
    expect(text).toContain('Change: 23.45%');
  });

  it('keeps small nonzero values instead of rounding them to 0', () => {
    const text = summarizeMetrics({
      groups: [{ dimensions: { model: 'gpt-5-mini' }, value: 0.000123456, estimatedCost: 0.0004, costUnit: 'usd' }],
    });
    expect(text).toContain('- model=gpt-5-mini | 0.000123 | 0.0004 usd');
  });

  it('lists breakdown groups', () => {
    const text = summarizeMetrics({
      groups: [{ dimensions: { entityName: 'support-agent' }, value: 42, estimatedCost: 0.5, costUnit: 'usd' }],
    });
    expect(text).toContain('1 groups');
    expect(text).toContain('- entityName=support-agent | 42 | 0.5 usd');
  });

  it('reduces each series to its range and endpoints', () => {
    const text = summarizeMetrics({
      series: [
        {
          name: 'mastra_agent_duration_ms',
          points: [
            { timestamp: '2026-11-01T00:00:00.000Z', value: 10 },
            { timestamp: '2026-11-02T00:00:00.000Z', value: 50 },
            { timestamp: '2026-11-03T00:00:00.000Z', value: 20 },
          ],
        },
        { percentile: 0.95, points: [] },
      ],
    });
    expect(text).toContain(
      '- mastra_agent_duration_ms: 3 points from 2026-11-01T00:00:00.000Z (10) to 2026-11-03T00:00:00.000Z (20), min 10, max 50',
    );
    expect(text).toContain('- p0.95: no data');
  });
});
