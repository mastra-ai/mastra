import { FACTORY_ROLE_STAGES, isFactoryRole } from '@mastra/factory/rules/types';
import type { FactoryRuleStage } from '@mastra/factory/rules/types';
import { itemSessionSpec } from './boardRunSpecs';
import type { ItemRunSpec, RunAction } from './boardRunSpecs';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem, WorkItemSessionRef } from './services/workItems';
import type { BoardStageId } from './stages';

export interface CardPrimaryAction {
  label: string;
  start: () => void;
}

export type ResumeTarget = { kind: 'run'; action: RunAction } | { kind: 'move'; stage: FactoryRuleStage };

function seatDepth(role: string): number {
  return Object.keys(FACTORY_ROLE_STAGES).indexOf(role);
}

/**
 * Resume re-enters the deepest used seat: startable seats restart their run,
 * rule-only seats (plan) re-enter their lane and let the entry rule dispatch.
 */
export function resumeTarget(
  columnStage: BoardStageId,
  runSpec: ItemRunSpec | undefined,
  sessions: Record<string, WorkItemSessionRef>,
): ResumeTarget | undefined {
  if (columnStage !== 'intake') return undefined;
  const deepest = Object.keys(sessions)
    .filter(isFactoryRole)
    .sort((left, right) => seatDepth(left) - seatDepth(right))
    .at(-1);
  if (deepest === undefined) return undefined;
  const action = runSpec?.actions.find(candidate => candidate.role === deepest);
  return action !== undefined ? { kind: 'run', action } : { kind: 'move', stage: FACTORY_ROLE_STAGES[deepest] };
}

/** A proposed run wins the primary slot: releasing it beats starting a rival run beside it. Resuming parked work comes next, for the same reason. */
export function cardPrimaryAction({
  item,
  runSpec,
  runAction,
  resume,
  proposal,
  hasSession,
  onApproveProposal,
  onStartRun,
  onRestartRun,
  onCreateSession,
  onMove,
}: {
  item: WorkItem;
  runSpec?: ItemRunSpec;
  runAction?: RunAction;
  resume?: ResumeTarget;
  proposal?: FactoryDecisionSummary;
  hasSession: boolean;
  onApproveProposal: (decisionId: string) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onRestartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onMove: (toStage: string) => void;
}): CardPrimaryAction | undefined {
  if (proposal !== undefined) {
    const proposed = runSpec?.actions.find(action => action.role === proposal.role) ?? runAction;
    const label = proposed?.label ?? 'Start run';
    return { label, start: () => onApproveProposal(proposal.id) };
  }
  if (resume?.kind === 'move') {
    const stage = resume.stage;
    return { label: 'Resume', start: () => onMove(stage) };
  }
  if (resume?.kind === 'run' && runSpec !== undefined) {
    const action = resume.action;
    return {
      label: 'Resume',
      start: () => onRestartRun(runSpec, action),
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
