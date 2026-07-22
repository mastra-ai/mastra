import { describe, expect, it } from 'vitest';

import type { WorkItemRow, WorkItemStageEntry } from './base';
import { clampMetricsWindow, computeFactoryMetrics } from './metrics';

/** Fixed "now" so every duration in the specs is deterministic. */
const NOW = new Date('2026-07-15T12:00:00.000Z');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** ISO timestamp `hours` before NOW. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

function makeItem(overrides: Partial<WorkItemRow>): WorkItemRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    orgId: 'org_1',
    createdBy: 'user_1',
    factoryProjectId: '00000000-0000-4000-8000-0000000000aa',
    externalSource: null,
    title: 'Item',
    stages: ['intake'],
    stageHistory: [{ stage: 'intake', enteredAt: hoursAgo(1), by: 'user_1' }],
    sessions: {},
    metadata: {},
    createdAt: new Date(NOW.getTime() - HOUR),
    updatedAt: new Date(NOW.getTime() - HOUR),
    ...overrides,
  };
}

/** A completed item: created `createdHoursAgo` ago, done `doneHoursAgo` ago. */
function doneItem(id: string, createdHoursAgo: number, doneHoursAgo: number): WorkItemRow {
  const history: WorkItemStageEntry[] = [
    { stage: 'intake', enteredAt: hoursAgo(createdHoursAgo), exitedAt: hoursAgo(doneHoursAgo + 2), by: 'user_1' },
    { stage: 'execute', enteredAt: hoursAgo(doneHoursAgo + 2), exitedAt: hoursAgo(doneHoursAgo), by: 'user_1' },
    { stage: 'done', enteredAt: hoursAgo(doneHoursAgo), by: 'user_1' },
  ];
  return makeItem({
    id,
    stages: ['done'],
    stageHistory: history,
    createdAt: new Date(NOW.getTime() - createdHoursAgo * HOUR),
  });
}

describe('clampMetricsWindow', () => {
  it('accepts supported windows and clamps everything else to 30', () => {
    expect(clampMetricsWindow('7')).toBe(7);
    expect(clampMetricsWindow('30')).toBe(30);
    expect(clampMetricsWindow('90')).toBe(90);
    expect(clampMetricsWindow('14')).toBe(30);
    expect(clampMetricsWindow('abc')).toBe(30);
    expect(clampMetricsWindow(undefined)).toBe(30);
    expect(clampMetricsWindow('-7')).toBe(30);
  });
});

describe('computeFactoryMetrics', () => {
  it('given an empty board, then everything is zeroed with a gap-filled throughput series', () => {
    const metrics = computeFactoryMetrics({ items: [], days: 7, now: NOW });

    expect(metrics.windowDays).toBe(7);
    expect(metrics.throughput).toHaveLength(7);
    expect(metrics.throughput.every(point => point.count === 0)).toBe(true);
    // Series is oldest → newest, ending today (UTC).
    expect(metrics.throughput.at(-1)?.date).toBe('2026-07-15');
    expect(metrics.throughput[0]?.date).toBe('2026-07-09');
    expect(metrics.cycleTime).toEqual({ medianMs: null, p90Ms: null, samples: 0 });
    expect(metrics.stageDurations).toEqual([]);
    expect(metrics.wip).toEqual([]);
    expect(metrics.wipTotal).toBe(0);
    expect(metrics.agingWip).toEqual([]);
    expect(metrics.sourceMix).toEqual([]);
    expect(metrics.transitions).toEqual({ human: 0, total: 0 });
  });

  it('given completed items, then throughput buckets by UTC day and cycle time spans creation → done', () => {
    const items = [
      doneItem('00000000-0000-4000-8000-000000000001', 48, 2), // done today, 46h cycle
      doneItem('00000000-0000-4000-8000-000000000002', 60, 26), // done yesterday, 34h cycle
      doneItem('00000000-0000-4000-8000-000000000003', 30, 26), // done yesterday, 4h cycle
    ];

    const metrics = computeFactoryMetrics({ items, days: 7, now: NOW });

    const byDate = Object.fromEntries(metrics.throughput.map(p => [p.date, p.count]));
    expect(byDate['2026-07-15']).toBe(1);
    expect(byDate['2026-07-14']).toBe(2);
    expect(metrics.cycleTime.samples).toBe(3);
    expect(metrics.cycleTime.medianMs).toBe(34 * HOUR);
    expect(metrics.cycleTime.p90Ms).toBe(46 * HOUR);
  });

  it('given a done entry outside the window, then it does not count toward throughput or cycle time', () => {
    const metrics = computeFactoryMetrics({
      items: [doneItem('00000000-0000-4000-8000-000000000001', 30 * 24, 10 * 24)],
      days: 7,
      now: NOW,
    });

    expect(metrics.throughput.every(point => point.count === 0)).toBe(true);
    expect(metrics.cycleTime.samples).toBe(0);
    // ...but it still isn't in-flight.
    expect(metrics.wipTotal).toBe(0);
  });

  it('given an item pulled back out of done, then it is not counted as completed', () => {
    const item = makeItem({
      stages: ['review'],
      stageHistory: [
        { stage: 'done', enteredAt: hoursAgo(5), exitedAt: hoursAgo(3), by: 'user_1' },
        { stage: 'review', enteredAt: hoursAgo(3), by: 'user_1' },
      ],
    });

    const metrics = computeFactoryMetrics({ items: [item], days: 7, now: NOW });

    expect(metrics.cycleTime.samples).toBe(0);
    expect(metrics.throughput.every(point => point.count === 0)).toBe(true);
    expect(metrics.wipTotal).toBe(1);
  });

  it('given re-entered stages, then every completed visit contributes to that stage duration', () => {
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [
        { stage: 'review', enteredAt: hoursAgo(10), exitedAt: hoursAgo(8), by: 'user_1' }, // 2h
        { stage: 'execute', enteredAt: hoursAgo(8), exitedAt: hoursAgo(2), by: 'user_1' }, // 6h
        { stage: 'review', enteredAt: hoursAgo(2), exitedAt: hoursAgo(1), by: 'user_1' }, // 1h — bounced back
        { stage: 'execute', enteredAt: hoursAgo(1), by: 'user_1' }, // open, no duration yet
      ],
    });

    const metrics = computeFactoryMetrics({ items: [item], days: 7, now: NOW });

    const review = metrics.stageDurations.find(d => d.stage === 'review');
    const execute = metrics.stageDurations.find(d => d.stage === 'execute');
    expect(review).toEqual({ stage: 'review', medianMs: 1 * HOUR, samples: 2 });
    expect(execute).toEqual({ stage: 'execute', medianMs: 6 * HOUR, samples: 1 });
  });

  it('given open stage entries, then WIP and aging reflect the current board, oldest first', () => {
    const items = [
      makeItem({
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Old review',
        stages: ['review'],
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'o/r#1',
          url: 'https://github.com/o/r/pull/1',
        },
        stageHistory: [{ stage: 'review', enteredAt: hoursAgo(70), by: 'user_1' }],
      }),
      makeItem({
        id: '00000000-0000-4000-8000-000000000002',
        title: 'Parallel build+review',
        stages: ['execute', 'review'],
        stageHistory: [
          { stage: 'execute', enteredAt: hoursAgo(20), by: 'user_1' },
          { stage: 'review', enteredAt: hoursAgo(4), by: 'user_1' },
        ],
      }),
      doneItem('00000000-0000-4000-8000-000000000003', 40, 2),
    ];

    const metrics = computeFactoryMetrics({ items, days: 30, now: NOW });

    const wip = Object.fromEntries(metrics.wip.map(w => [w.stage, w.count]));
    expect(wip).toEqual({ review: 2, execute: 1, done: 1 });
    expect(metrics.wipTotal).toBe(2); // multi-stage item counted once, done item excluded
    expect(metrics.agingWip.map(a => a.title)).toEqual(['Old review', 'Parallel build+review']);
    // Multi-stage card ages by its longest-held open stage.
    expect(metrics.agingWip[1]).toMatchObject({ stage: 'execute', enteredAt: hoursAgo(20) });
    expect(metrics.agingWip[0]).toMatchObject({ stage: 'review', url: 'https://github.com/o/r/pull/1' });
  });

  it('given history missing an open entry for a held stage, then aging falls back to createdAt', () => {
    const item = makeItem({
      stages: ['triage'],
      stageHistory: [],
      createdAt: new Date(NOW.getTime() - 6 * HOUR),
    });

    const metrics = computeFactoryMetrics({ items: [item], days: 7, now: NOW });

    expect(metrics.agingWip).toHaveLength(1);
    expect(metrics.agingWip[0]).toMatchObject({ stage: 'triage', enteredAt: hoursAgo(6) });
  });

  it('given items created inside and outside the window, then source mix only counts the window', () => {
    const githubIssue = (externalId: string) => ({
      integrationId: 'github',
      type: 'issue',
      externalId,
    });
    const items = [
      makeItem({ id: '00000000-0000-4000-8000-000000000001', externalSource: githubIssue('1') }),
      makeItem({ id: '00000000-0000-4000-8000-000000000002', externalSource: githubIssue('2') }),
      makeItem({ id: '00000000-0000-4000-8000-000000000003' }),
      makeItem({
        id: '00000000-0000-4000-8000-000000000004',
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'LIN-1' },
        createdAt: new Date(NOW.getTime() - 40 * DAY),
      }),
    ];

    const metrics = computeFactoryMetrics({ items, days: 30, now: NOW });

    expect(metrics.sourceMix).toEqual([
      { source: 'github:issue', count: 2 },
      { source: 'manual', count: 1 },
    ]);
  });

  it('given stage moves in the window, then transitions count entries and split out factory actors', () => {
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [
        { stage: 'intake', enteredAt: hoursAgo(50 * 24), exitedAt: hoursAgo(3), by: 'user_1' }, // entered outside window
        { stage: 'triage', enteredAt: hoursAgo(3), exitedAt: hoursAgo(2), by: 'user_1' },
        { stage: 'execute', enteredAt: hoursAgo(2), by: 'factory' },
      ],
    });

    const metrics = computeFactoryMetrics({ items: [item], days: 30, now: NOW });

    expect(metrics.transitions).toEqual({ human: 1, total: 2 });
  });
});
