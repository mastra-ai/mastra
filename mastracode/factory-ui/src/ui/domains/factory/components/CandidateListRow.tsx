import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import type { BoardCardStatus } from '../boardCardStatus';
import { candidatePayload } from '../boardDrag';
import { externalLinkLabel, sourceCreatedAt, workItemKey } from '../boardItems';
import type { CardMorph } from '../hooks/useCardMorph';
import { CardStatus, MetadataLabels, REVEAL_ON_CARD_HOVER, SourceTitle } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { BoardListRow } from './BoardListRow';

export function CandidateListRow({
  candidate,
  morph,
  status,
  actions,
  menu,
}: {
  candidate: BoardCandidate;
  morph: CardMorph;
  status: BoardCardStatus;
  actions?: ReactNode;
  menu: ReactNode;
}) {
  return (
    <BoardListRow
      testId="candidate-card"
      title={candidate.title}
      cardRef={morph.setCardElement}
      expanded={morph.open}
      onOpen={morph.openDetails}
      dragPayload={candidatePayload(candidate)}
      menu={menu}
      createdAt={sourceCreatedAt(candidate.metadata)}
      cells={{
        icon: <SourceIcon source={candidate.source} />,
        key: workItemKey(candidate),
        title: (
          <span className="flex min-w-0 items-center gap-1.5">
            <Txt as="span" variant="label" tone="ink" className="min-w-0 truncate font-[550] tracking-tight">
              <SourceTitle source={candidate.source} title={candidate.title} />
            </Txt>
            <a
              href={candidate.url}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              aria-label={externalLinkLabel(candidate.source)}
              onClick={event => event.stopPropagation()}
              className={cn('text-muted-foreground hover:text-foreground shrink-0', REVEAL_ON_CARD_HOVER)}
            >
              <ArrowUpRight size={12} aria-hidden />
            </a>
          </span>
        ),
        labels: <MetadataLabels metadata={candidate.metadata} />,
        status: <CardStatus status={status} />,
        action: actions,
      }}
    />
  );
}
