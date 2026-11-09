import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';

import type { InstalledBoardInfo } from '../../../api/types';

/** A board as the catalog sends it: its phases, and which of them plays each part of the pull request loop. */
export type BoardInfo = Pick<InstalledBoardInfo, 'id' | 'title' | 'initialPhase' | 'phases'> &
  Partial<Pick<InstalledBoardInfo, 'name' | 'flow' | 'default'>>;

type BoardPhaseInfo = InstalledBoardInfo['phases'][number];

/** A card's board; rows filed before boards existed belong to the default board. */
export function boardIdOf(item: { board?: string | null }): string {
  return item.board ?? DEFAULT_BOARD_ID;
}

/** The catalog entry for a card's board, once the catalog has loaded. */
export function boardOf<T extends { id: string }>(
  boards: readonly T[] | undefined,
  item: { board?: string | null },
): T | undefined {
  const id = boardIdOf(item);
  return boards?.find(board => board.id === id);
}

export function phaseOf(board: BoardInfo | undefined, phase: string): BoardPhaseInfo | undefined {
  return board?.phases.find(candidate => candidate.id === phase);
}

export function phaseKindOf(board: BoardInfo | undefined, phase: string) {
  return phaseOf(board, phase)?.kind;
}

/** Whether the board lets a card move straight from `from` to `to`. */
export function allowsMove(board: BoardInfo, from: string, to: string): boolean {
  if (from === to) return true;
  const phase = phaseOf(board, from);
  return phase?.nextPhases?.includes(to) === true || phase?.transitions.some(t => t.to === to) === true;
}

export interface BoardLoop {
  /** The resting phase new cards land in. */
  rest: string;
  triage?: { phase: string; context: string };
  /** A working phase that runs in the build phase's context before it, such as Work's Planning. */
  plan?: { phase: string; context: string };
  build?: { phase: string; context: string };
  selfReview?: string;
  pullRequestReview?: string;
  completed?: string;
  canceled?: string;
  /** Working phases in column order, so a parked card resumes in the deepest one it reached. */
  working: readonly string[];
}

/** The loop a board runs, read from the parts the server named; undefined when the board runs none. */
export function boardLoop(board: BoardInfo | undefined): BoardLoop | undefined {
  const flow = board?.flow;
  if (!board || !flow || (flow.build === undefined && flow.pullRequestReview === undefined)) return undefined;
  const contextOf = (phase: string | undefined) =>
    phase === undefined ? undefined : (phaseOf(board, phase)?.context ?? phaseOf(board, phase)?.role);
  const seat = (phase: string | undefined) => {
    const context = contextOf(phase);
    return phase === undefined || context === undefined ? undefined : { phase, context };
  };
  const build = seat(flow.build);
  const plan = build
    ? board.phases.find(
        phase =>
          phase.kind === 'working' &&
          phase.id !== build.phase &&
          (phase.context ?? phase.role) === build.context &&
          allowsMove(board, phase.id, build.phase),
      )?.id
    : undefined;
  return {
    rest: board.initialPhase,
    ...(seat(flow.triage) ? { triage: seat(flow.triage) } : {}),
    ...(seat(plan) ? { plan: seat(plan) } : {}),
    ...(build ? { build } : {}),
    ...(flow.selfReview ? { selfReview: flow.selfReview } : {}),
    ...(flow.pullRequestReview ? { pullRequestReview: flow.pullRequestReview } : {}),
    ...(flow.completed ? { completed: flow.completed } : {}),
    ...(flow.canceled ? { canceled: flow.canceled } : {}),
    working: board.phases.filter(phase => phase.kind === 'working').map(phase => phase.id),
  };
}
