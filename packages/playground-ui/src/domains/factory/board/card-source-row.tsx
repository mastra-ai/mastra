import type { ReactNode } from 'react';

import { CARD_SOURCES, outboundArrowClass } from './card-sources';
import type { CardSource } from './card-sources';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { cn } from '@/utils/cn';

/** The brand mark of where a card came from; decorative, the label is read out beside it. */
export function CardSourceIcon({ source, className }: { source: CardSource; className?: string }) {
  const { Icon, iconClassName } = CARD_SOURCES[source];
  return <Icon data-source={source} className={cn('size-4 shrink-0', iconClassName, className)} aria-hidden />;
}

/** Upstream state such as `open` or `closed`. */
export function SourceStateBadge({ state, className }: { state: string | undefined; className?: string }) {
  if (!state) return null;
  return (
    <Badge size="xs" variant="neutral" className={cn('shrink-0', className)} aria-label={`Source state: ${state}`}>
      {state}
    </Badge>
  );
}

export interface CardSourceRowProps {
  /** How the upstream reads, e.g. `#117`, `mastra-ai/office#117` or `ENG-42`. */
  reference: string;
  url?: string;
  /** Upstream state such as `open` or `closed`. */
  state?: string;
  /** The card's labels, e.g. `MetadataLabels`; omit when there are none. */
  labels?: ReactNode;
}

/** A card's upstream in its overview: the reference linking out, its state, and the labels under them. */
export function CardSourceRow({ reference, url, state, labels }: CardSourceRowProps) {
  if (!url && !state && !labels) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {url || state ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {url ? (
            <Button
              iconEnd={<IconArrowUpRight className={outboundArrowClass} />}
              render={<a href={url} target="_blank" rel="noreferrer" />}
              variant="ghost"
              size="sm"
              className="group/outbound min-w-0"
              aria-label={`Open ${reference}`}
            >
              <span className="truncate">{reference}</span>
            </Button>
          ) : null}
          <SourceStateBadge state={state} />
        </div>
      ) : null}
      {labels ? <div className="px-2">{labels}</div> : null}
    </div>
  );
}
