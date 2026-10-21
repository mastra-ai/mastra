/** `stageHistory` ships in full on every card, so the whole stream is a client-side read — no window, no second endpoint. */

import type { AuditAction } from '@mastra/factory/storage/domains/audit/actions';

import { auditDetailLine, auditVisibleMetadata } from './auditPresentation';

import type { BoardKind } from './boardStages';
import { itemBoard } from './boardStages';
import type { AuditEvent } from './services/audit';
import type { WorkItem } from './services/workItems';
import { metadataString } from './workItemActivity';

export function boardItemPath(factoryProjectId: string | undefined, item: { board: string; id: string }): string {
  return `/factories/${factoryProjectId ?? ''}/${item.board}?item=${encodeURIComponent(item.id)}`;
}

export function workItemPath(factoryProjectId: string, item: WorkItem): string {
  return boardItemPath(factoryProjectId, { id: item.id, board: itemBoard(item) });
}

/** `?events=all` lists every recorded event; the old audit log URL lands there. */
export const EVERY_EVENT_PARAM = { key: 'events', value: 'all' } as const;

export function everyEventPath(factoryProjectId: string | undefined): string {
  return `/factories/${factoryProjectId ?? ''}/activity?${EVERY_EVENT_PARAM.key}=${EVERY_EVENT_PARAM.value}`;
}

/** One stage change, with the raw actor so the UI can name a rule a rule and an agent an agent. */
export interface MovedItem {
  id: string;
  title: string;
  board: BoardKind;
  stage: string;
  at: number;
  by: string | undefined;
}

export function startOfLocalDay(ms: number): number {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** A day is 23 or 25 hours long when the clocks change, so step the calendar rather than the clock. */
function previousLocalDay(dayMs: number): number {
  const day = new Date(dayMs);
  day.setDate(day.getDate() - 1);
  return day.getTime();
}

/** Every stage change the Factory made, newest first. */
export function factoryActivity(items: WorkItem[]): MovedItem[] {
  const moves: MovedItem[] = [];

  for (const item of items) {
    // Integrations sync every issue and PR of a connected repo onto the board;
    // their moves are the upstream repo's traffic, not the Factory's. A card the
    // Factory ran carries the session it started.
    if (Object.keys(item.sessions).length === 0) continue;

    for (const entry of item.stageHistory) {
      const at = Date.parse(entry.enteredAt);
      if (Number.isNaN(at)) continue;
      moves.push({ id: item.id, title: item.title, board: itemBoard(item), stage: entry.stage, at, by: entry.by });
    }
  }

  return moves.sort((left, right) => right.at - left.at);
}

/** Consecutive runs of the same local day, in the order the moves arrive. */
export function groupByDay<T extends { at: number }>(events: T[]): Array<{ dayMs: number; items: T[] }> {
  const days: Array<{ dayMs: number; items: T[] }> = [];

  for (const event of events) {
    const dayMs = startOfLocalDay(event.at);
    const open = days.at(-1);
    if (open?.dayMs === dayMs) open.items.push(event);
    else days.push({ dayMs, items: [event] });
  }

  return days;
}

/** An agent's actor id carries the binding of that one run, so two agent moves never match on it — yet they are one hand. */
export function actorKey(by: string | undefined): string {
  return by?.startsWith('agent:') ? 'agent' : (by ?? 'unknown');
}

/** One card carried through a chain of stages, oldest step first. */
export interface ActivityMove {
  kind: 'move';
  id: string;
  title: string;
  board: BoardKind;
  /** The newest move of the chain — where the entry sits in the stream. */
  at: number;
  by: string | undefined;
  stages: string[];
  metadata: Record<string, unknown>;
}

/** Everything else the Factory recorded: a run started, a commit, a comment. */
export interface ActivityDeed {
  kind: 'deed';
  id: string;
  action: string;
  title: string;
  /** The card to open, when the event names one the board still holds. */
  item: { id: string; board: BoardKind } | undefined;
  at: number;
  by: string;
  detail: string;
  metadata: Record<string, unknown>;
}

export type ActivityEntry = ActivityMove | ActivityDeed;

export function entryRunId(entry: ActivityEntry): string | undefined {
  return metadataString(entry.metadata, 'kickoffId');
}

/** `factoryActivity` owns moves from `stageHistory`; the audit copy would show each one twice. */
const STAGE_MOVE_ACTION = 'factory.work_item.stage_moved' satisfies AuditAction;

/** A card the board still holds, as the audit trail's bare target ids need it. */
export interface ActivityCard {
  title: string;
  board: BoardKind;
}

/** `run.started` names its card by id alone and the git actions name no target, so the board and the branch fill the gaps. */
function deedTitle(event: AuditEvent, card: ActivityCard | undefined): string {
  const branch = event.metadata.branch;
  return event.targets[0]?.name ?? card?.title ?? (typeof branch === 'string' ? branch : '');
}

function auditDeed(event: AuditEvent, at: number, cards: Map<string, ActivityCard>): ActivityDeed {
  const targetId = event.targets[0]?.id;
  const card = targetId === undefined ? undefined : cards.get(targetId);
  return {
    kind: 'deed',
    id: event.id,
    action: event.action,
    title: deedTitle(event, card),
    item: targetId !== undefined && card !== undefined ? { id: targetId, board: card.board } : undefined,
    at,
    by: event.actorId,
    detail: auditDetailLine(event),
    metadata: auditVisibleMetadata(event),
  };
}

/** A move the board still places reads like the summary's moves; a deleted card's move stays a plain deed. */
function auditMove(event: AuditEvent, at: number, cards: Map<string, ActivityCard>): ActivityMove | undefined {
  const target = event.targets[0];
  const card = target === undefined ? undefined : cards.get(target.id);
  const stage = event.metadata.to;
  if (target === undefined || card === undefined || typeof stage !== 'string') return undefined;
  return {
    kind: 'move',
    id: target.id,
    title: target.name ?? card.title,
    board: card.board,
    at,
    by: event.actorId,
    stages: [stage],
    metadata: auditVisibleMetadata(event),
  };
}

export function eventTime(event: AuditEvent): number | undefined {
  const at = Date.parse(event.occurredAt);
  return Number.isNaN(at) ? undefined : at;
}

/** Audit events as rail entries, newest first, stage moves left to the board. */
export function factoryDeeds(events: AuditEvent[], cards: Map<string, ActivityCard>): ActivityDeed[] {
  const deeds: ActivityDeed[] = [];
  for (const event of events) {
    const at = eventTime(event);
    if (event.action === STAGE_MOVE_ACTION || at === undefined) continue;
    deeds.push(auditDeed(event, at, cards));
  }
  return deeds.sort((left, right) => right.at - left.at);
}

/** Every audit event as one rail entry, newest first: the summary's stream with nothing folded or left out. */
export function auditEntries(events: AuditEvent[], cards: Map<string, ActivityCard>): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const event of events) {
    const at = eventTime(event);
    if (at === undefined) continue;
    const move = event.action === STAGE_MOVE_ACTION ? auditMove(event, at, cards) : undefined;
    entries.push(move ?? auditDeed(event, at, cards));
  }
  return entries.sort((left, right) => right.at - left.at);
}

export type ActivityGrouping = 'similar' | 'none';

export function activityCards(items: WorkItem[]): Map<string, ActivityCard> {
  return new Map(items.map(item => [item.id, { title: item.title, board: itemBoard(item) }]));
}

/** Stage moves from the board, everything else from the trail. */
export function boardAndTrailEntries(
  items: WorkItem[],
  events: AuditEvent[],
  showsBoardMoves: boolean,
): ActivityEntry[] {
  const moves = showsBoardMoves ? collapseRuns(factoryActivity(items)) : [];
  return [...moves, ...factoryDeeds(events, activityCards(items))];
}

function trailCursor(events: AuditEvent[], trailHasMore: boolean): number {
  if (!trailHasMore) return Number.NEGATIVE_INFINITY;
  const loadedTimes = events.flatMap(event => eventTime(event) ?? []);
  if (loadedTimes.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...loadedTimes);
}

/** Board moves span all time, so they wait at the trail's cursor until the deeds beside them have loaded. */
export function newestFirstUpToTrailCursor(
  entries: ActivityEntry[],
  events: AuditEvent[],
  trailHasMore: boolean,
): ActivityEntry[] {
  const cursorAt = trailCursor(events, trailHasMore);
  return entries.filter(entry => entry.at >= cursorAt).toSorted((left, right) => right.at - left.at);
}

export function entryTarget(entry: ActivityEntry): { id: string; board: string } | undefined {
  return entry.kind === 'move' ? { id: entry.id, board: entry.board } : entry.item;
}

/** The pinned section already lists what needs action; the feed points at each such card once, on its latest line. */
export function newestEntryPerCard(entries: ActivityEntry[], cardIds: ReadonlySet<string>): ReadonlySet<ActivityEntry> {
  const seen = new Set<string>();
  const flagged = new Set<ActivityEntry>();
  for (const entry of entries) {
    const cardId = entryTarget(entry)?.id;
    if (cardId === undefined || !cardIds.has(cardId) || seen.has(cardId)) continue;
    seen.add(cardId);
    flagged.add(entry);
  }
  return flagged;
}

/** Only neighbours collapse, and only under one actor, so the stream keeps its order and a change of hands stays visible. */
export function collapseRuns(moves: MovedItem[]): ActivityMove[] {
  const runs: ActivityMove[] = [];

  for (const move of moves) {
    const open = runs.at(-1);
    if (
      open?.id === move.id &&
      actorKey(open.by) === actorKey(move.by) &&
      startOfLocalDay(open.at) === startOfLocalDay(move.at)
    )
      open.stages.unshift(move.stage);
    else
      runs.push({
        kind: 'move',
        id: move.id,
        title: move.title,
        board: move.board,
        at: move.at,
        by: move.by,
        stages: [move.stage],
        metadata: {},
      });
  }

  return runs;
}

/** What the rail says once per block: who, and what they did. */
function blockKey(entry: ActivityEntry): string {
  return entry.kind === 'move'
    ? `move:${actorKey(entry.by)}:${entry.stages.join()}`
    : `deed:${actorKey(entry.by)}:${entry.action}`;
}

/** One actor doing one thing, and every card it happened to. */
export interface ActivityBlock {
  key: string;
  entries: [ActivityEntry, ...ActivityEntry[]];
}

/** Neighbours saying the same thing about a different card share one label: three cards landing in Review is one unit. */
export function activityBlocks(entries: ActivityEntry[]): ActivityBlock[] {
  const blocks: ActivityBlock[] = [];

  for (const entry of entries) {
    const key = blockKey(entry);
    const open = blocks.at(-1);
    if (open?.key === key) open.entries.push(entry);
    else blocks.push({ key, entries: [entry] });
  }

  return blocks;
}

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function clockTime(at: number): string {
  return clock.format(at);
}

/** Today and yesterday get their names; older days get their date. */
export function dayHeading(dayMs: number, nowMs: number): string {
  const today = startOfLocalDay(nowMs);
  if (dayMs === today) return 'Today';
  if (dayMs === previousLocalDay(today)) return 'Yesterday';
  return new Date(dayMs).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
