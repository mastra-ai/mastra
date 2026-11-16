import type { SessionRowStatus } from '@mastra/factory/session/session-row-status';

import type { InstalledBoardInfo } from '../../../api/types';
import { boardCardState } from './boardCardState';
import { boardLoop } from './boardFlow';
import {
  awaitsTriageDecision,
  cardActions,
  cardMoves,
  cardPrimaryAction,
  resumeStage,
  retryButton,
} from './cardPrimaryAction';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem } from './services/workItems';
import type { BoardStageId } from './stages';
import { movingCardStatus, nextBoardPhase, primaryCardMove, proposedCardRun } from './workItemCardPresentation';

interface CardControlsInput {
  item: WorkItem;
  definition: InstalledBoardInfo | undefined;
  columnStage: BoardStageId;
  /** Destination stage of an in-flight transition; undefined = not moving. */
  evaluatingStage?: string;
  transitionReason?: string;
  decision?: FactoryDecisionSummary;
  /** The decision's place in the run queue while it waits for a run slot. */
  queuePosition?: number;
  /** Run a rule wants to start on this card, waiting for someone to release it. */
  proposal?: FactoryDecisionSummary;
  approvingDecisionId?: string;
  retryingDecisionId?: string;
  /** Live status of the card's bound sessions. */
  sessionStatus?: SessionRowStatus;
  onApproveProposal: (decisionId: string) => void;
  onRetryDecision: (decisionId: string) => void;
  onMove: (toStage: string) => void;
}

/** What a card says about itself and the buttons it offers, wherever it renders. */
export function cardControls({
  item,
  definition,
  columnStage,
  evaluatingStage,
  transitionReason,
  decision,
  queuePosition,
  proposal,
  approvingDecisionId,
  retryingDecisionId,
  sessionStatus,
  onApproveProposal,
  onRetryDecision,
  onMove,
}: CardControlsInput) {
  // A board without a pull request loop advances cards through its own phases instead.
  const custom = boardLoop(definition) === undefined;
  const sessions = item.sessions;
  const moves = cardMoves(item, columnStage, definition);
  const primaryMove = primaryCardMove(moves, columnStage, { sessions, stageHistory: item.stageHistory });
  const proposedRun = proposedCardRun(proposal, custom, definition, moves, primaryMove);
  const state = boardCardState({
    proposal: proposedRun,
    moving: movingCardStatus(evaluatingStage, definition),
    preparing: proposal !== undefined && approvingDecisionId === proposal.id ? 'Starting…' : undefined,
    retryRequested: decision !== undefined && retryingDecisionId === decision.id,
    decision,
    queuePosition,
    transitionReason,
    sessionStatus,
    held: awaitsTriageDecision(item, columnStage, definition),
  });
  const { status } = state;
  const run = cardPrimaryAction({
    item,
    board: definition,
    columnStage,
    move: primaryMove,
    resumeStage: resumeStage(columnStage, { sessions, stageHistory: item.stageHistory }, definition),
    nextPhase: custom ? nextBoardPhase(definition, columnStage) : undefined,
    waiting: status.kind === 'waiting' ? status : undefined,
    onApproveProposal,
    onMove,
  });
  // A held card's decision, like a parked suggestion, is the person's to
  // release, so it stays on the card beside a finished triage session.
  const actions = cardActions({
    state,
    retry: retryButton({
      decisionId: status.kind === 'error' ? status.retryDecisionId : undefined,
      onRetry: onRetryDecision,
    }),
    run,
  });
  return { moves, proposedRunLabel: proposedRun?.label, state, actions };
}
