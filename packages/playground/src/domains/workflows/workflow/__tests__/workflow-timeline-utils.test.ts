import { describe, expect, it } from 'vitest';

import type { Step } from '../../context/use-current-run';
import { buildTimeline, formatTimelineDuration, isNestedTimelineEntry } from '../workflow-timeline-utils';

const step = (startedAt: number, endedAt?: number, status: Step['status'] = 'success'): Step =>
  ({ startedAt, endedAt, status }) as Step;

describe('isNestedTimelineEntry', () => {
  it('treats a dotted step id as nested', () => {
    expect(isNestedTimelineEntry('parent.child')).toBe(true);
  });

  it('treats a bare step id as top level', () => {
    expect(isNestedTimelineEntry('parent')).toBe(false);
  });
});

describe('formatTimelineDuration', () => {
  it('renders milliseconds as seconds', () => {
    expect(formatTimelineDuration(1500)).toBe('1.5s');
  });

  it('keeps three significant digits', () => {
    expect(formatTimelineDuration(1234)).toBe('1.23s');
  });

  it('drops trailing zeros', () => {
    expect(formatTimelineDuration(2000)).toBe('2s');
  });

  it('renders a sub-second duration', () => {
    expect(formatTimelineDuration(45)).toBe('0.045s');
  });

  it('renders a zero duration', () => {
    expect(formatTimelineDuration(0)).toBe('0s');
  });
});

describe('buildTimeline', () => {
  describe('when the run has no steps', () => {
    it('produces no rows', () => {
      expect(buildTimeline({}, 1000)).toEqual([]);
    });
  });

  describe('when the run only carries input entries', () => {
    it('ignores them, because they are not steps', () => {
      expect(buildTimeline({ input: step(0, 10) }, 100)).toEqual([]);
    });

    it('ignores a nested input entry too', () => {
      expect(buildTimeline({ 'parent.input': step(0, 10) }, 100)).toEqual([]);
    });

    it('keeps a step whose id merely ends in the word input', () => {
      const rows = buildTimeline({ 'validate-input': step(0, 10) }, 100);

      expect(rows.map(r => r.stepId)).toEqual(['validate-input']);
    });
  });

  describe('when the run has finished', () => {
    it('positions each bar against the run span', () => {
      const rows = buildTimeline({ first: step(0, 50), second: step(50, 100) }, 100);

      expect(rows.map(r => [r.stepId, r.offsetPct, r.widthPct])).toEqual([
        ['first', 0, 50],
        ['second', 50, 50],
      ]);
    });

    it('measures the span from the earliest start to the latest end', () => {
      // Declared out of chronological order on purpose.
      const rows = buildTimeline({ late: step(100, 200), early: step(0, 100) }, 999);

      expect(rows.find(r => r.stepId === 'early')?.offsetPct).toBe(0);
      expect(rows.find(r => r.stepId === 'late')?.offsetPct).toBe(50);
    });

    it('reports each step duration', () => {
      const rows = buildTimeline({ only: step(10, 60) }, 999);

      expect(rows[0]?.durationMs).toBe(50);
    });

    it('does not mark a finished step as running', () => {
      const rows = buildTimeline({ only: step(0, 50) }, 999);

      expect(rows[0]?.isRunning).toBe(false);
    });
  });

  describe('when a step is still running', () => {
    it('measures it against the injected clock', () => {
      const rows = buildTimeline({ running: step(0, undefined) }, 80);

      expect(rows[0]?.isRunning).toBe(true);
      expect(rows[0]?.durationMs).toBe(80);
    });

    it('grows the bar as the clock advances', () => {
      const atEighty = buildTimeline({ done: step(0, 100), running: step(0, undefined) }, 80);
      const atTwoHundred = buildTimeline({ done: step(0, 100), running: step(0, undefined) }, 200);

      expect(atTwoHundred[1]!.durationMs).toBeGreaterThan(atEighty[1]!.durationMs);
    });

    it('stretches the run span when it outruns every finished step', () => {
      const rows = buildTimeline({ done: step(0, 50), running: step(0, undefined) }, 100);

      // The span is now 0–100, so the finished step takes half the width.
      expect(rows.find(r => r.stepId === 'done')?.widthPct).toBe(50);
    });
  });

  describe('when a step is near-instant', () => {
    it('keeps a minimum bar width so it stays visible', () => {
      const rows = buildTimeline({ instant: step(0, 0), long: step(0, 1000) }, 1000);

      expect(rows.find(r => r.stepId === 'instant')?.widthPct).toBe(1);
      expect(rows.find(r => r.stepId === 'instant')?.durationMs).toBe(0);
    });
  });

  describe('when every step starts and ends at the same instant', () => {
    it('avoids dividing by a zero-length run', () => {
      const rows = buildTimeline({ a: step(5, 5), b: step(5, 5) }, 5);

      expect(rows.every(r => Number.isFinite(r.offsetPct))).toBe(true);
      expect(rows.every(r => r.offsetPct === 0)).toBe(true);
      expect(rows.every(r => r.widthPct === 1)).toBe(true);
    });
  });

  describe('row metadata', () => {
    it('carries the step and its status through', () => {
      const running = step(0, undefined, 'running');
      const rows = buildTimeline({ 'parent.child': running }, 10);

      expect(rows[0]?.step).toBe(running);
      expect(rows[0]?.status).toBe('running');
      expect(rows[0]?.isNestedEntry).toBe(true);
    });

    it('flags a top-level step as not nested', () => {
      const rows = buildTimeline({ parent: step(0, 10) }, 10);

      expect(rows[0]?.isNestedEntry).toBe(false);
    });
  });
});
