import { itemSessionSpec } from './boardRunSpecs';
import type { ItemRunSpec, RunAction } from './boardRunSpecs';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem, WorkItemSessionRef } from './services/workItems';
import type { BoardStageId } from './stages';

export interface CardPrimaryAction {
  label: string;
  start: () => void;
}

/** A card parked in Intake resumes its deepest used seat — the run it was pulled out of. */
export function resumeRunAction(
  columnStage: BoardStageId,
  runSpec: ItemRunSpec | undefined,
  sessions: Record<string, WorkItemSessionRef>,
): RunAction | undefined {
  if (columnStage !== 'intake') return undefined;
  return runSpec?.actions.findLast(action => action.role in sessions);
}

/** A proposed run wins the primary slot: releasing it beats starting a rival run beside it. Resuming parked work comes next, for the same reason. */
export function cardPrimaryAction({
  item,
  runSpec,
  runAction,
  resumeAction,
  proposal,
  hasSession,
  onApproveProposal,
  onStartRun,
  onRestartRun,
  onCreateSession,
}: {
  item: WorkItem;
  runSpec?: ItemRunSpec;
  runAction?: RunAction;
  resumeAction?: RunAction;
  proposal?: FactoryDecisionSummary;
  hasSession: boolean;
  onApproveProposal: (decisionId: string) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onRestartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
}): CardPrimaryAction | undefined {
  if (proposal !== undefined) {
    const proposed = runSpec?.actions.find(action => action.role === proposal.role) ?? runAction;
    const label = proposed?.label ?? 'Start run';
    return { label, start: () => onApproveProposal(proposal.id) };
  }
  if (runSpec !== undefined && resumeAction !== undefined) {
    return {
      label: 'Resume',
      start: () => onRestartRun(runSpec, resumeAction),
    };
  }
  if (runSpec !== undefined && runAction !== undefined) {
    return {
      label: runAction.label,
      start: () => onStartRun(runSpec, runAction),
    };
  }
  // Every run this card offers is already taken by a live session, so opening that session is the action.
  if (hasSession) return undefined;
  return {
    label: 'Start session',
    start: () => onCreateSession(itemSessionSpec(item)),
  };
}
