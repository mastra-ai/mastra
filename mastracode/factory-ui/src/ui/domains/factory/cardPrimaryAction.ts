import { FACTORY_ROLE_STAGES, needsApproval } from '@mastra/factory/rules/types';
import type { FactoryRole, FactoryRuleStage } from '@mastra/factory/rules/types';
import type { BoardCardState, BoardCardStatus } from './boardCardState';
import { itemSessionSpec, pullRequestStatusForItem } from './boardItems';
import type { WorkItem, WorkItemSessionRef } from './services/workItems';
import { isTerminalStage } from './stages';
import type { BoardStageId } from './stages';

export interface CardPrimaryAction {
  label: string;
  /** Spoken name when the pill's label is abbreviated to fit the actions row. */
  ariaLabel?: string;
  start: () => void;
}

/** A lane the card can be moved into, named by what the lane's rule then runs. */
export interface CardMove {
  label: 'Investigate' | 'Build' | 'Prepare approval' | 'Review' | 'Re-review';
  /** Session slot the lane's run fills on the card, e.g. `plan` or `work`. */
  role: FactoryRole;
  stage: FactoryRuleStage;
  /** The run's outcome is a maintainer decision, so hands-off has nothing to remove. */
  awaitsHumanDecision?: true;
}

/** A persisted card or a candidate feed entry: both are moved by the same lane rules. */
export type MovableCard = Pick<WorkItem, 'source' | 'metadata'> &
  Partial<Pick<WorkItem, 'board' | 'stages' | 'acceptedAt'>>;

const INVESTIGATE: CardMove = { label: 'Investigate', role: 'triage', stage: 'triage' };
const BUILD: CardMove = { label: 'Build', role: 'work', stage: 'execute' };
const PREPARE_APPROVAL: CardMove = {
  label: 'Prepare approval',
  role: 'triage',
  stage: 'triage',
  awaitsHumanDecision: true,
};
/** A pull request's own card is reviewed in Work's PR review, or in Reviewing on the Review board it was filed on. */
function reviewMoves(item: MovableCard): { review: CardMove; reReview: CardMove } {
  // Pull request cards with no board predate persisted boards and sit on Review.
  const stage = (item.board ?? 'review') === 'review' ? 'review' : 'pr-review';
  return {
    review: { label: 'Review', role: 'review', stage },
    reReview: { label: 'Re-review', role: 'review', stage },
  };
}

/** Where a card's button can send it, likeliest first; the lane's rule decides what runs there. */
export function cardMoves(item: MovableCard, columnStage: BoardStageId): CardMove[] {
  if (item.board != null && item.board !== 'work' && item.board !== 'review') return [];
  if (isTerminalStage(columnStage)) return openPullRequestInDone(item, columnStage) ? [reviewMoves(item).reReview] : [];
  if (columnStage === 'review' && item.source !== 'github-pr' && item.source !== 'gitlab-pr') return [];
  if (item.source === 'github-issue') return needsApproval(item) ? [PREPARE_APPROVAL] : [INVESTIGATE, BUILD];
  if (
    item.source === 'gitlab-issue' ||
    item.source === 'linear-issue' ||
    item.source === 'jira-issue' ||
    item.source === 'incidentio-follow-up'
  ) {
    return [INVESTIGATE, BUILD];
  }
  return item.source === 'github-pr' || item.source === 'gitlab-pr' ? [reviewMoves(item).review] : [];
}

function openPullRequestInDone(item: MovableCard, columnStage: BoardStageId): boolean {
  return (
    columnStage === 'done' &&
    (item.source === 'github-pr' || item.source === 'gitlab-pr') &&
    ['open', 'draft'].includes(pullRequestStatusForItem({ ...item, stages: item.stages ?? [] }))
  );
}

// PR review carries a pull request card's reviewer, after the builder's lanes.
const WORKING_LANES: readonly FactoryRuleStage[] = [...Object.values(FACTORY_ROLE_STAGES), 'pr-review'];

/**
 * Resume re-enters the deepest working lane a card parked in Intake has been in, and lets
 * that lane's rule dispatch. Phases can share a session, so the lane comes from the card's
 * stage history; a card that never had a session is a fresh arrival with nothing to resume.
 */
export function resumeStage(
  columnStage: BoardStageId,
  item: { sessions: Record<string, WorkItemSessionRef>; stageHistory?: readonly { stage: string }[] },
): FactoryRuleStage | undefined {
  if (columnStage !== 'intake' || Object.keys(item.sessions).length === 0) return undefined;
  const visited = new Set((item.stageHistory ?? []).map(entry => entry.stage));
  return WORKING_LANES.filter(lane => visited.has(lane)).at(-1);
}

/**
 * Triage classified the card as something other than a bug, so the rules hold
 * it until a person moves it forward. The card then asks for that decision
 * instead of offering a run that would only advance it as a side effect.
 */
export function awaitsTriageDecision(
  item: Pick<WorkItem, 'triageType' | 'acceptedAt'> & Partial<Pick<WorkItem, 'board'>>,
  columnStage: BoardStageId,
) {
  return (
    (item.board == null || item.board === 'work') &&
    (columnStage === 'intake' || columnStage === 'triage') &&
    item.triageType !== null &&
    item.triageType !== 'bug' &&
    item.acceptedAt === null
  );
}

export interface TriageDecision {
  label: string;
  stage: 'planning' | 'execute' | 'canceled';
}

/** The maintainer's choices for a held card, the likeliest first. */
export const TRIAGE_DECISIONS: readonly TriageDecision[] = [
  { label: 'Accept and plan', stage: 'planning' },
  { label: 'Accept and build', stage: 'execute' },
  { label: 'Close', stage: 'canceled' },
];

/**
 * A held card's primary action is the maintainer's decision, ahead of
 * everything else: a suggested or parked run would advance the card without
 * that decision being made. Otherwise a proposed run wins the slot, since
 * releasing it beats starting a rival run beside it, and resuming parked work
 * comes next for the same reason.
 */
export function cardPrimaryAction({
  item,
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
  columnStage?: BoardStageId;
  /** The lane the button sends the card to; undefined when the card has none to offer. */
  move?: CardMove;
  /** Lane a parked card goes back to, ahead of any move it also offers. */
  resumeStage?: FactoryRuleStage;
  /** On a custom board, the first phase this one declares a transition to. */
  nextPhase?: { id: string; label: string };
  /** The card's own parked run, read from its status so the button says what the badge says. */
  waiting?: { label: string; decisionId: string };
  hasSession: boolean;
  onApproveProposal: (decisionId: string) => void;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onMove: (toStage: string) => void;
}): CardPrimaryAction | undefined {
  if (columnStage !== undefined && awaitsTriageDecision(item, columnStage)) {
    // One word on the pill so it sits beside "Open session"; the menu spells out the alternatives.
    const [accept] = TRIAGE_DECISIONS;
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
  // A custom board's phases carry their own runs, so the button advances the card rather than starting one.
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
