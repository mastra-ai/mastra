import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../workflow-timeline-utils';

describe('Workflow timeline timing', () => {
  it('does not keep suspended or completed steps running when their end timestamp is absent', () => {
    const rows = buildTimeline(
      {
        approval: { status: 'suspended', startedAt: 100 },
        saved: { status: 'success', startedAt: 120 },
      },
      1000,
    );
    expect(rows.every(row => !row.isRunning && row.timing === undefined)).toBe(true);
  });

  it('keeps entries without valid timestamps without corrupting measured durations', () => {
    const rows = buildTimeline(
      {
        skipped: { status: 'skipped', startedAt: NaN },
        completed: { status: 'success', startedAt: 100, endedAt: 200 },
      },
      1000,
    );
    expect(rows[0].timing).toBeUndefined();
    expect(rows[1].timing).toEqual({ durationMs: 100, offsetPct: 0, widthPct: 100 });
  });

  it('advances only running steps and keeps the visible interval within its track', () => {
    const rows = buildTimeline(
      {
        first: { status: 'success', startedAt: 100, endedAt: 200 },
        active: { status: 'running', startedAt: 200 },
        instant: { status: 'success', startedAt: 300, endedAt: 300 },
      },
      300,
    );
    expect(rows[1]).toMatchObject({ isRunning: true, timing: { durationMs: 100, offsetPct: 50, widthPct: 50 } });
    expect(rows[2].timing?.durationMs).toBe(0);
    for (const row of rows) {
      if (row.timing) expect(row.timing.offsetPct + row.timing.widthPct).toBeLessThanOrEqual(100);
    }
  });
});

describe('Workflow timeline fallback', () => {
  describe('when a reported interval ends before it starts', () => {
    it('omits the invalid interval without distorting another step', () => {
      const rows = buildTimeline(
        {
          broken: { status: 'success', startedAt: 400, endedAt: 300 },
          valid: { status: 'success', startedAt: 100, endedAt: 200 },
        },
        1000,
      );
      expect(rows[0].timing).toBeUndefined();
      expect(rows[1].timing).toEqual({ offsetPct: 0, widthPct: 100, durationMs: 100 });
    });
  });
});
