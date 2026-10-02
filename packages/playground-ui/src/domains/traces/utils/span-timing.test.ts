import { describe, expect, it } from 'vitest';

import type { UISpan } from '../types';
import { getSpanTimingLayout } from './span-timing';

const start = '2026-06-01T10:00:00.000Z';

const span = (latency: number, offsetMs = 0): UISpan => ({
  id: 'span',
  name: 'span',
  type: 'tool_call',
  latency,
  startTime: new Date(new Date(start).getTime() + offsetMs).toISOString(),
});

describe('getSpanTimingLayout', () => {
  it('spans the whole track for the root span', () => {
    expect(getSpanTimingLayout(span(1000), 1000, start)).toEqual({
      startShiftMs: 0,
      leftPercent: 0,
      widthPercent: 100,
    });
  });

  it('offsets a child by its start shift', () => {
    expect(getSpanTimingLayout(span(200, 250), 1000, start)).toEqual({
      startShiftMs: 250,
      leftPercent: 25,
      widthPercent: 20,
    });
  });

  it('collapses to zero without an overall latency', () => {
    expect(getSpanTimingLayout(span(200, 250), 0, start)).toEqual({
      startShiftMs: 250,
      leftPercent: 0,
      widthPercent: 0,
    });
  });

  it('keeps the bar inside the track when rounding overshoots', () => {
    // floor(33.3) = 33, ceil(66.7) = 67 → 100 total, but a span ending past the trace is clamped.
    const layout = getSpanTimingLayout(span(800, 333), 1000, start);
    expect(layout.leftPercent + layout.widthPercent).toBeLessThanOrEqual(100);
    expect(layout.widthPercent).toBe(67);
  });

  it('clamps a span starting after the trace end', () => {
    expect(getSpanTimingLayout(span(100, 2000), 1000, start)).toEqual({
      startShiftMs: 2000,
      leftPercent: 100,
      widthPercent: 0,
    });
  });
});
