import { FACTORY_ROLE_STAGES } from '@mastra/factory/rules/types';

import type { RunBar } from '../../runs/runBars';
import type { TimeWindow } from '../../time/timeViewport';

export interface PlacedRun {
  run: RunBar;
  row: number;
  fromMs: number;
  toMs: number;
  startNotInView: boolean;
}

interface PackedRun {
  run: RunBar;
  row: number;
}

export interface PackedLane {
  role: string;
  runs: PackedRun[];
}

export interface Lane {
  role: string;
  rowCount: number;
  runs: PlacedRun[];
  overflowRuns: PlacedRun[];
  overflowRow: number;
  foldable: boolean;
}

export const FOLDED_LANE_ROWS = 3;
export const EXPANDED_LANE_ROWS = 12;

interface HandoffEnd {
  placed: PlacedRun;
  laneIndex: number;
}

export interface Handoff {
  id: string;
  from: HandoffEnd;
  to: HandoffEnd;
}

interface CardRun extends HandoffEnd {
  drawn: boolean;
}

const BUILT_IN_ROLES: readonly string[] = Object.keys(FACTORY_ROLE_STAGES);
const MAX_UNENDED_RUN_MS = 30 * 60_000;

export function runEndMs(run: RunBar): number {
  if (run.endedAt !== undefined) return run.endedAt;
  if (run.status === 'unaccounted' && run.startedAt !== undefined) return run.startedAt + MAX_UNENDED_RUN_MS;
  return Infinity;
}

function packStartMs(run: RunBar, narrowestBarMs: number, liveEndMs: number | undefined): number {
  if (run.startedAt === undefined) return -Infinity;
  if (liveEndMs === undefined) return run.startedAt;
  return Math.min(run.startedAt, liveEndMs - narrowestBarMs);
}

function packRows(runs: RunBar[], narrowestBarMs: number, liveEndMs: number | undefined): PackedRun[] {
  const rowEndsMs: number[] = [];
  return runs
    .map(run => ({ run, startMs: packStartMs(run, narrowestBarMs, liveEndMs) }))
    .toSorted((left, right) => left.startMs - right.startMs)
    .map(({ run, startMs }) => {
      const freeRow = rowEndsMs.findIndex(endMs => endMs <= startMs);
      const row = freeRow === -1 ? rowEndsMs.length : freeRow;
      rowEndsMs[row] = Math.max(runEndMs(run), startMs + narrowestBarMs);
      return { run, row };
    });
}

function runsByRole(runs: RunBar[]): Array<[string, RunBar[]]> {
  const grouped = new Map<string, RunBar[]>(BUILT_IN_ROLES.map(role => [role, []]));
  for (const run of runs) {
    const roleRuns = grouped.get(run.role);
    if (roleRuns === undefined) grouped.set(run.role, [run]);
    else roleRuns.push(run);
  }
  const groups = [...grouped];
  const extraRoleGroups = groups
    .slice(BUILT_IN_ROLES.length)
    .toSorted(([leftRole], [rightRole]) => leftRole.localeCompare(rightRole));
  return [...groups.slice(0, BUILT_IN_ROLES.length), ...extraRoleGroups];
}

export function packLanes(runs: RunBar[], narrowestBarMs: number, liveEndMs: number | undefined): PackedLane[] {
  return runsByRole(runs).map(([role, roleRuns]) => ({ role, runs: packRows(roleRuns, narrowestBarMs, liveEndMs) }));
}

/** Server event times can run ahead of the browser clock; a run starting past "now" pins to that edge. */
function clipToWindow({ run, row }: PackedRun, window: TimeWindow): PlacedRun | undefined {
  const startsAfterWindow = run.startedAt !== undefined && run.startedAt > window.endMs;
  if (startsAfterWindow && !window.endsAtNow) return undefined;
  const fromMs = Math.min(Math.max(run.startedAt ?? window.startMs, window.startMs), window.endMs);
  const toMs = Math.min(runEndMs(run), window.endMs);
  if (toMs < window.startMs) return undefined;
  return { run, row, fromMs, toMs, startNotInView: run.startedAt === undefined || run.startedAt < window.startMs };
}

function placeLane({ role, runs }: PackedLane, window: TimeWindow, expanded: boolean): Lane {
  const placed = runs.flatMap(packed => clipToWindow(packed, window) ?? []);
  const packedRowInView: boolean[] = [];
  for (const { row } of placed) packedRowInView[row] = true;
  const denseRow: number[] = [];
  let rowsInView = 0;
  packedRowInView.forEach((_, packedRow) => {
    denseRow[packedRow] = rowsInView;
    rowsInView += 1;
  });
  for (const run of placed) run.row = denseRow[run.row];

  const fullRowCount = Math.max(1, rowsInView);
  const rowCap = expanded ? EXPANDED_LANE_ROWS : FOLDED_LANE_ROWS;
  const overflowRow = rowCap - 1;
  const foldable = fullRowCount > FOLDED_LANE_ROWS;
  if (fullRowCount <= rowCap)
    return { role, rowCount: fullRowCount, runs: placed, overflowRuns: [], overflowRow, foldable };
  return {
    role,
    rowCount: rowCap,
    runs: placed.filter(run => run.row < overflowRow),
    overflowRuns: placed.filter(run => run.row >= overflowRow),
    overflowRow,
    foldable,
  };
}

export function placeLanes(lanes: PackedLane[], window: TimeWindow, expandedRoles: ReadonlySet<string>): Lane[] {
  return lanes.map(lane => placeLane(lane, window, expandedRoles.has(lane.role)));
}

function passedBatonCleanly(previous: CardRun, next: CardRun): boolean {
  const { endedAt } = previous.placed.run;
  const { startedAt } = next.placed.run;
  return (
    previous.laneIndex !== next.laneIndex && endedAt !== undefined && startedAt !== undefined && startedAt >= endedAt
  );
}

export function laneHandoffs(lanes: Lane[]): Handoff[] {
  const runsByCard = new Map<string, CardRun[]>();
  const addCardRun = (cardRun: CardRun) => {
    const { workItemId } = cardRun.placed.run;
    if (workItemId === undefined) return;
    const cardRuns = runsByCard.get(workItemId);
    if (cardRuns === undefined) runsByCard.set(workItemId, [cardRun]);
    else cardRuns.push(cardRun);
  };
  lanes.forEach((lane, laneIndex) => {
    for (const placed of lane.runs) addCardRun({ placed, laneIndex, drawn: true });
    for (const placed of lane.overflowRuns) addCardRun({ placed, laneIndex, drawn: false });
  });

  const handoffs: Handoff[] = [];
  for (const cardRuns of runsByCard.values()) {
    const ordered = cardRuns.toSorted((left, right) => left.placed.fromMs - right.placed.fromMs);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const next = ordered[index];
      if (!previous.drawn || !next.drawn || !passedBatonCleanly(previous, next)) continue;
      handoffs.push({
        id: `${previous.placed.run.id}->${next.placed.run.id}`,
        from: { placed: previous.placed, laneIndex: previous.laneIndex },
        to: { placed: next.placed, laneIndex: next.laneIndex },
      });
    }
  }
  return handoffs;
}
