import { isHumanActorId } from '@mastra/factory/storage/domains/audit/actors';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { differenceInCalendarDays } from 'date-fns';

import type { AuditEvent } from '../../factory/services/audit';
import { stageMoves, stageStays } from '../../factory/stageStays';
import type { WorkItem } from '../../factory/services/workItems';

export interface RunInterval {
  startedAt: number;
  endedAt: number;
}

export interface OwnerChange {
  at: number;
  fromOwnerId: string;
  toOwnerId: string;
}

/** Placement on the track in percent of its width, clipped to the session; `from` and `to` are the span's own moments. */
export interface TrackSpan {
  left: number;
  width: number;
  from: number;
  to: number;
}

export interface TrackStage extends TrackSpan {
  stage: string;
}

/** A person stepping in: moving the item to `stage`, or taking the session over when `stage` is absent. */
export interface TrackPin {
  left: number;
  at: number;
  personId: string;
  stage?: string;
}

export interface TrackLayout {
  stages: TrackStage[];
  runs: TrackSpan[];
  pins: TrackPin[];
}

/** Ended runs recorded before the run end carried its kickoff time have no span to draw. */
export function auditRunIntervals(events: readonly AuditEvent[]): RunInterval[] {
  return events.flatMap(event => {
    const startedAt = event.metadata.startedAt;
    if (event.action !== 'factory.run.ended' || typeof startedAt !== 'number') return [];
    return [{ startedAt, endedAt: Date.parse(event.occurredAt) }];
  });
}

/** Ownership audit targets carry the session row id, not its `sessionId`. */
export function auditOwnerChanges(events: readonly AuditEvent[], sessionRowId: string): OwnerChange[] {
  return events
    .flatMap(event => {
      const { fromOwnerId, toOwnerId } = event.metadata;
      const transfersThisSession =
        event.action === 'factory.session.owner_transferred' &&
        event.targets.some(target => target.type === 'session' && target.id === sessionRowId);
      if (!transfersThisSession || typeof fromOwnerId !== 'string' || typeof toOwnerId !== 'string') return [];
      return [{ at: Date.parse(event.occurredAt), fromOwnerId, toOwnerId }];
    })
    .toSorted((a, b) => a.at - b.at);
}

export function layoutSessionTrack({
  startedAt,
  now,
  card,
  runs,
  ownerChanges,
}: {
  startedAt: number;
  now: number;
  card: Pick<WorkItem, 'stageHistory' | 'createdAt'> | undefined;
  runs: readonly RunInterval[];
  ownerChanges: readonly OwnerChange[];
}): TrackLayout {
  const stays = stageStays(card?.stageHistory ?? [], now);
  const end = Math.max(now, ...stays.map(stay => stay.to));
  const duration = Math.max(end - startedAt, 1);
  const percentAt = (time: number) => ((time - startedAt) / duration) * 100;
  const spanBetween = (from: number, to: number): TrackSpan | undefined => {
    if (to <= startedAt || from > end) return undefined;
    const left = percentAt(Math.max(from, startedAt));
    return { left, width: percentAt(Math.min(to, end)) - left, from, to };
  };
  const withinTrack = (time: number) => time >= startedAt && time <= end;

  const stages = stays.flatMap(({ entry, from, to }) => {
    const span = spanBetween(from, to);
    return span ? [{ ...span, stage: entry.stage }] : [];
  });

  const moves = (card ? stageMoves(card) : []).flatMap(entry => {
    const at = Date.parse(entry.enteredAt);
    if (!isHumanActorId(entry.by) || !withinTrack(at)) return [];
    return [{ left: percentAt(at), at, personId: entry.by, stage: entry.stage }];
  });
  const takeovers = ownerChanges.flatMap(change =>
    withinTrack(change.at) ? [{ left: percentAt(change.at), at: change.at, personId: change.toOwnerId }] : [],
  );

  return {
    stages,
    runs: runs.flatMap(run => spanBetween(run.startedAt, run.endedAt) ?? []),
    pins: [...moves, ...takeovers].toSorted((a, b) => a.at - b.at),
  };
}

const weekday = (time: number) => new Date(time).toLocaleDateString(undefined, { weekday: 'short' });

/** Clock time today, weekday this week, calendar date beyond. */
export function trackStartLabel(startedAt: number, now: number): string {
  const days = differenceInCalendarDays(now, startedAt);
  if (days === 0) return formatDate(startedAt, 'time') ?? '';
  if (days < 7) return weekday(startedAt);
  return new Date(startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Same buckets as the start, with the clock: a hovered span or pin names its exact moments. */
export function trackMomentLabel(time: number, now: number): string {
  const days = differenceInCalendarDays(now, time);
  if (days === 0) return formatDate(time, 'time') ?? '';
  if (days < 7) return `${weekday(time)} ${formatDate(time, 'time')}`;
  return formatDate(time, 'day-time') ?? '';
}
