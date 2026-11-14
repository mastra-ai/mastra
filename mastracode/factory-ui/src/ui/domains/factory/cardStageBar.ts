import type { InstalledPhaseInfo } from '../../../api/types';
import { formatDuration } from '../../../lib/date/formatDuration';
import { allowsMove, boardLoop, phaseOf } from './boardFlow';
import type { BoardInfo } from './boardFlow';
import { contextLabel, phaseContext } from './boardItems';
import { currentItemStage, pullRequestMayEnter } from './boardStages';
import { changeRequestReference, sessionChangeRequests } from './sessionChangeRequests';
import { isPullRequestSource } from './services/workItems';
import type { WorkItem } from './services/workItems';

type Phase = InstalledPhaseInfo;

/** Why a card can't move straight to a phase: the board declares no such move, or its pull request keeps it out. */
export type StageBlock = 'board' | 'pull-request';

export interface StageStep {
  phase: Phase;
  /** Absent when the card can move there now. */
  blocked?: StageBlock;
}

export interface CardStages {
  current: Phase;
  /** The card sits in a phase that stops work, off the board's track. */
  stopped: boolean;
  /** The nearest track phases either way that the card can enter, which the bar's arrows offer. */
  previous: StageStep | undefined;
  next: StageStep | undefined;
  /** Reachable track phases after the current one, in board order. */
  forward: Phase[];
  /** Reachable track phases before the current one; every reachable track phase once the card is stopped. */
  back: Phase[];
  /** Reachable phases that stop work on the card. */
  stop: Phase[];
  /** Why the board's other phases can't be reached from here, one sentence per reason. */
  notes: string[];
}

export function phaseName(phase: Pick<Phase, 'name' | 'title'>): string {
  return phase.name ?? phase.title;
}

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** Terminal phases other than the one that completes a card: Canceled, Dropped. */
function isStopPhase(board: BoardInfo, phase: Phase): boolean {
  const completed = board.flow?.completed ?? board.phases.find(candidate => candidate.kind === 'terminal')?.id;
  return phase.kind === 'terminal' && phase.id !== completed;
}

function blockOf(board: BoardInfo, item: WorkItem, from: string, to: string): StageBlock | undefined {
  if (!allowsMove(board, from, to)) return 'board';
  if (!pullRequestMayEnter(board, item, to)) return 'pull-request';
  return undefined;
}

/**
 * Where a card can go from its current phase, read from its board: the nearest phase either way it enters, every
 * phase it can reach grouped by direction, and why the rest are out of reach. Mirrors the server,
 * which rejects a pull request shape first and an undeclared move second.
 */
export function cardStages(item: WorkItem, board: BoardInfo | undefined): CardStages | undefined {
  if (!board) return undefined;
  const currentId = currentItemStage(item, board);
  const current = currentId === undefined ? undefined : phaseOf(board, currentId);
  if (!current) return undefined;

  const stopped = isStopPhase(board, current);
  const track = board.phases.filter(phase => !isStopPhase(board, phase));
  const at = track.findIndex(phase => phase.id === current.id);
  // A phase the card never enters from here is passed over: an arrow at it would offer a move that doesn't
  // exist, and the menu's notes already say why.
  const nearest = (phases: readonly Phase[], ahead: boolean): StageStep | undefined => {
    for (const phase of phases) {
      const blocked = blockOf(board, item, current.id, phase.id);
      if (!blocked) return { phase };
      // Review waiting on the pull request the card hasn't opened yet is still where it goes next, so it
      // stays, held, and says what it waits for.
      if (ahead && blocked === 'pull-request' && !isPullRequestSource(item.source)) return { phase, blocked };
    }
    return undefined;
  };

  const forward: Phase[] = [];
  const back: Phase[] = [];
  const stop: Phase[] = [];
  const unreachable: Record<StageBlock, Phase[]> = { board: [], 'pull-request': [] };
  for (const [index, phase] of board.phases.entries()) {
    if (phase.id === current.id) continue;
    const blocked = blockOf(board, item, current.id, phase.id);
    if (blocked) {
      unreachable[blocked].push(phase);
      continue;
    }
    if (isStopPhase(board, phase)) stop.push(phase);
    else if (stopped || index < board.phases.indexOf(current)) back.push(phase);
    else forward.push(phase);
  }

  return {
    current,
    stopped,
    previous: stopped ? undefined : nearest(track.slice(0, at).toReversed(), false),
    next: stopped ? undefined : nearest(track.slice(at + 1), true),
    forward,
    back,
    stop,
    notes: unreachableNotes(item, current, unreachable),
  };
}

function names(phases: readonly Phase[]): string {
  return listFormat.format(phases.map(phaseName));
}

function unreachableNotes(item: WorkItem, current: Phase, unreachable: Record<StageBlock, Phase[]>): string[] {
  const notes: string[] = [];
  if (unreachable.board.length > 0) {
    notes.push(`${names(unreachable.board)} can't be reached from ${phaseName(current)}`);
  }
  const gated = unreachable['pull-request'];
  if (gated.length > 0) {
    notes.push(
      isPullRequestSource(item.source)
        ? `Pull request cards don't enter ${names(gated)}`
        : `${names(gated)} ${gated.length === 1 ? 'needs' : 'need'} a pull request`,
    );
  }
  return notes;
}

/** Why one blocked neighbour is out of reach, for its tooltip. */
export function stageBlockReason(item: WorkItem, current: Phase, step: StageStep): string | undefined {
  if (step.blocked === 'board') return `${phaseName(step.phase)} can't be reached from ${phaseName(current)}`;
  if (step.blocked === 'pull-request') {
    return isPullRequestSource(item.source)
      ? `Pull request cards don't enter ${phaseName(step.phase)}`
      : `${phaseName(step.phase)} needs a pull request`;
  }
  return undefined;
}

/**
 * What moving the card into a phase does, in one line. A phase's own description wins; otherwise
 * it is read from the phase's kind and the session context it runs in.
 */
export function stageDescription(
  board: BoardInfo,
  item: WorkItem,
  phase: Phase,
  /** The context of the session on screen, so its own phase reads as "this session". */
  openContext?: string,
): string {
  const own = phase.description?.trim();
  if (own) return own;
  if (isStopPhase(board, phase)) return 'Stops all work on this card';
  if (phase.kind === 'terminal') {
    // The card's open pull request: its own, or the newest one attached to its issue.
    const pullRequest =
      boardLoop(board)?.pullRequestReview === undefined
        ? undefined
        : sessionChangeRequests({ item, subscriptions: [], provider: 'github' }).find(
            request => (request.status === 'open' || request.status === 'draft') && request.number !== undefined,
          );
    return pullRequest
      ? `Usually automatic when ${changeRequestReference(pullRequest)} merges`
      : `Marks it ${phaseName(phase).toLowerCase()}`;
  }
  if (phase.kind === 'resting') return 'Parks it until someone moves it on';
  const context = phaseContext(phase);
  if (context === undefined) return 'Factory works on it';
  if (context === openContext) return 'Factory works on it in this session';
  return `Factory works on it in the ${contextLabel(context, board.phases)} session`;
}

/** When the card entered its current phase, from the open entry of its stage history. */
export function enteredCurrentStageAt(item: WorkItem, stage: string): number | undefined {
  const entry = item.stageHistory.findLast(candidate => candidate.stage === stage && !candidate.exitedAt);
  const at = entry ? Date.parse(entry.enteredAt) : Number.NaN;
  return Number.isNaN(at) ? undefined : at;
}

/** How long a card has sat somewhere, as "46m"; under a minute reads "<1m" rather than ticking seconds. */
export function elapsedLabel(from: number, to: number): string {
  return to - from < 60_000 ? '<1m' : formatDuration(to - from);
}
