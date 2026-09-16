import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, EllipsisVertical, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useId } from 'react';

import { useCardMorph } from '../hooks/useCardMorph';
import { boardCardStatus } from '../boardCardStatus';
import type { BoardCandidate } from '../boardCandidates';
import { setDragPayload } from '../boardDrag';
import { externalLinkLabel } from '../boardItems';
import { cardMoves } from '../cardPrimaryAction';
import type { CardMove } from '../cardPrimaryAction';
import { CardActions, CardDetailsHint, REVEAL_ON_CARD_HOVER } from './BoardCardParts';
import { actionIcon } from './BoardIcons';
import { CandidateCardRows } from './CandidateCardRows';
import { CandidateDetailsPanel } from './CandidateDetailsPanel';

// Acting on it is what files the record.
export function CandidateCard({
  candidate,
  projectRepositoryId,
  factoryProjectId,
  onRun,
  onFile,
}: {
  candidate: BoardCandidate;
  /** Repository id resolving GitHub descriptions in the detail panel. */
  projectRepositoryId: string;
  /** Factory project id resolving Linear descriptions in the detail panel. */
  factoryProjectId: string;
  /** File the candidate and move it into the lane; `prompt` undefined = no typed guidance. */
  onRun: (move: CardMove, prompt?: string) => void;
  onFile: () => void;
}) {
  const detailsTitleId = useId();
  const morph = useCardMorph();

  const moves = cardMoves(candidate, candidate.column);
  const [defaultMove] = moves;
  const status = boardCardStatus({});

  const fileFromDetails = () => {
    morph.closeDetails();
    onFile();
  };

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
    <DropdownMenu.Item key="file" onClick={fileFromDetails}>
      <Plus aria-hidden />
      <span>Add to board</span>
    </DropdownMenu.Item>,
    <DropdownMenu.Item key="source" render={<a href={candidate.url} target="_blank" rel="noreferrer" />}>
      <ArrowUpRight aria-hidden />
      <span>{externalLinkLabel(candidate.source)}</span>
    </DropdownMenu.Item>,
  ];

  return (
    <>
      <article
        ref={morph.cardRef}
        draggable
        aria-label={candidate.title}
        data-testid="candidate-card"
        onDragStart={event =>
          setDragPayload(event, {
            kind: 'candidate',
            candidate: {
              source: candidate.source,
              sourceKey: candidate.sourceKey,
              title: candidate.title,
              url: candidate.url,
              metadata: candidate.metadata,
            },
          })
        }
        // Offscreen cards skip layout and paint; an Intake column can hold hundreds.
        className="group border-border1/50 bg-neutral6/5 hover:bg-surface3 rounded-card relative flex min-h-36 cursor-grab flex-col gap-3 border p-2 transition-colors outline-none [contain-intrinsic-size:auto_9rem] [content-visibility:auto] active:cursor-grabbing"
      >
        <button
          type="button"
          draggable={false}
          aria-label={`Details for ${candidate.title}`}
          aria-expanded={morph.open}
          className="focus-visible:outline-accent1 rounded-card absolute inset-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={morph.openDetails}
        />
        <CandidateCardRows
          candidate={candidate}
          status={status}
          actions={
            defaultMove === undefined ? undefined : (
              <CardActions actions={[{ label: defaultMove.label, start: () => onRun(defaultMove) }]} />
            )
          }
          controls={
            <>
              <CardDetailsHint />
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
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
    </>
  );
}
