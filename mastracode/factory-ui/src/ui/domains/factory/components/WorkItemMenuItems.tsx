import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, CircleSlash, ShieldCheck, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';

import { externalLinkLabel, githubNumberForItem } from '../boardItems';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { itemBoard, itemStageOptions } from '../boardStages';
import { canMoveTo } from '../boardCardState';
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
  // On a custom board a proposal the card could not label belongs to another board; hide it entirely.
  const suggestion = custom && proposedRunLabel === undefined ? undefined : proposal;
  // A held card leads with the maintainer's decision. Nothing that starts,
  // restarts, or releases a run is offered until the card is accepted: every
  // one of those would advance it as a side effect. Dismissing a stale
  // suggestion stays, since that starts nothing.
  const awaitsTriage = !custom && awaitsTriageDecision(item, columnStage);
  const canStartRun = owner.kind === 'free';
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
      {!awaitsTriage && moves.map(move => moveItem(move, onMove, !canStartRun))}
      {suggestion !== undefined && !awaitsTriage && (
        <DropdownMenu.Item disabled={!canStartRun} onClick={() => onApproveProposal(suggestion.id)}>
          {actionIcon(proposedRunLabel ?? 'Start run')}
          <span>{approvingDecisionId === suggestion.id ? 'Starting…' : 'Start suggested run'}</span>
        </DropdownMenu.Item>
      )}
      {suggestion !== undefined && (
        <DropdownMenu.Item onClick={() => onDismissProposal(suggestion.id)}>
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
      <DropdownMenu.Item onClick={onRemove}>
        <Trash2 aria-hidden />
        <span>Remove</span>
      </DropdownMenu.Item>
    </>
  );
}
