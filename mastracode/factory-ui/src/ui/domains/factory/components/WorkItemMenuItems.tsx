import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, CircleSlash, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { externalLinkLabel } from '../boardItems';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { itemBoard, itemStageOptions } from '../boardStages';
import { canMoveTo, canStartRun } from '../boardCardState';
import type { BoardCardOwner } from '../boardCardState';
import type { CardMove } from '../cardPrimaryAction';
import type { FactoryDecisionSummary } from '../services/decisions';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { BoardStageIcon, actionIcon } from './BoardIcons';

export interface WorkItemMenuProps {
  item: WorkItem;
  columnStage: BoardStageId;
  moves: CardMove[];
  proposal?: FactoryDecisionSummary;
  proposedRunLabel?: string;
  approvingDecisionId?: string;
  owner: BoardCardOwner;
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}

/** A lane's available move. Plan approval remains a separate human decision. */
function moveItem(move: CardMove, onMove: WorkItemMenuProps['onMove'], disabled: boolean): ReactElement {
  return (
    <DropdownMenu.Item key={move.label} disabled={disabled} onClick={() => onMove(move.stage)}>
      {actionIcon(move.label)}
      <span>{move.label}</span>
    </DropdownMenu.Item>
  );
}

export function WorkItemMenuItems({
  item,
  columnStage,
  moves,
  proposal,
  proposedRunLabel,
  approvingDecisionId,
  owner,
  onApproveProposal,
  onDismissProposal,
  onMove,
  onRemove,
}: WorkItemMenuProps): ReactElement {
  const catalog = useBoardCatalog(item.githubProjectId);
  const boardId = itemBoard(item);
  const custom = boardId !== 'work' && boardId !== 'review';
  const board = catalog.data?.find(candidate => candidate.id === boardId);
  const targets = board?.phases.find(phase => phase.id === columnStage)?.transitions ?? [];
  const stages = custom
    ? (board?.phases
        .filter(phase => targets.some(target => target.to === phase.id))
        .map(phase => ({ id: phase.id, label: phase.title, kind: phase.kind })) ?? [])
    : itemStageOptions(item).map(stage => ({ ...stage, kind: undefined }));
  const suggestionForThisBoard = custom && proposedRunLabel === undefined ? undefined : proposal;
  const runsBlocked = !canStartRun(owner.kind);
  const yourRequestInFlight = owner.kind === 'you';
  const phaseKind = (stage: string) => board?.phases.find(phase => phase.id === stage)?.kind;
  return (
    <>
      {moves.map(move => moveItem(move, onMove, runsBlocked))}
      {suggestionForThisBoard !== undefined && (
        <DropdownMenu.Item disabled={runsBlocked} onClick={() => onApproveProposal(suggestionForThisBoard.id)}>
          {actionIcon(proposedRunLabel ?? 'Start run')}
          <span>{approvingDecisionId === suggestionForThisBoard.id ? 'Starting…' : 'Start suggested run'}</span>
        </DropdownMenu.Item>
      )}
      {suggestionForThisBoard !== undefined && (
        <DropdownMenu.Item disabled={yourRequestInFlight} onClick={() => onDismissProposal(suggestionForThisBoard.id)}>
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
      {stages
        .filter(stage => stage.id !== columnStage)
        .map(stage => (
          <DropdownMenu.Item
            key={stage.id}
            disabled={!canMoveTo(owner.kind, phaseKind(stage.id))}
            onClick={() => onMove(stage.id)}
          >
            <BoardStageIcon stage={stage.id} kind={stage.kind} decorative />
            <span>{stage.id === 'done' ? 'Mark done' : `Move to ${stage.label}`}</span>
          </DropdownMenu.Item>
        ))}
      <DropdownMenu.Item disabled={yourRequestInFlight} onClick={onRemove}>
        <Trash2 aria-hidden />
        <span>Remove</span>
      </DropdownMenu.Item>
    </>
  );
}
