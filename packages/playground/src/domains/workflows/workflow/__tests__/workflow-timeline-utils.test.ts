import { describe, expect, it } from 'vitest';
import type { Step } from '../../context/use-current-run';
import { buildTimeline } from '../workflow-timeline-utils';

const step = (startedAt: number, endedAt?: number): Step => ({
  startedAt,
  endedAt,
  status: 'success',
});

const NOW = 10_000;

const rowById = (rows: ReturnType<typeof buildTimeline>, stepId: string) => rows.find(row => row.stepId === stepId);

describe('buildTimeline', () => {
  describe('when steps are not in startedAt order', () => {
    it('returns rows sorted by startedAt ascending', () => {
      const steps: Record<string, Step> = {
        'a-very-long-first-step': step(100, 400),
        b: step(300, 350),
        'medium-final-step': step(200, 500),
      };

      const rows = buildTimeline(steps, NOW);

      expect(rows.map(row => row.stepId)).toEqual(['a-very-long-first-step', 'medium-final-step', 'b']);
    });
  });

  describe('when steps share the same startedAt', () => {
    it('falls back to stepId order for a deterministic result', () => {
      const steps: Record<string, Step> = {
        charlie: step(100, 200),
        alpha: step(100, 200),
        bravo: step(100, 200),
      };

      const rows = buildTimeline(steps, NOW);

      expect(rows.map(row => row.stepId)).toEqual(['alpha', 'bravo', 'charlie']);
    });
  });

  describe('when an input pseudo-key is present', () => {
    it('excludes input keys and still sorts the remaining steps chronologically', () => {
      const steps: Record<string, Step> = {
        input: step(0),
        'later.step': step(300, 400),
        'parent.child': step(150, 250),
        'parent.child.input': step(150),
      };

      const rows = buildTimeline(steps, NOW);

      expect(rows.map(row => row.stepId)).toEqual(['parent.child', 'later.step']);
    });
  });
});

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
    expect(rowById(rows, 'skipped')?.timing).toBeUndefined();
    expect(rowById(rows, 'completed')?.timing).toEqual({ durationMs: 100, offsetPct: 0, widthPct: 100 });
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
    expect(rowById(rows, 'active')).toMatchObject({
      isRunning: true,
      timing: { durationMs: 100, offsetPct: 50, widthPct: 50 },
    });
    expect(rowById(rows, 'instant')?.timing?.durationMs).toBe(0);
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
      expect(rowById(rows, 'broken')?.timing).toBeUndefined();
      expect(rowById(rows, 'valid')?.timing).toEqual({ offsetPct: 0, widthPct: 100, durationMs: 100 });
    });
  });
});
