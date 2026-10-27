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

export function totalOf(kind: ActivityKind, counts: ActivityCounts, runs: RunsState) {
  const { counted } = LOOKS[kind];
  const value = counts[kind];
  if (kind === 'ran' && runs.status === 'pending') {
    return { count: '…', noun: counted.other, label: `${counted.other} loading` };
  }
  const known = kind !== 'ran' || (runs.status === 'success' && (runs.complete || value > 0));
  if (!known) return { count: '–', noun: counted.other, label: `${counted.other} unavailable` };
  const atLeast = kind === 'ran' && !runs.complete;
  const count = `${value.toLocaleString()}${atLeast ? '+' : ''}`;
  const noun = plural.select(value) === 'one' && !atLeast ? counted.one : counted.other;
  return { count, noun, label: `${count} ${noun}` };
}

export function countsLabel(counts: ActivityCounts, runs: RunsState): string {
  return ACTIVITY_KIND_ORDER.map(kind => totalOf(kind, counts, runs).label).join(', ');
}
