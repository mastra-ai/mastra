import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, CircleSlash, FastForward, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';

import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import type { ItemRunSpec, RunAction } from '../boardRunSpecs';
import { externalLinkLabel } from '../boardItems';
import { itemStageOptions } from '../boardStages';
import type { FactoryDecisionSummary } from '../services/decisions';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { BoardStageIcon, actionIcon } from './BoardIcons';

export interface WorkItemMenuProps {
  item: WorkItem;
  columnStage: BoardStageId;
  runSpec?: ItemRunSpec;
  runActions: RunAction[];
  reReviewAction?: RunAction;
  laneAction?: RunAction;
  proposal?: FactoryDecisionSummary;
  proposedRunLabel?: string;
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
  runDisabled: boolean;
  approvingDecisionId?: string;
  onStartRun: (spec: ItemRunSpec, action: RunAction, options?: { preapprovePlans?: boolean }) => void;
  /** Re-run an action whose session slot is already used (e.g. re-review an updated PR). */
  onRestartRun: (spec: ItemRunSpec, action: RunAction, options?: { preapprovePlans?: boolean }) => void;
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}

/** An action's menu entries: the plain run and, unless a person must decide its outcome, a hands-off twin. */
function runItemPair(
  spec: ItemRunSpec,
  action: RunAction,
  label: string,
  startRun: WorkItemMenuProps['onStartRun'],
  { runDisabled, pendingRunRoles }: Pick<WorkItemMenuProps, 'runDisabled' | 'pendingRunRoles'>,
): ReactElement[] {
  const starting = pendingRunRoles.has(action.role);
  return [
    <DropdownMenu.Item key={label} disabled={runDisabled || starting} onClick={() => startRun(spec, action)}>
      {actionIcon(action.label)}
      <span>{starting ? 'Starting…' : label}</span>
    </DropdownMenu.Item>,
    ...(action.awaitsHumanDecision
      ? []
      : [
          <DropdownMenu.Item
            key={`${label} hands-off`}
            disabled={runDisabled || starting}
            onClick={() => startRun(spec, action, { preapprovePlans: true })}
          >
            <FastForward aria-hidden />
            <span>{`${label} hands-off`}</span>
          </DropdownMenu.Item>,
        ]),
  ];
}

export function WorkItemMenuItems({
  item,
  columnStage,
  runSpec,
  runActions,
  reReviewAction,
  laneAction,
  proposal,
  proposedRunLabel,
  pendingRunRoles,
  runDisabled,
  approvingDecisionId,
  onStartRun,
  onRestartRun,
  onApproveProposal,
  onDismissProposal,
  onMove,
  onRemove,
}: WorkItemMenuProps): ReactElement {
  return (
    <>
      {runSpec !== undefined &&
        runActions.flatMap(action =>
          runItemPair(runSpec, action, action.label, onStartRun, { runDisabled, pendingRunRoles }),
        )}
      {runSpec !== undefined &&
        reReviewAction !== undefined &&
        runItemPair(runSpec, reReviewAction, 'Re-review', onRestartRun, { runDisabled, pendingRunRoles })}
      {runSpec !== undefined &&
        laneAction !== undefined &&
        runItemPair(runSpec, laneAction, laneAction.label, onRestartRun, { runDisabled, pendingRunRoles })}
      {/* Once the card has a live session its surface opens details, so the
          menus stay the only place left to release a proposed run. */}
      {proposal !== undefined && (
        <DropdownMenu.Item
          disabled={runDisabled || approvingDecisionId === proposal.id}
          onClick={() => onApproveProposal(proposal.id)}
        >
          {actionIcon(proposedRunLabel ?? 'Start run')}
          <span>{approvingDecisionId === proposal.id ? 'Starting…' : 'Start suggested run'}</span>
        </DropdownMenu.Item>
      )}
      {proposal !== undefined && (
        <DropdownMenu.Item onClick={() => onDismissProposal(proposal.id)}>
          <CircleSlash aria-hidden />
          <span>Dismiss suggested run</span>
        </DropdownMenu.Item>
      )}
      {item.url !== null && (
        <DropdownMenu.Item render={<a href={item.url} target="_blank" rel="noreferrer" />}>
          <ArrowUpRight aria-hidden />
          <span>{externalLinkLabel(item.source)}</span>
        </DropdownMenu.Item>
      )}
      {itemStageOptions(item)
        .filter(stage => stage.id !== columnStage)
        .map(stage => (
          <DropdownMenu.Item key={stage.id} onClick={() => onMove(stage.id)}>
            <BoardStageIcon stage={stage.id} />
            <span>{stage.id === 'done' ? 'Mark done' : `Move to ${stage.label}`}</span>
          </DropdownMenu.Item>
        ))}
      <DropdownMenu.Item onClick={onRemove}>
        <Trash2 aria-hidden />
        <span>Remove</span>
      </DropdownMenu.Item>
    </>
  );
}
