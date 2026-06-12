import { describe, expect, it } from 'vitest';

import type { Step } from '../../context/use-current-run';
import { buildTimeline } from '../workflow-timeline-utils';

describe('buildTimeline', () => {
  it('returns no rows when only input keys are present', () => {
    const steps: Record<string, Step> = {
      input: { status: 'success', startedAt: 1000, endedAt: 1000 },
      'nested.input': { status: 'success', startedAt: 1000, endedAt: 1000 },
    };

    expect(buildTimeline(steps, 2000)).toEqual([]);
  });

  it('positions two completed steps relative to the run window', () => {
    // run window: [1000, 3000] => totalMs = 2000
    const steps: Record<string, Step> = {
      stepOne: { status: 'success', startedAt: 1000, endedAt: 2000 },
      stepTwo: { status: 'success', startedAt: 2000, endedAt: 3000 },
    };

    const rows = buildTimeline(steps, 9999);

    expect(rows).toHaveLength(2);

    const [first, second] = rows;

    expect(first.stepId).toBe('stepOne');
    expect(first.status).toBe('success');
    expect(first.offsetPct).toBe(0);
    expect(first.widthPct).toBe(50);
    expect(first.durationMs).toBe(1000);
    expect(first.isRunning).toBe(false);

    expect(second.stepId).toBe('stepTwo');
    expect(second.offsetPct).toBe(50);
    expect(second.widthPct).toBe(50);
    expect(second.durationMs).toBe(1000);
    expect(second.isRunning).toBe(false);
  });

  it('uses the injected now for a running step without endedAt', () => {
    // run window: [1000, now=2000] => totalMs = 1000
    const steps: Record<string, Step> = {
      stepOne: { status: 'running', startedAt: 1000 },
    };

    const [row] = buildTimeline(steps, 2000);

    expect(row.stepId).toBe('stepOne');
    expect(row.isRunning).toBe(true);
    expect(row.durationMs).toBe(1000);
    expect(row.offsetPct).toBe(0);
    expect(row.widthPct).toBe(100);
  });
});
