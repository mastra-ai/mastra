import { sessionRowStatus } from '../workspaces/services/sessionStatus';
import { doneAt } from './boardItems';
import type { WorkItem } from './services/workItems';

export type ActivityPeriod = 'today' | 'week' | 'month';
export type ActivityKind = 'cameIn' | 'ran' | 'shipped';
export type ActivityCounts = Record<ActivityKind, number>;

export const ACTIVITY_KIND_ORDER: readonly ActivityKind[] = ['cameIn', 'ran', 'shipped'];

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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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

function localHour(day: Date, daysLater: number, hour: number): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + daysLater, hour).getTime();
}

function activitySlots(period: ActivityPeriod, now: number): ActivitySlot[] {
  const from = activityStart(period, now);
  const slots: ActivitySlot[] = [];
  if (period === 'today') {
    for (let start = from; start <= now; start += HOUR_MS) {
      slots.push({ start, end: start + HOUR_MS, counts: noCounts() });
    }
    return slots;
  }
  const hoursPerSlot = HOURS_PER_SLOT[period];
  const firstDay = new Date(from);
  for (let day = 0; ; day += 1) {
    for (let hour = 0; hour < 24; hour += hoursPerSlot) {
      const start = localHour(firstDay, day, hour);
      if (start > now) return slots;
      const end = localHour(firstDay, day, hour + hoursPerSlot);
      if (end > from) slots.push({ start, end, counts: noCounts() });
    }
  }
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
