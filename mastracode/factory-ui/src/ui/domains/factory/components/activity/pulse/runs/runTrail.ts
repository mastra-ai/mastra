import type { AuditAction } from '@mastra/factory/storage/domains/audit/actions';
import type { InfiniteData } from '@tanstack/react-query';

import { eventTime } from '../../../../activity';
import type { AuditEvent, AuditEventPage } from '../../../../services/audit';
import { metadataString } from '../../../../workItemActivity';

export interface RunEvent {
  id: string;
  side: 'start' | 'end';
  kickoffId: string;
  role: string;
  sessionId: string | undefined;
  workItemId: string | undefined;
  targetName: string | undefined;
  atMs: number;
  reason: string | undefined;
}

export interface RunPage {
  runEvents: RunEvent[];
  newestMs: number | undefined;
  oldestMs: number | undefined;
  nextCursor: string | undefined;
}

export type RunPages = InfiniteData<RunPage>;

export interface RunTrail {
  events: RunEvent[];
  historyComplete: boolean;
}

const RUN_EVENT_SIDES: Partial<Record<string, RunEvent['side']>> = {
  ['factory.run.started' satisfies AuditAction]: 'start',
  ['factory.run.ended' satisfies AuditAction]: 'end',
};

function runEvent(event: AuditEvent): RunEvent | undefined {
  const side = RUN_EVENT_SIDES[event.action];
  const kickoffId = metadataString(event.metadata, 'kickoffId');
  const role = metadataString(event.metadata, 'role');
  const atMs = eventTime(event);
  if (side === undefined || kickoffId === undefined || role === undefined || atMs === undefined) return undefined;

  const card = event.targets.find(target => target.type === 'work_item');
  return {
    id: event.id,
    side,
    kickoffId,
    role,
    sessionId: metadataString(event.metadata, 'sessionId'),
    workItemId: card?.id,
    targetName: card?.name,
    atMs,
    reason: metadataString(event.metadata, 'reason'),
  };
}

export function runEvents(events: AuditEvent[]): RunEvent[] {
  return events.flatMap(event => runEvent(event) ?? []);
}

export function runPage(page: AuditEventPage): RunPage {
  const newest = page.events.at(0);
  const oldest = page.events.at(-1);
  return {
    runEvents: runEvents(page.events),
    newestMs: newest && eventTime(newest),
    oldestMs: oldest && eventTime(oldest),
    nextCursor: page.nextCursor,
  };
}

export function foldHeadPage(pages: RunPages | undefined, head: RunPage): RunPages {
  const top = pages?.pages[0];
  if (pages === undefined || top === undefined) return { pages: [head], pageParams: [undefined] };

  const headIds = new Set(head.runEvents.map(event => event.id));
  const olderThanHead = top.runEvents.filter(event => !headIds.has(event.id));
  const headAddsNothing = olderThanHead.length + headIds.size === top.runEvents.length;
  if (headAddsNothing) return pages;

  const headReachesTop = head.oldestMs !== undefined && top.newestMs !== undefined && head.oldestMs <= top.newestMs;
  if (!headReachesTop) return { pages: [head], pageParams: [undefined] };

  const foldedTop: RunPage = {
    runEvents: [...head.runEvents, ...olderThanHead],
    newestMs: head.newestMs,
    oldestMs: top.oldestMs,
    nextCursor: top.nextCursor,
  };
  return { pages: [foldedTop, ...pages.pages.slice(1)], pageParams: pages.pageParams };
}

export function runTrail(pages: RunPage[]): RunTrail {
  return {
    events: pages.flatMap(page => page.runEvents),
    historyComplete: pages.at(-1)?.nextCursor === undefined,
  };
}
