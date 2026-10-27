import { sessionRowStatus } from '../workspaces/services/sessionStatus';
import { doneAt } from './boardItems';
import type { WorkItem } from './services/workItems';

export type ActivityPeriod = 'today' | 'week' | 'month';
export type ActivityKind = 'cameIn' | 'ran' | 'shipped';
export type ActivityCounts = Record<ActivityKind, number>;

export const ACTIVITY_KIND_ORDER: readonly ActivityKind[] = ['shipped', 'ran', 'cameIn'];

export const ACTIVITY_PERIOD_LABELS: Record<ActivityPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

export interface ActivitySlot {
  start: number;
  end: number;
  counts: ActivityCounts;
}

export interface Activity {
  hoursPerSlot: number;
  slots: ActivitySlot[];
  totals: ActivityCounts;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_DAYS = { week: 7, month: 30 } as const;

const HOURS_PER_SLOT: Record<ActivityPeriod, number> = { today: 1, week: 4, month: 24 };

function noCounts(): ActivityCounts {
  return { cameIn: 0, ran: 0, shipped: 0 };
}

export function activityStart(period: ActivityPeriod, now: number): number {
  if (period !== 'today') return now - PERIOD_DAYS[period] * DAY_MS;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

function activitySlots(period: ActivityPeriod, now: number): ActivitySlot[] {
  const hoursPerSlot = HOURS_PER_SLOT[period];
  const days = period === 'today' ? 1 : PERIOD_DAYS[period] + 1;
  const today = new Date(now);
  const from = activityStart(period, now);
  const slotsPerDay = 24 / hoursPerSlot;
  return Array.from({ length: days * slotsPerDay }, (_, index) => {
    const daysBack = days - 1 - Math.floor(index / slotsPerDay);
    const hour = (index % slotsPerDay) * hoursPerSlot;
    const at = (atHour: number) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack, atHour).getTime();
    return { start: at(hour), end: at(hour + hoursPerSlot), counts: noCounts() };
  }).filter(slot => slot.end > from && slot.start <= now);
}

export function periodActivity({
  period,
  now,
  cards,
  runStarts,
}: {
  period: ActivityPeriod;
  now: number;
  cards: readonly WorkItem[];
  runStarts: readonly number[];
}): Activity {
  const from = activityStart(period, now);
  const slots = activitySlots(period, now);
  const totals = noCounts();
  const times: Record<ActivityKind, ReadonlyArray<number | undefined>> = {
    cameIn: cards.map(card => Date.parse(card.createdAt)),
    ran: runStarts,
    shipped: cards.map(doneAt),
  };
  for (const kind of ACTIVITY_KIND_ORDER) {
    for (const time of times[kind]) {
      if (time === undefined || time < from) continue;
      const slot = slots.findLast(candidate => candidate.start <= Math.min(time, now));
      if (!slot) continue;
      slot.counts[kind] += 1;
      totals[kind] += 1;
    }
  }
  return { hoursPerSlot: HOURS_PER_SLOT[period], slots, totals };
}

export function liveSessionCounts(
  cards: readonly WorkItem[],
  running: ReadonlySet<string>,
  parked: ReadonlySet<string>,
): { working: number; waiting: number } {
  const counts = { working: 0, waiting: 0 };
  for (const card of cards) {
    const sessionIds = Object.values(card.sessions).map(ref => ref.sessionId);
    const status = sessionRowStatus({
      running: sessionIds.some(id => running.has(id)),
      initializing: false,
      attention: sessionIds.some(id => parked.has(id)),
    });
    if (status === 'working') counts.working += 1;
    if (status === 'ready') counts.waiting += 1;
  }
  return counts;
}
