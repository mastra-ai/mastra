import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import type { BoardCardStatus } from '../boardCardStatus';
import { externalLinkLabel, metadataLabels } from '../boardItems';
import { CardLabels, CardStatus, REVEAL_ON_CARD_HOVER, SourceTitle } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';

// The card and its open copy draw these same rows, so opening moves nothing.
export function CandidateCardRows({
  candidate,
  status,
  titleId,
  controls,
  actions,
}: {
  candidate: BoardCandidate;
  status: BoardCardStatus;
  titleId?: string;
  /** Absolute in the corner: inline, its height would push every row down. */
  controls: ReactNode;
  /** The copy's own row under the card's. */
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">{controls}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-ui-xs text-icon2 truncate pr-16">{candidate.meta}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <SourceIcon source={candidate.source} />
          <span className="text-ui-smd text-icon6 min-w-0 flex-1 truncate font-semibold">
            <SourceTitle source={candidate.source} title={candidate.title} id={titleId} />
          </span>
          {/* Triage reads the source before deciding, so keep it one click away. */}
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            aria-label={externalLinkLabel(candidate.source)}
            className={cn('text-icon3 hover:text-icon5 relative shrink-0', REVEAL_ON_CARD_HOVER)}
          >
            <ArrowUpRight size={12} aria-hidden />
          </a>
        </div>
      </div>
      <CardLabels labels={metadataLabels(candidate.metadata)} />
      <CardStatus status={status} />
      {actions}
    </>
  );
}
