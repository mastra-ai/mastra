import type { BoardRegistry } from '../boards/index.js';
import { boardForWorkItem, isTerminalWorkItem } from '../boards/index.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import type { ExcludedCards } from './contracts.js';

/** The activity panel's longest period is a month; closed cards older than this are only counted. */
const RECENT_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;

function githubNumber(item: Pick<WorkItemRow, 'externalSource' | 'metadata'>): number | undefined {
  const source = item.externalSource;
  if (source?.integrationId !== 'github' || (source.type !== 'issue' && source.type !== 'pull-request')) return;
  const metadataKey = source.type === 'issue' ? 'githubIssueNumber' : 'githubPullRequestNumber';
  const itemNumber = item.metadata?.[metadataKey] ?? item.metadata?.number;
  if (typeof itemNumber !== 'number' || !Number.isInteger(itemNumber) || itemNumber <= 0) return;
  return itemNumber;
}

/**
 * Every key a candidate in the Intake feed could carry for this card. Mirrors
 * the client's `persistedSourceKeys`, so a card the board never receives still
 * keeps its issue out of Intake.
 */
export function cardSourceKeys(item: Pick<WorkItemRow, 'externalSource' | 'metadata'>): string[] {
  const keys = new Set<string>();
  const source = item.externalSource;
  if (!source) return [];
  if (source.externalId) keys.add(source.externalId);
  const itemNumber = githubNumber(item);
  if (itemNumber !== undefined) {
    const repositoryId = item.metadata?.githubRepositoryId;
    if (typeof repositoryId === 'number') keys.add(`github:${repositoryId}:${source.type}:${itemNumber}`);
    else keys.add(source.type === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`);
    // The URL names the repository, covering cards filed before they were stamped with one.
    if (source.url) keys.add(source.url);
  }
  return [...keys];
}

/** When the card entered the terminal stage it rests in; falls back to its last write. */
export function closedAt(item: Pick<WorkItemRow, 'stages' | 'stageHistory' | 'updatedAt'>): Date {
  const stage = item.stages[0];
  const entry = stage === undefined ? undefined : item.stageHistory.findLast(candidate => candidate.stage === stage);
  const enteredAt = entry ? new Date(entry.enteredAt) : undefined;
  return enteredAt && !Number.isNaN(enteredAt.getTime()) ? enteredAt : item.updatedAt;
}

export interface BoardSnapshotPartition {
  open: WorkItemRow[];
  excluded: ExcludedCards[];
}

/**
 * Split a project's cards into the ones the board loads by default and a
 * compact summary of the ones resting in a terminal phase.
 */
export function partitionBoardCards(
  boards: BoardRegistry,
  items: readonly WorkItemRow[],
  now: Date = new Date(),
): BoardSnapshotPartition {
  const open: WorkItemRow[] = [];
  const groups = new Map<string, ExcludedCards>();
  const recentAfter = now.getTime() - RECENT_WINDOW_MS;
  for (const item of items) {
    if (!isTerminalWorkItem(boards, item)) {
      open.push(item);
      continue;
    }
    const board = boardForWorkItem(item);
    const stage = item.stages[0]!;
    const key = `${board}\u0000${stage}`;
    let group = groups.get(key);
    if (!group) {
      group = { board, stage, count: 0, sourceKeys: [], recent: [] };
      groups.set(key, group);
    }
    group.count += 1;
    group.sourceKeys.push(...cardSourceKeys(item));
    const closed = closedAt(item);
    if (closed.getTime() >= recentAfter || item.createdAt.getTime() >= recentAfter) {
      group.recent.push({ createdAt: item.createdAt.toISOString(), closedAt: closed.toISOString() });
    }
  }
  return { open, excluded: [...groups.values()] };
}

export interface TerminalPageInput {
  board: string;
  stage: string;
  offset: number;
  limit: number;
}

export interface TerminalPage {
  workItems: WorkItemRow[];
  total: number;
  hasMore: boolean;
}

/** One page of the cards resting in a board's terminal phase, most recently closed first. */
export function terminalCardPage(
  boards: BoardRegistry,
  items: readonly WorkItemRow[],
  { board, stage, offset, limit }: TerminalPageInput,
): TerminalPage {
  const matching = items
    .filter(item => isTerminalWorkItem(boards, item) && boardForWorkItem(item) === board && item.stages.includes(stage))
    .map(item => ({ item, closed: closedAt(item).getTime() }))
    .sort((a, b) => b.closed - a.closed || a.item.id.localeCompare(b.item.id))
    .map(({ item }) => item);
  return {
    workItems: matching.slice(offset, offset + limit),
    total: matching.length,
    hasMore: offset + limit < matching.length,
  };
}

/** The cards whose sessions include the thread, whatever phase they rest in. */
export function cardsForThread(items: readonly WorkItemRow[], threadId: string): WorkItemRow[] {
  return items.filter(item => Object.values(item.sessions).some(ref => ref.threadId === threadId));
}
