import { FACTORY_ROLE_STAGES, isFactoryRole, needsApproval } from '@mastra/factory/rules/types';
import type { FactoryRole, FactoryRuleStage } from '@mastra/factory/rules/types';
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
export type MovableCard = Pick<WorkItem, 'source' | 'metadata'> & Partial<Pick<WorkItem, 'stages' | 'acceptedAt'>>;

const INVESTIGATE: CardMove = { label: 'Investigate', role: 'triage', stage: 'triage' };
const BUILD: CardMove = { label: 'Build', role: 'work', stage: 'execute' };
const PREPARE_APPROVAL: CardMove = {
  label: 'Prepare approval',
  role: 'triage',
  stage: 'triage',
  awaitsHumanDecision: true,
};
const REVIEW: CardMove = { label: 'Review', role: 'review', stage: 'review' };
const RE_REVIEW: CardMove = { label: 'Re-review', role: 'review', stage: 'review' };

/** Where a card's button can send it, likeliest first; the lane's rule decides what runs there. */
export function cardMoves(item: MovableCard, columnStage: BoardStageId): CardMove[] {
  if (isTerminalStage(columnStage)) return openPullRequestInDone(item, columnStage) ? [RE_REVIEW] : [];
  if (columnStage === 'review' && item.source !== 'github-pr') return [];
  if (item.source === 'github-issue') return needsApproval(item) ? [PREPARE_APPROVAL] : [INVESTIGATE, BUILD];
  if (item.source === 'linear-issue') return [INVESTIGATE, BUILD];
  return item.source === 'github-pr' ? [REVIEW] : [];
}

function openPullRequestInDone(item: MovableCard, columnStage: BoardStageId): boolean {
  return (
    columnStage === 'done' &&
    item.source === 'github-pr' &&
    ['open', 'draft'].includes(pullRequestStatusForItem({ ...item, stages: item.stages ?? [] }))
  );
}

function seatDepth(role: string): number {
  return Object.keys(FACTORY_ROLE_STAGES).indexOf(role);
}

/** Resume re-enters the lane of the deepest seat the card has used, and lets that lane's rule dispatch. */
export function resumeStage(
  columnStage: BoardStageId,
  sessions: Record<string, WorkItemSessionRef>,
): FactoryRuleStage | undefined {
  if (columnStage !== 'intake') return undefined;
  const deepest = Object.keys(sessions)
    .filter(isFactoryRole)
    .sort((left, right) => seatDepth(left) - seatDepth(right))
    .at(-1);
  return deepest === undefined ? undefined : FACTORY_ROLE_STAGES[deepest];
}

/**
 * Triage classified the card as something other than a bug, so the rules hold
 * it until a person moves it forward. The card then asks for that decision
 * instead of offering a run that would only advance it as a side effect.
 */
export function awaitsTriageDecision(item: Pick<WorkItem, 'triageType' | 'acceptedAt'>, columnStage: BoardStageId) {
  return (
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
  retryingDecisionId,
  onRetry,
}: {
  decisionId?: string;
  retryingDecisionId?: string;
  onRetry: (decisionId: string) => void;
}): CardAction | undefined {
  if (decisionId === undefined) return undefined;
  const retrying = decisionId === retryingDecisionId;
  return { label: retrying ? 'Retrying…' : 'Retry', disabled: retrying, start: () => onRetry(decisionId) };
}

export function runButton({
  action,
  pending,
  suggestion,
}: {
  action?: CardPrimaryAction;
  /** A session start the card is still resolving; a move needs none, it is optimistic. */
  pending: boolean;
  /** The waiting suggestion's label, so the button says which run it releases. */
  suggestion?: string;
}): CardAction | undefined {
  if (action === undefined) return undefined;
  return {
    label: pending ? 'Starting…' : action.label,
    ariaLabel: suggestion === undefined ? action.ariaLabel : `Start suggested run: ${suggestion}`,
    disabled: pending,
    start: action.start,
  };
}

/** The card's buttons, the likeliest next click first; `urgent` marks the one the card waits on a person for. */
export function cardActions({
  running,
  waiting,
  session,
  retry,
  run,
}: {
  running: boolean;
  /** The run is a parked suggestion or a held card's decision: it needs the user, so it outranks a running session. */
  waiting: boolean;
  session?: CardAction;
  retry?: CardAction;
  run?: CardAction;
}): CardAction[] {
  // A running session owns the branch, so no rival run beside it; a waiting suggestion is still the user's to release.
  const nextRun = running && !waiting ? undefined : run;
  const main = retry ?? nextRun ?? session;
  if (main === undefined) return [];
  const rest = [session, nextRun].filter(action => action !== undefined).filter(action => action !== main);
  const urgent = (action: CardAction) => action === retry || (waiting && action === run);
  return [main, ...rest].map(action => ({ ...action, urgent: urgent(action) }));
}
