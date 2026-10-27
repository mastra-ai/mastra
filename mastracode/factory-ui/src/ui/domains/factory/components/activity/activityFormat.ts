import type { LucideIcon } from 'lucide-react';
import { Bot, Inbox, PackageCheck } from 'lucide-react';

import type { RunsState } from '../../hooks/useFactoryActivity';
import { ACTIVITY_KIND_ORDER } from '../../periodActivity';
import type { ActivityCounts, ActivityKind, ActivitySlot } from '../../periodActivity';

interface ActivityKindLook {
  label: string;
  counted: { one: string; other: string };
  icon: LucideIcon;
  tone: string;
}

const LOOKS: Record<ActivityKind, ActivityKindLook> = {
  cameIn: { label: 'Came in', counted: { one: 'came in', other: 'came in' }, icon: Inbox, tone: 'opacity-20' },
  ran: { label: 'Agent runs', counted: { one: 'agent run', other: 'agent runs' }, icon: Bot, tone: 'opacity-40' },
  shipped: { label: 'Shipped', counted: { one: 'shipped', other: 'shipped' }, icon: PackageCheck, tone: 'opacity-70' },
};

export const ACTIVITY_KINDS = ACTIVITY_KIND_ORDER.map(kind => ({ kind, ...LOOKS[kind] }));

const plural = new Intl.PluralRules('en');
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });

export function slotWhen(slot: ActivitySlot, hoursPerSlot: number) {
  const day = dayFormat.format(slot.start);
  if (hoursPerSlot >= 24) return { day };
  return { day, hours: `${hourFormat.format(slot.start)} – ${hourFormat.format(slot.end)}` };
}

export function totalOf(kind: ActivityKind, counts: ActivityCounts, runs: RunsState): { count: string; noun: string } {
  const { counted } = LOOKS[kind];
  if (kind === 'ran' && runs.status !== 'success') {
    return { count: runs.status === 'error' ? '–' : '…', noun: counted.other };
  }
  const more = kind === 'ran' && !runs.complete ? '+' : '';
  return {
    count: `${counts[kind].toLocaleString()}${more}`,
    noun: plural.select(counts[kind]) === 'one' && !more ? counted.one : counted.other,
  };
}

export function countsLabel(counts: ActivityCounts, runs: RunsState): string {
  return ACTIVITY_KIND_ORDER.map(kind => {
    const { count, noun } = totalOf(kind, counts, runs);
    if (kind !== 'ran' || runs.status === 'success') return `${count} ${noun}`;
    return `${noun} ${runs.status === 'pending' ? 'loading' : 'unavailable'}`;
  }).join(', ');
}
