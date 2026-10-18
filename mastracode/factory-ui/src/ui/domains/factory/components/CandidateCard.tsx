import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { ArrowUpRight, EllipsisVertical } from 'lucide-react';
import type { ReactElement } from 'react';
import { useId } from 'react';

import { useCardMorph } from '../hooks/useCardMorph';
import { boardCardState } from '../boardCardState';
import type { BoardCandidate } from '../boardCandidates';
import { candidatePayload, setDragPayload } from '../boardDrag';
import { externalLinkLabel } from '../boardItems';
import type { BoardLayout } from '../boardLayout';
import { cardMoves } from '../cardPrimaryAction';
import type { CardMove } from '../cardPrimaryAction';
import { CardActions, CardDetailsHint, REVEAL_ON_CARD_HOVER } from './BoardCardParts';
import { actionIcon } from './BoardIcons';
import { CandidateCardRows } from './CandidateCardRows';
import { CandidateDetailsPanel } from './CandidateDetailsPanel';
import { CandidateListRow } from './CandidateListRow';

// Acting on it is what files the record.
export function CandidateCard({
  candidate,
  projectRepositoryId,
  factoryProjectId,
  onRun,
  layout,
}: {
  candidate: BoardCandidate;
  /** Repository id resolving GitHub descriptions in the detail panel. */
  projectRepositoryId: string;
  /** Factory project id resolving Linear descriptions in the detail panel. */
  factoryProjectId: string;
  /** File the candidate and move it into the lane; `prompt` undefined = no typed guidance. */
  onRun: (move: CardMove, prompt?: string) => void;
  layout: BoardLayout;
}) {
  const detailsTitleId = useId();
  const morph = useCardMorph();

  const moves = cardMoves(candidate, candidate.column);
  const [defaultMove] = moves;
  const { status } = boardCardState({});

  const menuItems: ReactElement[] = [
    ...moves.map(move => (
      <DropdownMenu.Item
        key={move.label}
        onClick={() => {
          morph.closeDetails();
          onRun(move);
        }}
      >
        {actionIcon(move.label)}
        <span>{move.label}</span>
      </DropdownMenu.Item>
    )),
    <DropdownMenu.Item key="source" render={<a href={candidate.url} target="_blank" rel="noreferrer" />}>
      <ArrowUpRight aria-hidden />
      <span>{externalLinkLabel(candidate.source)}</span>
    </DropdownMenu.Item>,
  ];

  const actions =
    defaultMove === undefined ? undefined : (
      <CardActions actions={[{ label: defaultMove.label, start: () => onRun(defaultMove) }]} />
    );

  const detailsPanel = (
    <CandidateDetailsPanel
      candidate={candidate}
      labelledBy={detailsTitleId}
      morph={morph}
      status={status}
      projectRepositoryId={projectRepositoryId}
      factoryProjectId={factoryProjectId}
      menu={menuItems}
      defaultMove={defaultMove}
      onRun={onRun}
    />
  );

  if (layout === 'list') {
    return (
      <>
        <CandidateListRow candidate={candidate} morph={morph} status={status} actions={actions} menu={menuItems} />
        {detailsPanel}
      </>
    );
  }

  return (
    <>
      <article
        ref={morph.cardRef}
        draggable
        aria-label={candidate.title}
        data-testid="candidate-card"
        onDragStart={event => setDragPayload(event, candidatePayload(candidate))}
        // Offscreen cards skip layout and paint; an Intake column can hold hundreds.
        className="group border-surface-rim bg-fill-subtle hover:bg-fill-hover rounded-card relative flex min-h-36 cursor-grab flex-col gap-3 border p-2 transition-colors outline-none [contain-intrinsic-size:auto_9rem] [content-visibility:auto] active:cursor-grabbing"
      >
        <button
          type="button"
          draggable={false}
          aria-label={`Details for ${candidate.title}`}
          aria-expanded={morph.open}
          className={`rounded-card absolute inset-0 cursor-pointer ${focusRingInset}`}
          onClick={morph.openDetails}
        />
        <CandidateCardRows
          candidate={candidate}
          status={status}
          actions={actions}
          controls={
            <>
              <CardDetailsHint onOpen={morph.openDetails} />
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${candidate.title}`}
                      className={REVEAL_ON_CARD_HOVER}
                    >
                      <EllipsisVertical size={13} aria-hidden />
                    </Button>
                  }
                />
                <DropdownMenu.Content align="end" className="min-w-44">
                  {menuItems}
                </DropdownMenu.Content>
              </DropdownMenu>
            </>
          }
        />
      </article>
      {detailsPanel}
    </>
  );
}
