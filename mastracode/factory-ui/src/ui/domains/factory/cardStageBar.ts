import type { InstalledPhaseInfo } from '../../../api/types';
import { formatDuration } from '../../../lib/date/formatDuration';
import { allowsMove, boardLoop, phaseOf } from './boardFlow';
import type { BoardInfo } from './boardFlow';
import { contextLabel, phaseContext } from './boardItems';
import { currentItemStage, phaseName, pullRequestMayEnter } from './boardStages';
import { cardChangeRequest, changeRequestStatus } from './changeRequestState';
import type { PullRequestSubscription } from './services/githubSubscriptions';
import { changeRequestReference } from './sessionChangeRequests';
import { isPullRequestSource } from './services/workItems';
import type { WorkItem } from './services/workItems';

type Phase = InstalledPhaseInfo;

type MoveBlock = 'board' | 'pull-request';

export interface StageStep {
  phase: Phase;
  /** Absent when the card can move there now. */
  blocked?: 'pull-request';
}

export interface CardStages {
  current: Phase;
  /** The nearest track phases either way that the card can enter, which the bar's arrows offer. */
  previous: StageStep | undefined;
  next: StageStep | undefined;
  /** The track phases the card can enter, with its own when it sits on the track, in board order. */
  track: Phase[];
  /** The phases that stop work on the card that it can enter, with its own when it is stopped. */
  stop: Phase[];
}

/** Terminal phases other than the one that completes a card: Canceled, Dropped. */
function isStopPhase(board: BoardInfo, phase: Phase): boolean {
  const completed = board.flow?.completed ?? board.phases.find(candidate => candidate.kind === 'terminal')?.id;
  return phase.kind === 'terminal' && phase.id !== completed;
}

function blockOf(board: BoardInfo, item: WorkItem, from: string, to: string): MoveBlock | undefined {
  if (!allowsMove(board, from, to)) return 'board';
  if (!pullRequestMayEnter(board, item, to)) return 'pull-request';
  return undefined;
}

export function cardStages(item: WorkItem, board: BoardInfo | undefined): CardStages | undefined {
  if (!board) return undefined;
  const currentId = currentItemStage(item, board);
  const current = currentId === undefined ? undefined : phaseOf(board, currentId);
  if (!current) return undefined;

  const stopped = isStopPhase(board, current);
  const track = board.phases.filter(phase => !isStopPhase(board, phase));
  const at = track.findIndex(phase => phase.id === current.id);
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

  const reachable = board.phases.filter(
    phase => phase.id === current.id || blockOf(board, item, current.id, phase.id) === undefined,
  );

  return {
    current,
    previous: stopped ? undefined : nearest(track.slice(0, at).toReversed(), false),
    next: stopped ? undefined : nearest(track.slice(at + 1), true),
    track: reachable.filter(phase => !isStopPhase(board, phase)),
    stop: reachable.filter(phase => isStopPhase(board, phase)),
  };
}

export function stageBlockReason(step: StageStep): string | undefined {
  return step.blocked === 'pull-request' ? `${phaseName(step.phase)} needs a pull request` : undefined;
}

interface StageSession {
  repository?: string;
  subscriptions?: readonly PullRequestSubscription[];
}

export function stageDescription(
  board: BoardInfo,
  item: WorkItem,
  phase: Phase,
  /** The context of the session on screen, so its own phase reads as "this session". */
  openContext?: string,
  session: StageSession = {},
): string {
  const own = phase.description?.trim();
  if (own) return own;
  if (isStopPhase(board, phase)) return 'Stops all work on this card';
  if (phase.kind === 'terminal') {
    const pullRequest = boardLoop(board)?.pullRequestReview === undefined ? undefined : cardChangeRequest(item);
    const status = pullRequest && changeRequestStatus(pullRequest, session.subscriptions);
    return pullRequest?.number !== undefined && (status === 'open' || status === 'draft')
      ? `Usually automatic when ${changeRequestReference(pullRequest, session.repository)} merges`
      : `Marks it ${phaseName(phase).toLowerCase()}`;
  }
  if (phase.kind === 'resting') return 'Parks it until someone moves it on';
  const context = phaseContext(phase);
  if (context === undefined) return 'Factory works on it';
  if (context === openContext) return 'Factory works on it in this session';
  return `Factory works on it in the ${contextLabel(context, board.phases)} session`;
}

export function enteredCurrentStageAt(item: WorkItem, stage: string): number | undefined {
  const entry = item.stageHistory.findLast(candidate => candidate.stage === stage && !candidate.exitedAt);
  const at = entry ? Date.parse(entry.enteredAt) : Number.NaN;
  return Number.isNaN(at) ? undefined : at;
}

/** How long a card has sat somewhere, as "46m"; under a minute reads "<1m" rather than ticking seconds. */
export function elapsedLabel(from: number, to: number): string {
  return to - from < 60_000 ? '<1m' : formatDuration(to - from);
}
