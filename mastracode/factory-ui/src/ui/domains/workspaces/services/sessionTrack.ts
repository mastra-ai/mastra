import { isHumanActorId } from '@mastra/factory/storage/domains/audit/actors';
import { differenceInCalendarDays, format } from 'date-fns';

import type { AuditEvent } from '../../factory/services/audit';
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

/** Horizontal placement on the track, in percent of its width, and the moments it covers once clipped to the track. */
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
  stageHistory,
  runs,
  ownerChanges,
}: {
  startedAt: number;
  now: number;
  stageHistory: WorkItem['stageHistory'];
  runs: readonly RunInterval[];
  ownerChanges: readonly OwnerChange[];
}): TrackLayout {
  const duration = Math.max(now - startedAt, 1);
  const percentAt = (time: number) => ((time - startedAt) / duration) * 100;
  const spanBetween = (from: number, to: number): TrackSpan | undefined => {
    const clippedFrom = Math.max(from, startedAt);
    const clippedTo = Math.min(to, now);
    if (clippedTo <= clippedFrom) return undefined;
    return {
      left: percentAt(clippedFrom),
      width: percentAt(clippedTo) - percentAt(clippedFrom),
      from: clippedFrom,
      to: clippedTo,
    };
  };
  const withinTrack = (time: number) => time >= startedAt && time <= now;

  const history = stageHistory.toSorted((a, b) => Date.parse(a.enteredAt) - Date.parse(b.enteredAt));
  const stages = history.flatMap((entry, index) => {
    const nextEnteredAt = history[index + 1] ? Date.parse(history[index + 1].enteredAt) : now;
    const exitedAt = entry.exitedAt ? Date.parse(entry.exitedAt) : now;
    const span = spanBetween(Date.parse(entry.enteredAt), Math.min(exitedAt, nextEnteredAt));
    return span ? [{ ...span, stage: entry.stage }] : [];
  });

  const [, ...movesAfterArrival] = history;
  const moves = movesAfterArrival.flatMap(entry => {
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

const START_FORMATS = { today: 'HH:mm', thisWeek: 'EEE', older: 'MMM d' };
const MOMENT_FORMATS = { today: 'HH:mm', thisWeek: 'EEE HH:mm', older: 'MMM d, HH:mm' };

function trackTimeLabel(time: number, now: number, formats: typeof START_FORMATS): string {
  const days = differenceInCalendarDays(now, time);
  if (days === 0) return format(time, formats.today);
  if (days < 7) return format(time, formats.thisWeek);
  return format(time, formats.older);
}

/** Clock time today, weekday this week, calendar date beyond. */
export function trackStartLabel(startedAt: number, now: number): string {
  return trackTimeLabel(startedAt, now, START_FORMATS);
}

/** Same buckets as the start, with the clock: a hovered span or pin names its exact moments. */
export function trackMomentLabel(time: number, now: number): string {
  return trackTimeLabel(time, now, MOMENT_FORMATS);
}
