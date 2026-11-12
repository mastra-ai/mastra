import { needsApproval } from '@mastra/factory/rules/types';

import type { BoardCardState, BoardCardStatus } from './boardCardState';
import { allowsMove, boardLoop, phaseKindOf } from './boardFlow';
import type { BoardInfo, BoardLoop } from './boardFlow';
import { itemSessionSpec, metadataLabels, pullRequestStatusForItem, pullRequestStatusForSource } from './boardItems';
import { attachedPullRequestSource, cardHasPullRequest, isPullRequestSource } from './services/workItems';
import type { WorkItem, WorkItemSessionRef } from './services/workItems';
import type { BoardStageId } from './stages';

type FactoryRole = 'triage' | 'plan' | 'work' | 'review';

export interface CardPrimaryAction {
  label: string;
  /** Spoken name when the pill's label is abbreviated to fit the actions row. */
  ariaLabel?: string;
  start: () => void;
}

/** A lane the card can be moved into, named by what the lane's rule then runs. */
export interface CardMove {
  label: 'Investigate' | 'Plan' | 'Build' | 'Prepare approval' | 'Review' | 'Re-review';
  /** Session slot the lane's run fills on the card: the phase's context, e.g. `work`. */
  role: string;
  stage: string;
  /** The run's outcome is a maintainer decision, so hands-off has nothing to remove. */
  awaitsHumanDecision?: true;
}

/** A persisted card or a candidate feed entry: both are moved by the same lane rules. */
export type MovableCard = Pick<WorkItem, 'source' | 'metadata' | 'workItem'> &
  Partial<Pick<WorkItem, 'board' | 'stages'>>;

const seatMove = (label: CardMove['label'], seat: { phase: string; context: string } | undefined) =>
  seat && { label, role: seat.context, stage: seat.phase };

/** An issue card's moves from each column: building comes only after planning, when the board plans. */
function issueMoves(loop: BoardLoop, columnStage: BoardStageId): CardMove[] {
  const investigate = seatMove('Investigate', loop.triage);
  const plan = seatMove('Plan', loop.plan);
  const build = seatMove('Build', loop.build);
  const moves =
    columnStage === loop.plan?.phase
      ? [plan, build]
      : columnStage === loop.build?.phase
        ? [build, plan]
        : [investigate, plan ?? build];
  return moves.filter(move => move !== undefined);
}

function reviewMove(loop: BoardLoop, label: 'Review' | 'Re-review'): CardMove[] {
  return loop.pullRequestReview === undefined ? [] : [{ label, role: REVIEW_CONTEXT, stage: loop.pullRequestReview }];
}

/** The session context every review phase runs in. */
const REVIEW_CONTEXT = 'review';

/** Whether a card in `stage` still waits for someone to accept it: it rests, or the board is triaging it. */
function awaitsAcceptance(board: BoardInfo, loop: BoardLoop, stage: string): boolean {
  return phaseKindOf(board, stage) === 'resting' || stage === loop.triage?.phase;
}

/** Where a card's button can send it, likeliest first; the lane's rule decides what runs there. */
export function cardMoves(item: MovableCard, columnStage: BoardStageId, board: BoardInfo | undefined): CardMove[] {
  const loop = boardLoop(board);
  const kind = phaseKindOf(board, columnStage);
  if (!board || !loop || kind === undefined) return [];
  if (kind === 'terminal') {
    return openPullRequestInCompleted(item, columnStage, loop) ? reviewMove(loop, 'Re-review') : [];
  }
  // A card carrying a pull request, its own or one attached to its issue, sends it to the board's pull request review phase (Review, `pr-review`, on Work).
  const reviewing = columnStage === loop.pullRequestReview || columnStage === loop.selfReview;
  if (reviewing && cardHasPullRequest(item)) return reviewMove(loop, 'Review');
  if (columnStage === loop.selfReview) return [];
  if (
    item.source === 'github-issue' &&
    loop.triage &&
    needsApproval({ ...item, workItem: item.workItem ?? { labels: metadataLabels(item.metadata) } }, stage =>
      awaitsAcceptance(board, loop, stage),
    )
  ) {
    return [
      { label: 'Prepare approval', role: loop.triage.context, stage: loop.triage.phase, awaitsHumanDecision: true },
    ];
  }
  if (
    item.source === 'github-issue' ||
    item.source === 'gitlab-issue' ||
    item.source === 'linear-issue' ||
    item.source === 'jira-issue' ||
    item.source === 'incidentio-follow-up'
  ) {
    return issueMoves(loop, columnStage);
  }
  return isPullRequestSource(item.source) ? reviewMove(loop, 'Review') : [];
}

function openPullRequestInCompleted(item: MovableCard, columnStage: BoardStageId, loop: BoardLoop): boolean {
  if (columnStage !== loop.completed || !cardHasPullRequest(item)) return false;
  // An issue card's pull request state lives on the pull request's source, not the issue's.
  const attached = attachedPullRequestSource(item);
  const status = attached
    ? pullRequestStatusForSource(attached)
    : pullRequestStatusForItem({ ...item, stages: item.stages ?? [] });
  return status === 'open' || status === 'draft';
}

/**
 * Resume re-enters the deepest working phase a card parked in a resting phase has been in, and
 * lets that phase's rule dispatch. Phases can share a session, so the phase comes from the
 * card's stage history; a card that never had a session is a fresh arrival with nothing to resume.
 */
export function resumeStage(
  columnStage: BoardStageId,
  item: {
    sessions: Record<string, WorkItemSessionRef>;
    stageHistory?: readonly { stage: string }[];
  },
  board: BoardInfo | undefined,
): string | undefined {
  const loop = boardLoop(board);
  if (!board || !loop || phaseKindOf(board, columnStage) !== 'resting') return undefined;
  if (Object.keys(item.sessions).length === 0) return undefined;
  const visited = new Set((item.stageHistory ?? []).map(entry => entry.stage));
  const lane = loop.working.filter(lane => visited.has(lane)).at(-1);
  if (lane === undefined || allowsMove(board, columnStage, lane)) return lane;
  // A rest that leads to neither building nor its self-review (Work's Intake) resumes in planning.
  return loop.plan?.phase ?? lane;
}

/**
 * Triage looked at the card and left it resting, so the next move is a person's decision. The
 * card then asks for that decision instead of offering a run that would only advance it as a side
 * effect. A card that has been past triage since (a parked build, say) resumes instead.
 */
export function awaitsTriageDecision(
  item: Pick<WorkItem, 'sessions'> & Partial<Pick<WorkItem, 'stageHistory'>>,
  columnStage: BoardStageId,
  board: BoardInfo | undefined,
) {
  const triage = boardLoop(board)?.triage;
  return (
    triage !== undefined &&
    phaseKindOf(board, columnStage) === 'resting' &&
    item.sessions[triage.context] !== undefined &&
    (resumeStage(columnStage, item, board) ?? triage.phase) === triage.phase
  );
}

export interface TriageDecision {
  label: string;
  stage: string;
}

/** The maintainer's choices for a held card, the likeliest first. */
export function triageDecisions(board: BoardInfo | undefined): TriageDecision[] {
  const loop = boardLoop(board);
  if (!loop) return [];
  const accept = loop.plan
    ? { label: 'Accept and plan', stage: loop.plan.phase }
    : loop.build && { label: 'Accept and build', stage: loop.build.phase };
  const close = loop.canceled === undefined ? undefined : { label: 'Close', stage: loop.canceled };
  return [accept, close].filter(choice => choice !== undefined);
}

/**
 * A held card's primary action is the maintainer's decision, ahead of
 * everything else: a suggested or parked run would advance the card without
 * that decision being made. Otherwise a proposed run wins the slot, since
 * releasing it beats starting a rival run beside it, and resuming parked work
 * comes next for the same reason.
 */
export function cardPrimaryAction({
  item,
  board,
  columnStage,
  move,
  resumeStage,
  nextPhase,
  waiting,
  hasSession,
  onApproveProposal,
  onCreateSession,
  onMove,
}: {
  item: WorkItem;
  /** The card's board, once the catalog has loaded. */
  board?: BoardInfo;
  columnStage?: BoardStageId;
  /** The lane the button sends the card to; undefined when the card has none to offer. */
  move?: CardMove;
  /** Lane a parked card goes back to, ahead of any move it also offers. */
  resumeStage?: string;
  /** On a board with no pull request loop, the first phase this one declares a transition to. */
  nextPhase?: { id: string; label: string };
  /** The card's own parked run, read from its status so the button says what the badge says. */
  waiting?: { label: string; decisionId: string };
  hasSession: boolean;
  onApproveProposal: (decisionId: string) => void;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onMove: (toStage: string) => void;
}): CardPrimaryAction | undefined {
  const [accept] = triageDecisions(board);
  if (columnStage !== undefined && accept !== undefined && awaitsTriageDecision(item, columnStage, board)) {
    // One word on the pill so it sits beside "Open session"; the menu spells out the alternatives.
    return { label: 'Accept', ariaLabel: accept.label, start: () => onMove(accept.stage) };
  }
  if (waiting !== undefined) {
    return { label: waiting.label, start: () => onApproveProposal(waiting.decisionId) };
  }
  if (resumeStage !== undefined) {
    return { label: 'Resume', start: () => onMove(resumeStage) };
  }
  if (move !== undefined) {
    return { label: move.label, start: () => onMove(move.stage) };
  }
  // A board without a loop runs its phases' own steps, so the button advances the card rather than starting one.
  if (nextPhase !== undefined) {
    return { label: `Move to ${nextPhase.label}`, start: () => onMove(nextPhase.id) };
  }
  // Every lane this card offers is already its own, so opening its session is the action.
  if (hasSession) return undefined;
  return {
    label: 'Start session',
    start: () => onCreateSession(itemSessionSpec(item)),
  };
}

export type CardAction = { label: string; ariaLabel?: string; disabled?: boolean; urgent?: boolean } & (
  | { href: string }
  | { start: () => void }
);

export function sessionLink(href: string | undefined): CardAction | undefined {
  return href === undefined ? undefined : { label: 'Open session', href };
}

export function retryButton({
  decisionId,
  onRetry,
}: {
  decisionId?: string;
  onRetry: (decisionId: string) => void;
}): CardPrimaryAction | undefined {
  if (decisionId === undefined) return undefined;
  return { label: 'Retry', start: () => onRetry(decisionId) };
}

/** The card's buttons, the likeliest next click first; `urgent` marks the one the card waits on a person for. */
export function cardActions({
  state,
  session,
  retry,
  run,
}: {
  state: BoardCardState;
  session?: CardAction;
  retry?: CardPrimaryAction;
  run?: CardPrimaryAction;
}): CardAction[] {
  const { owner } = state;
  if (owner.kind === 'free') return freeCardActions(state.status, { session, retry, run });
  if (session !== undefined) return [session];
  if (owner.kind === 'session' || run === undefined) return [];
  return [{ label: owner.progressLabel, start: run.start, disabled: true }];
}

function freeCardActions(
  status: BoardCardStatus,
  { session, retry, run }: { session?: CardAction; retry?: CardPrimaryAction; run?: CardPrimaryAction },
): CardAction[] {
  const namedRun =
    run !== undefined && status.kind === 'waiting'
      ? { ...run, ariaLabel: `Start suggested run: ${status.label}` }
      : run;
  const main = retry ?? namedRun ?? session;
  if (main === undefined) return [];
  const awaitsPerson = status.kind === 'waiting' || status.kind === 'held';
  const isUrgent = (action: CardAction) => action === retry || (awaitsPerson && action === namedRun);
  const rest = [session, namedRun].filter(action => action !== undefined).filter(action => action !== main);
  return [main, ...rest].map(action => ({ ...action, urgent: isUrgent(action) }));
}
