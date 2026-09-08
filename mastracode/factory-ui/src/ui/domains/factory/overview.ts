/**
 * Overview's figures, derived from the board snapshot the page already polls —
 * one source for the board and the numbers, no second round trip. Windowed
 * figures count events inside the window, never current board state, so
 * re-asking for a past window is stable.
 */

import type { BoardKind } from './boardStages';
import { itemBoard } from './boardStages';
import type { WorkItem, WorkItemStageEntry } from './services/workItems';
import { BOARD_STAGES, boardStage, isTerminalStage, stageOrder } from './stages';

const INTAKE_STAGE = 'intake';
const DONE_STAGE = 'done';

const CANCELED_STAGE = 'canceled';

/** The columns work flows through — `canceled` is where it leaves, not a step. */
const FUNNEL_STAGES = BOARD_STAGES.filter(stage => stage.id !== CANCELED_STAGE);

/**
 * Wider than the server's `isAgentActor`, which reads `factory-*` as human
 * because the poller stamps it on every synced upstream card. `hasFactoryRun`
 * drops those first, so what is left is the rules engine moving the Factory's
 * own work. A missing `exitedBy` predates exit stamping and reads as a person.
 */
function isUnattended(by: string | undefined): boolean {
  if (by === undefined) return false;
  return by.startsWith('agent:') || by.startsWith('factory-');
}

/** Cards the Factory ran: starting a run records its session on the row. */
export function hasFactoryRun(item: WorkItem): boolean {
  return Object.keys(item.sessions).length > 0;
}

function isPipelineStage(stage: string): boolean {
  return stage !== INTAKE_STAGE && !isTerminalStage(stage);
}

function parseTime(iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : time;
}

/** Inclusive-start, exclusive-end epoch bounds for the windowed figures. */
export interface OverviewWindow {
  fromMs: number;
  toMs: number;
}

/** An item holding a pipeline stage, and how long it has held it. */
export interface StageItem {
  id: string;
  title: string;
  board: BoardKind;
  stage: string;
  ageMs: number;
}

/** A stage change that happened inside the window. */
export interface MovedItem {
  id: string;
  title: string;
  board: BoardKind;
  stage: string;
  at: number;
  /** Raw actor, so the UI can name a rule a rule and an agent an agent. */
  by: string | undefined;
}

/** One rung of the funnel: how far the window's new work got, and what is left there. */
export interface FunnelStage {
  stage: string;
  reached: number;
  /** Of `reached`, the items no person ever had to close a stage for. */
  unattended: number;
  /** Items whose furthest column is this one — parked, canceled or still moving. */
  restingAt: number;
  /** Of `restingAt`, the ones called off outright. */
  canceled: number;
  /** Of `restingAt`, the ones still holding the column — stopped here, not dead. */
  open: number;
  medianHoldMs?: number;
}

/** A cohort member, kept whole so the funnel can split it by board and drop duplicates. */
interface CohortEntry {
  id: string;
  parentWorkItemId: string | null;
  board: BoardKind;
  reach: number;
  /** A person closed one of its stages — it did not get here on its own. */
  attended: boolean;
  canceled: boolean;
  /** Still holds a pipeline column, so resting here means stopped, not finished. */
  open: boolean;
}

export interface FactoryOverview {
  /** Items a run is working right now, longest-running first. */
  running: StageItem[];
  /** Items past intake and not yet terminal, run or not — the pipeline's size. */
  inFlight: number;
  /** Pipeline items nobody and nothing is working, oldest first. */
  waiting: StageItem[];
  /** Stage changes inside the window, newest first. */
  moved: MovedItem[];
  /**
   * Work-board cards only: a PR card's board has three columns, so it has no
   * answer for "did it reach Planning" and folding that in as a zero carves a
   * trough through the chart. Two pipelines, one funnel.
   */
  funnel: FunnelStage[];
  /** Cohort work that opened a pull request of its own — a subset of the flow, never an addition. */
  pullRequests: number;
  /** Of `pullRequests`, the ones carried to Done — the code that actually landed. */
  merged: number;
  /** The stretch charts should draw: the window, clipped to the Factory's first item. */
  timeline: OverviewWindow;
}

/**
 * Furthest column ever held — history and the columns the card sits in now, so a
 * card whose history predates a stage still counts where it stands. A cancel is
 * where work leaves, not progress, so it never advances the mark, and a stage the
 * board does not know is no progress either: the route takes any id, and unknown
 * ids sort past Done.
 */
function furthestStageOrder(item: WorkItem): number {
  let furthest = 0;
  for (const held of [...item.stageHistory.map(entry => entry.stage), ...item.stages]) {
    const stage = boardStage(held);
    if (stage === undefined || stage === CANCELED_STAGE) continue;
    furthest = Math.max(furthest, stageOrder(stage));
  }
  return furthest;
}

function closedPipelinePasses(item: WorkItem): WorkItemStageEntry[] {
  return item.stageHistory.filter(entry => isPipelineStage(entry.stage) && entry.exitedAt !== undefined);
}

function holdMs(entry: WorkItemStageEntry): number | undefined {
  const from = parseTime(entry.enteredAt);
  const to = parseTime(entry.exitedAt);
  return from === undefined || to === undefined || to <= from ? undefined : to - from;
}

/** Re-entering a stage appends an open entry without closing the earlier one, so the current visit is the last. */
function latestOpenEntryFor(item: WorkItem, stage: string): WorkItemStageEntry | undefined {
  for (let index = item.stageHistory.length - 1; index >= 0; index--) {
    const entry = item.stageHistory[index]!;
    if (entry.stage === stage && entry.exitedAt === undefined) return entry;
  }
  return undefined;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export function computeFactoryOverview(
  items: WorkItem[],
  activeSessions: ReadonlySet<string>,
  window: OverviewWindow,
  now: Date = new Date(),
): FactoryOverview {
  const nowMs = now.getTime();
  const overview: FactoryOverview = {
    running: [],
    inFlight: 0,
    waiting: [],
    moved: [],
    funnel: [],
    pullRequests: 0,
    merged: 0,
    timeline: window,
  };

  const cohort: CohortEntry[] = [];
  const holds = new Map<string, number[]>();
  let firstCreatedAt: number | undefined;

  for (const item of items) {
    // Integrations sync every issue and PR of a connected repo onto the board;
    // counting those reports the upstream repo's flow as the Factory's.
    if (!hasFactoryRun(item)) continue;

    const createdAt = parseTime(item.createdAt);
    if (createdAt !== undefined && (firstCreatedAt === undefined || createdAt < firstCreatedAt))
      firstCreatedAt = createdAt;

    const board = itemBoard(item);
    const passes = closedPipelinePasses(item);
    const heldStages = item.stages.filter(isPipelineStage);

    // Born in the window, so the funnel follows one cohort forward instead of
    // mixing in work that was already halfway through when the range opened.
    if (createdAt !== undefined && createdAt >= window.fromMs && createdAt < window.toMs) {
      cohort.push({
        id: item.id,
        parentWorkItemId: item.parentWorkItemId,
        board,
        reach: furthestStageOrder(item),
        attended: passes.some(pass => !isUnattended(pass.exitedBy)),
        canceled: item.stages.includes(CANCELED_STAGE),
        open: heldStages.length > 0,
      });
      if (board === 'work') {
        for (const pass of passes) {
          const duration = holdMs(pass);
          if (duration === undefined) continue;
          const durations = holds.get(pass.stage) ?? [];
          durations.push(duration);
          holds.set(pass.stage, durations);
        }
      }
    }

    const active = Object.values(item.sessions).some(ref => activeSessions.has(ref.sessionId));

    if (heldStages.length > 0) overview.inFlight += 1;
    for (const stage of heldStages) {
      const enteredAt = parseTime(latestOpenEntryFor(item, stage)?.enteredAt) ?? createdAt ?? nowMs;
      const row: StageItem = {
        id: item.id,
        title: item.title,
        board,
        stage,
        ageMs: Math.max(0, nowMs - enteredAt),
      };
      if (active) overview.running.push(row);
      else overview.waiting.push(row);
    }

    for (const entry of item.stageHistory) {
      const enteredAt = parseTime(entry.enteredAt);
      if (enteredAt === undefined) continue;
      if (enteredAt < window.fromMs || enteredAt >= window.toMs) continue;
      overview.moved.push({
        id: item.id,
        title: item.title,
        board,
        stage: entry.stage,
        at: enteredAt,
        by: entry.by,
      });
    }
  }

  // A merged PR keeps its own Review card, linked back to the card that wrote
  // the code. Counting both reports one piece of work twice.
  const cohortIds = new Set(cohort.map(entry => entry.id));
  const counted = cohort.filter(entry => entry.parentWorkItemId === null || !cohortIds.has(entry.parentWorkItemId));

  const built = counted.filter(entry => entry.board === 'work');
  const doneOrder = stageOrder(DONE_STAGE);
  const ownPullRequests = cohort.filter(
    entry => entry.board === 'review' && entry.parentWorkItemId !== null && cohortIds.has(entry.parentWorkItemId),
  );
  overview.pullRequests = ownPullRequests.length;
  overview.merged = ownPullRequests.filter(entry => entry.reach >= doneOrder).length;

  overview.funnel = FUNNEL_STAGES.map(stage => {
    const order = stageOrder(stage.id);
    const reached = built.filter(entry => entry.reach >= order);
    const resting = built.filter(entry => entry.reach === order);
    return {
      stage: stage.id,
      reached: reached.length,
      unattended: reached.filter(entry => !entry.attended).length,
      restingAt: resting.length,
      canceled: resting.filter(entry => entry.canceled).length,
      open: resting.filter(entry => entry.open).length,
      medianHoldMs: median(holds.get(stage.id) ?? []),
    };
  });

  // A window reaching back before the first card draws a stretch that never existed.
  if (firstCreatedAt !== undefined && firstCreatedAt > window.fromMs) {
    overview.timeline = { fromMs: firstCreatedAt, toMs: window.toMs };
  }

  overview.running.sort((left, right) => right.ageMs - left.ageMs);
  overview.waiting.sort((left, right) => right.ageMs - left.ageMs);
  overview.moved.sort((left, right) => right.at - left.at);

  return overview;
}

export function boardItemPath(factoryProjectId: string | undefined, item: { board: string; id: string }): string {
  return `/factories/${factoryProjectId ?? ''}/${item.board}?item=${encodeURIComponent(item.id)}`;
}
