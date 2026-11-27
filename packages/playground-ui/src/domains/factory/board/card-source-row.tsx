import type { ReactNode } from 'react';

import { CARD_SOURCES } from './card-sources';
import type { CardSource } from './card-sources';

import { Badge } from '@/ds/components/Badge';
import { cn } from '@/utils/cn';

export function CardSourceIcon({ source, className }: { source: CardSource; className?: string }) {
  const { Icon, iconClassName, label } = CARD_SOURCES[source];
  return <Icon aria-label={label} role="img" className={cn('size-3.5 shrink-0', iconClassName, className)} />;
}

export interface CardSourceRowProps {
  source: CardSource;
  /** Short reference shown next to the mark, e.g. `#117` or `ENG-42`. */
  reference?: string;
  url?: string;
  /** Upstream state such as `open` or `closed`. */
  state?: string;
  labels?: ReactNode;
}

/** The card's upstream: brand mark, reference link and state. */
export function CardSourceRow({ source, reference, url, state, labels }: CardSourceRowProps) {
  const presentation = CARD_SOURCES[source];
  const text = reference ?? presentation.label;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${presentation.linkLabel}: ${text}`}
          className="flex items-center gap-1.5 text-meta text-muted-foreground hover:text-foreground"
        >
          <CardSourceIcon source={source} />
          {text}
        </a>
      ) : (
        <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
          <CardSourceIcon source={source} />
          {text}
        </span>
      )}
      {state && (
        <Badge size="xs" variant="neutral" aria-label={`Source state: ${state}`}>
          {state}
        </Badge>
      )}
      {labels}
    </div>
  );
}
