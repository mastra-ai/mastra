import { FACTORY_ROLE_STAGES, isFactoryRole } from '@mastra/factory/rules/types';
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
  label: 'Investigate' | 'Build' | 'Review' | 'Re-review';
  /** Session slot the lane's run fills on the card, e.g. `plan` or `work`. */
  role: FactoryRole;
  stage: FactoryRuleStage;
}

/** A persisted card or a candidate feed entry: both are moved by the same lane rules. */
export type MovableCard = Pick<WorkItem, 'source' | 'metadata'> &
  Partial<Pick<WorkItem, 'board' | 'stages' | 'acceptedAt'>>;

const INVESTIGATE: CardMove = { label: 'Investigate', role: 'triage', stage: 'triage' };
const BUILD: CardMove = { label: 'Build', role: 'work', stage: 'execute' };
const REVIEW: CardMove = { label: 'Review', role: 'review', stage: 'review' };
const RE_REVIEW: CardMove = { label: 'Re-review', role: 'review', stage: 'review' };

/** Where a card's button can send it, likeliest first; the lane's rule decides what runs there. */
export function cardMoves(item: MovableCard, columnStage: BoardStageId): CardMove[] {
  if (item.board != null && item.board !== 'work' && item.board !== 'review') return [];
  if (isTerminalStage(columnStage)) return openPullRequestInDone(item, columnStage) ? [RE_REVIEW] : [];
  if (columnStage === 'review' && item.source !== 'github-pr' && item.source !== 'gitlab-pr') return [];
  if (item.source === 'github-issue') return [INVESTIGATE, BUILD];
  if (
    item.source === 'gitlab-issue' ||
    item.source === 'linear-issue' ||
    item.source === 'jira-issue' ||
    item.source === 'incidentio-follow-up'
  ) {
    return [INVESTIGATE, BUILD];
  }
  return item.source === 'github-pr' || item.source === 'gitlab-pr' ? [REVIEW] : [];
}

function openPullRequestInDone(item: MovableCard, columnStage: BoardStageId): boolean {
  return (
    columnStage === 'done' &&
    (item.source === 'github-pr' || item.source === 'gitlab-pr') &&
    ['open', 'draft'].includes(pullRequestStatusForItem({ ...item, stages: item.stages ?? [] }))
  );
}

function seatDepth(role: string): number {
  return Object.keys(FACTORY_ROLE_STAGES).indexOf(role);
}

/** Resume re-enters the last used working phase; legacy cards without a catalog fall back to their roles. */
export function resumeStage(
  columnStage: BoardStageId,
  sessions: Record<string, WorkItemSessionRef>,
  phases?: readonly { id: string; kind: string; role?: string }[],
  history: readonly { stage: string }[] = [],
): string | undefined {
  if (columnStage !== 'intake') return undefined;
  if (phases !== undefined) {
    const used = phases.filter(phase => phase.kind === 'working' && phase.role && sessions[phase.role]);
    return [...history].reverse().find(entry => used.some(phase => phase.id === entry.stage))?.stage ?? used.at(-1)?.id;
  }
  const deepest = Object.keys(sessions)
    .filter(isFactoryRole)
    .sort((left, right) => seatDepth(left) - seatDepth(right))
    .at(-1);
  return deepest === undefined ? undefined : FACTORY_ROLE_STAGES[deepest];
}

/** A suggested run wins over starting a rival run; resuming parked work comes next. */
export function cardPrimaryAction({
  item,
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
  resumeStage?: string;
  /** On a custom board, the first phase this one declares a transition to. */
  nextPhase?: { id: string; label: string };
  /** The card's own parked run, read from its status so the button says what the badge says. */
  waiting?: { label: string; decisionId: string };
  hasSession: boolean;
  onApproveProposal: (decisionId: string) => void;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onMove: (toStage: string) => void;
}): CardPrimaryAction | undefined {
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
  { href: string } | { start: () => void }
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
  const awaitsPerson = status.kind === 'waiting';
  const isUrgent = (action: CardAction) => action === retry || (awaitsPerson && action === namedRun);
  const rest = [session, namedRun].filter(action => action !== undefined).filter(action => action !== main);
  return [main, ...rest].map(action => ({ ...action, urgent: isUrgent(action) }));
}
