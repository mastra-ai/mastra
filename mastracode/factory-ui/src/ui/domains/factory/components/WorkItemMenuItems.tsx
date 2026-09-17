import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, CircleSlash, FastForward, ShieldCheck, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';

import { externalLinkLabel, githubNumberForItem } from '../boardItems';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { itemBoard, itemStageOptions } from '../boardStages';
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
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onMove: (toStage: string, options?: { preapprovePlans?: boolean }) => void;
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

/** A lane's menu entries: the plain move and, unless a person must decide its outcome, a hands-off twin. */
function moveItemPair(move: CardMove, onMove: WorkItemMenuProps['onMove']): ReactElement[] {
  return [
    <DropdownMenu.Item key={move.label} onClick={() => onMove(move.stage)}>
      {actionIcon(move.label)}
      <span>{move.label}</span>
    </DropdownMenu.Item>,
    ...(move.awaitsHumanDecision
      ? []
      : [
          <DropdownMenu.Item
            key={`${move.label} hands-off`}
            onClick={() => onMove(move.stage, { preapprovePlans: true })}
          >
            <FastForward aria-hidden />
            <span>{`${move.label} hands-off`}</span>
          </DropdownMenu.Item>,
        ]),
  ];
}

export function WorkItemMenuItems({
  item,
  columnStage,
  moves,
  proposal,
  proposedRunLabel,
  approvingDecisionId,
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
  const decision = !custom && awaitsTriageDecision(item, columnStage);
  return (
    <>
      {decision &&
        TRIAGE_DECISIONS.map(choice => (
          <DropdownMenu.Item key={choice.stage} onClick={() => onMove(choice.stage)}>
            <BoardStageIcon stage={choice.stage} />
            <span>{choice.label}</span>
          </DropdownMenu.Item>
        ))}
      {!decision && moves.flatMap(move => moveItemPair(move, onMove))}
      {/* Once the card has a live session its surface opens details, so the
          menus stay the only place left to release a proposed run. */}
      {suggestion !== undefined && !decision && (
        <DropdownMenu.Item
          disabled={approvingDecisionId === suggestion.id}
          onClick={() => onApproveProposal(suggestion.id)}
        >
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
        .filter(stage => !decision || !TRIAGE_DECISIONS.some(choice => choice.stage === stage.id))
        .map(stage => (
          <DropdownMenu.Item key={stage.id} onClick={() => onMove(stage.id)}>
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
