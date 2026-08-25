import { itemSessionSpec } from './boardRunSpecs';
import type { ItemRunSpec, RunAction } from './boardRunSpecs';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem } from './services/workItems';

export interface CardPrimaryAction {
  label: string;
  start: () => void;
}

/** A proposed run wins the primary slot: releasing it beats starting a rival run beside it. */
export function cardPrimaryAction({
  item,
  runSpec,
  runAction,
  proposal,
  hasSession,
  onApproveProposal,
  onStartRun,
  onCreateSession,
}: {
  item: WorkItem;
  runSpec?: ItemRunSpec;
  runAction?: RunAction;
  proposal?: FactoryDecisionSummary;
  hasSession: boolean;
  onApproveProposal: (decisionId: string) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
}): CardPrimaryAction | undefined {
  if (proposal !== undefined) {
    const proposed = runSpec?.actions.find(action => action.role === proposal.role) ?? runAction;
    const label = proposed?.label ?? 'Start run';
    return { label, start: () => onApproveProposal(proposal.id) };
  }
  if (runSpec !== undefined && runAction !== undefined) {
    return {
      label: runAction.label,
      start: () => onStartRun(runSpec, runAction),
    };
  }
  // Every run this card offers is already taken by a live session, so the card
  // has nowhere new to start: opening the session it has is the action.
  if (hasSession) return undefined;
  return {
    label: 'Start session',
    start: () => onCreateSession(itemSessionSpec(item)),
  };
}
