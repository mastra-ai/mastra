import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, CircleSlash, ShieldCheck, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';

import { externalLinkLabel, githubNumberForItem } from '../boardItems';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { itemBoard, itemStageOptions } from '../boardStages';
import { canMoveTo, canStartRun } from '../boardCardState';
import type { BoardCardOwner } from '../boardCardState';
import { TRIAGE_DECISIONS, awaitsTriageDecision } from '../cardPrimaryAction';
import type { CardMove } from '../cardPrimaryAction';
import { workItemPrompt } from '../../supervisor/services/supervisor';
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

/** Deep link into the Supervisor chat with a question about this card prefilled. */
export function askSupervisorPath(
  factoryId: string | undefined,
  item: Pick<WorkItem, 'id' | 'source' | 'metadata' | 'title'>,
) {
  const number = githubNumberForItem(item);
  const ask = workItemPrompt({ id: item.id, title: item.title, ...(number ? { number } : {}) });
  return `/factories/${factoryId}/supervisor?ask=${encodeURIComponent(ask)}`;
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
  const { factoryId } = useParams<{ factoryId: string }>();
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
  // Every run-starting action would accept a held card as a side effect, so triage choices replace them.
  const awaitsTriage = !custom && awaitsTriageDecision(item, columnStage);
  const runsBlocked = !canStartRun(owner.kind);
  const yourRequestInFlight = owner.kind === 'you';
  const phaseKind = (stage: string) => board?.phases.find(phase => phase.id === stage)?.kind;
  return (
    <>
      {awaitsTriage &&
        TRIAGE_DECISIONS.map(choice => (
          <DropdownMenu.Item
            key={choice.stage}
            disabled={!canMoveTo(owner.kind, phaseKind(choice.stage))}
            onClick={() => onMove(choice.stage)}
          >
            <BoardStageIcon stage={choice.stage} />
            <span>{choice.label}</span>
          </DropdownMenu.Item>
        ))}
      {!awaitsTriage && moves.map(move => moveItem(move, onMove, runsBlocked))}
      {suggestionForThisBoard !== undefined && !awaitsTriage && (
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
      <DropdownMenu.Item render={<Link to={askSupervisorPath(factoryId, item)} />}>
        <ShieldCheck aria-hidden />
        <span>Ask supervisor</span>
      </DropdownMenu.Item>
      {stages
        .filter(stage => stage.id !== columnStage)
        .filter(stage => !awaitsTriage || !TRIAGE_DECISIONS.some(choice => choice.stage === stage.id))
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
