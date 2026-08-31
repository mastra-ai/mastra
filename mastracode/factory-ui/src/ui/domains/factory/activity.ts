/** `stageHistory` ships in full on every card, so the whole stream is a client-side read — no window, no second endpoint. */

import type { BoardKind } from './boardStages';
import { itemBoard } from './boardStages';
import type { MovedItem } from './overview';
import { hasFactoryRun } from './overview';
import type { AuditEvent } from './services/audit';
import type { WorkItem } from './services/workItems';

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
    // their moves are the upstream repo's traffic, not the Factory's.
    if (!hasFactoryRun(item)) continue;

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
}

export type ActivityEntry = ActivityMove | ActivityDeed;

/**
 * The board writes every move into `stageHistory` transactionally; an audit row
 * is a best-effort write only two REST paths make, so it holds a fraction of
 * them. Taking moves from here shows that fraction twice and the rest not at
 * all — `factoryActivity` owns them.
 */
const STAGE_MOVE_ACTION = 'factory.work_item.stage_moved';

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

/** Audit events as rail entries, newest first. */
export function factoryDeeds(events: AuditEvent[], cards: Map<string, ActivityCard>): ActivityDeed[] {
  const deeds: ActivityDeed[] = [];

  for (const event of events) {
    if (event.action === STAGE_MOVE_ACTION) continue;
    const at = Date.parse(event.occurredAt);
    if (Number.isNaN(at)) continue;

    const targetId = event.targets[0]?.id;
    const card = targetId === undefined ? undefined : cards.get(targetId);
    deeds.push({
      kind: 'deed',
      id: event.id,
      action: event.action,
      title: deedTitle(event, card),
      item: targetId !== undefined && card !== undefined ? { id: targetId, board: card.board } : undefined,
      at,
      by: event.actorId,
    });
  }

  return deeds.sort((left, right) => right.at - left.at);
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
  entries: ActivityEntry[];
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
