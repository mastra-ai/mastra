import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, CircleSlash, Trash2 } from 'lucide-react';
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
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  /** Re-run an action whose session slot is already used (e.g. re-review an updated PR). */
  onRestartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}

/** Menu entries shared by the card's hover menu and the detail panel's footer menu. */
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
        runActions.map(action => {
          const starting = pendingRunRoles.has(action.role);
          return (
            <DropdownMenu.Item
              key={action.label}
              disabled={runDisabled || starting}
              onClick={() => onStartRun(runSpec, action)}
            >
              {actionIcon(action.label)}
              <span>{starting ? 'Starting…' : action.label}</span>
            </DropdownMenu.Item>
          );
        })}
      {runSpec !== undefined && reReviewAction !== undefined && (
        <DropdownMenu.Item
          disabled={runDisabled || pendingRunRoles.has(reReviewAction.role)}
          onClick={() => onRestartRun(runSpec, reReviewAction)}
        >
          {actionIcon(reReviewAction.label)}
          <span>{pendingRunRoles.has(reReviewAction.role) ? 'Starting…' : 'Re-review'}</span>
        </DropdownMenu.Item>
      )}
      {runSpec !== undefined && laneAction !== undefined && (
        <DropdownMenu.Item
          disabled={runDisabled || pendingRunRoles.has(laneAction.role)}
          onClick={() => onRestartRun(runSpec, laneAction)}
        >
          {actionIcon(laneAction.label)}
          <span>{pendingRunRoles.has(laneAction.role) ? 'Starting…' : laneAction.label}</span>
        </DropdownMenu.Item>
      )}
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
