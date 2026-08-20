import { describe, expect, it } from 'vitest';

import type { WorkItem } from './services/workItems';
import { buildShape, TRACE_WINDOWS } from './traces';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const HOUR = 3_600_000;
const DAY = TRACE_WINDOWS[0]!;

const hoursAgo = (hours: number) => new Date(NOW - hours * HOUR).toISOString();

let nextId = 0;
function card(stays: { stage: string; from: number; to?: number }[]): WorkItem {
  nextId += 1;
  return {
    id: `item-${nextId}`,
    orgId: 'org1',
    createdBy: 'u1',
    githubProjectId: 'proj1',
    source: 'github-issue',
    sourceKey: null,
    parentWorkItemId: null,
    title: `Card ${nextId}`,
    url: null,
    stages: [stays.at(-1)!.stage],
    stageHistory: stays.map(stay => ({
      stage: stay.stage,
      enteredAt: hoursAgo(stay.from),
      ...(stay.to === undefined ? {} : { exitedAt: hoursAgo(stay.to) }),
      by: 'u1',
    })),
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: hoursAgo(stays[0]!.from),
    updatedAt: hoursAgo(0),
  };
}

function band(items: WorkItem[]) {
  return buildShape(900, items, new Set(), DAY, NOW).band;
}

describe('board occupancy', () => {
  it('counts the cards a stage was holding at each sample, and peaks at the busiest moment', () => {
    const { series, peak, totals } = band([
      card([{ stage: 'execute', from: 6, to: 2 }]),
      card([{ stage: 'execute', from: 4 }]),
    ]);
    const execute = series.find(entry => entry.stage === 'execute')!;

    expect(peak).toBe(2);
    // 6h ago only the first card is in; both overlap between 4h and 2h ago
    expect(execute.values[0]).toBe(0);
    expect(Math.max(...execute.values)).toBe(2);
    expect(totals).toEqual(execute.values);
  });

  // The last sample is `now`; reading an open stay as "ends now" emptied the
  // board at the right edge of every chart.
  it('keeps a card still in the stage on the last sample', () => {
    const { series, totals } = band([card([{ stage: 'review', from: 3 }])]);

    expect(series.find(entry => entry.stage === 'review')!.values.at(-1)).toBe(1);
    expect(totals.at(-1)).toBe(1);
  });

  it('leaves intake out of the band, so the queue does not read as work under way', () => {
    const { series, peak } = band([card([{ stage: 'intake', from: 5 }])]);

    expect(series.map(entry => entry.stage)).toEqual(['triage', 'planning', 'execute', 'review']);
    expect(peak).toBe(0);
  });
});
