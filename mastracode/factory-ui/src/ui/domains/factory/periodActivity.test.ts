import { afterEach, describe, expect, it } from 'vitest';

import { ACTIVITY_KIND_ORDER, periodActivity } from './periodActivity';
import type { Activity, RunStarts } from './periodActivity';
import type { WorkItem } from './services/workItems';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 27, 10, 30).getTime();
const originalTimeZone = process.env.TZ;

function card(id: string, createdAt: number, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'repo-1',
    board: 'work',
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    title: `Card ${id}`,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(createdAt).toISOString(),
    ...overrides,
  };
}

function shippedCard(id: string, doneAt: number, stages = ['done']): WorkItem {
  return card(id, doneAt - 20 * DAY, {
    stages,
    stageHistory: [{ stage: 'done', enteredAt: new Date(doneAt).toISOString(), by: 'user-1' }],
  });
}

function slotTotals({ slots }: Activity) {
  return Object.fromEntries(
    ACTIVITY_KIND_ORDER.map(kind => [kind, slots.reduce((sum, slot) => sum + slot.counts[kind], 0)]),
  );
}

function allRunStarts(...starts: number[]): RunStarts {
  return { starts, completeAfter: Number.NEGATIVE_INFINITY };
}

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe('periodActivity', () => {
  it('counts what came in, ran and shipped in the last seven days, and the slots add up to each total', () => {
    const week = periodActivity({
      period: 'week',
      now: NOW,
      cards: [
        card('new', NOW - HOUR),
        card('this-week', NOW - 3 * DAY),
        card('last-week', NOW - 8 * DAY),
        shippedCard('shipped', NOW - 2 * DAY),
        shippedCard('shipped-long-ago', NOW - 10 * DAY),
        shippedCard('reopened', NOW - DAY, ['review']),
      ],
      runStarts: allRunStarts(NOW - 5 * HOUR, NOW - 9 * DAY),
    });

    expect(week.totals).toEqual({ cameIn: 2, ran: 1, shipped: 1 });
    expect(slotTotals(week)).toEqual(week.totals);
  });

  it('starts Today at local midnight and shows no slot after now', () => {
    const today = periodActivity({
      period: 'today',
      now: NOW,
      cards: [
        card('morning', new Date(2026, 9, 27, 9, 15).getTime()),
        card('last-night', new Date(2026, 9, 26, 23).getTime()),
      ],
      runStarts: allRunStarts(),
    });

    expect(today.totals.cameIn).toBe(1);
    expect(today.slots.map(slot => new Date(slot.start).getHours())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(today.slots.find(slot => new Date(slot.start).getHours() === 9)?.counts.cameIn).toBe(1);
  });

  it('reaches back thirty days for This month', () => {
    const month = periodActivity({
      period: 'month',
      now: NOW,
      cards: [card('in-range', NOW - 29 * DAY), card('too-old', NOW - 31 * DAY)],
      runStarts: allRunStarts(),
    });

    expect(month.totals.cameIn).toBe(1);
    expect(slotTotals(month).cameIn).toBe(1);
  });

  it('puts anything stamped after now in the slot holding now, where it shows', () => {
    const today = periodActivity({
      period: 'today',
      now: NOW,
      cards: [card('clock-skew', NOW + 2 * HOUR)],
      runStarts: allRunStarts(),
    });

    expect(today.totals.cameIn).toBe(1);
    expect(today.slots.find(slot => slot.counts.cameIn > 0)?.start).toBe(NOW - 30 * 60 * 1000);
  });

  it('keeps every slot of the week on local four-hour boundaries across a daylight-saving change', () => {
    process.env.TZ = 'Europe/Paris';
    const week = periodActivity({
      period: 'week',
      now: Date.parse('2026-10-27T09:00:00Z'),
      cards: [card('a', 0)],
      runStarts: allRunStarts(),
    });

    const starts = week.slots.map(slot => new Date(slot.start));
    expect(starts.every(start => start.getHours() % 4 === 0 && start.getMinutes() === 0)).toBe(true);
    expect(starts.filter(start => start.getHours() === 0)).toHaveLength(7);
    expect(week.slots.slice(1).every((slot, index) => slot.start === week.slots[index]?.end)).toBe(true);
  });

  it('counts everything in the last seven days when the spring daylight-saving change made one of them shorter', () => {
    process.env.TZ = 'Europe/Paris';
    const week = periodActivity({
      period: 'week',
      now: new Date(2026, 2, 30, 0, 30).getTime(),
      cards: [card('late-sunday', new Date(2026, 2, 22, 23, 45).getTime())],
      runStarts: allRunStarts(),
    });

    expect(week.totals.cameIn).toBe(1);
    expect(slotTotals(week)).toEqual(week.totals);
  });

  it('gives every hour of Today its own one-hour slot on both daylight-saving days', () => {
    process.env.TZ = 'Europe/Paris';
    for (const [now, hours] of [
      [new Date(2026, 2, 29, 5, 30).getTime(), [0, 1, 3, 4, 5]],
      [new Date(2026, 9, 25, 5, 30).getTime(), [0, 1, 2, 2, 3, 4, 5]],
    ] as const) {
      const today = periodActivity({ period: 'today', now, cards: [], runStarts: allRunStarts() });

      expect(today.slots.map(slot => new Date(slot.start).getHours())).toEqual(hours);
      expect(today.slots.every(slot => slot.end - slot.start === HOUR)).toBe(true);
    }
  });

  it('vouches for agent runs only in spans that start after the oldest fetched run start', () => {
    const runStarts: RunStarts = { starts: [NOW - HOUR, NOW - 2 * DAY], completeAfter: NOW - 2 * DAY };
    const week = periodActivity({ period: 'week', now: NOW, cards: [], runStarts });
    const today = periodActivity({ period: 'today', now: NOW, cards: [], runStarts });

    expect(week.ranComplete).toBe(false);
    expect(today.ranComplete).toBe(true);
    expect(today.slots.every(slot => slot.ranComplete)).toBe(true);
    const holdingOldest = week.slots.findIndex(slot => slot.end > NOW - 2 * DAY);
    expect(week.slots[holdingOldest]?.ranComplete).toBe(false);
    expect(week.slots.map(slot => slot.ranComplete)).toEqual(week.slots.map((_, index) => index > holdingOldest));
  });
});
