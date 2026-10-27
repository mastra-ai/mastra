import type { LucideIcon } from 'lucide-react';
import { Bot, Inbox, PackageCheck } from 'lucide-react';

import type { RunsState } from '../../hooks/useFactoryActivity';
import { ACTIVITY_KIND_ORDER } from '../../periodActivity';
import type { ActivityCounts, ActivityKind, ActivitySlot } from '../../periodActivity';

interface ActivityKindLook {
  label: string;
  icon: LucideIcon;
  tone: string;
}

const LOOKS: Record<ActivityKind, ActivityKindLook> = {
  shipped: { label: 'Shipped', icon: PackageCheck, tone: 'opacity-70' },
  ran: { label: 'Agents ran', icon: Bot, tone: 'opacity-40' },
  cameIn: { label: 'Came in', icon: Inbox, tone: 'opacity-20' },
};

export const ACTIVITY_KINDS = ACTIVITY_KIND_ORDER.map(kind => ({ kind, ...LOOKS[kind] }));

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });

export function slotWhen(slot: ActivitySlot, hoursPerSlot: number) {
  const day = dayFormat.format(slot.start);
  if (hoursPerSlot >= 24) return { day };
  return { day, hours: `${hourFormat.format(slot.start)} – ${hourFormat.format(slot.end)}` };
}

export function totalOf(kind: ActivityKind, counts: ActivityCounts, runs: RunsState): string {
  if (kind !== 'ran') return counts[kind].toLocaleString();
  if (runs.status === 'error') return 'unavailable';
  if (runs.status === 'pending') return '…';
  return `${counts.ran.toLocaleString()}${runs.complete ? '' : '+'}`;
}

export function countsLabel(counts: ActivityCounts, runs: RunsState): string {
  return ACTIVITY_KINDS.map(({ kind, label }) => {
    const value = kind === 'ran' && runs.status === 'pending' ? 'loading' : totalOf(kind, counts, runs);
    return `${label}: ${value}`;
  }).join(', ');
}
