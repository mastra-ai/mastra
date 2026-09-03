import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, CircleSlash, FastForward, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { externalLinkLabel } from '../boardItems';
import { itemStageOptions } from '../boardStages';
import { TRIAGE_DECISIONS, awaitsTriageDecision } from '../cardPrimaryAction';
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
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onMove: (toStage: string, options?: { preapprovePlans?: boolean }) => void;
  onRemove: () => void;
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
  // A held card leads with the maintainer's decision. Nothing that starts,
  // restarts, or releases a run is offered until the card is accepted: every
  // one of those would advance it as a side effect. Dismissing a stale
  // suggestion stays, since that starts nothing.
  const decision = awaitsTriageDecision(item, columnStage);
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
      {proposal !== undefined && !decision && (
        <DropdownMenu.Item
          disabled={approvingDecisionId === proposal.id}
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
        .filter(stage => !decision || !TRIAGE_DECISIONS.some(choice => choice.stage === stage.id))
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
