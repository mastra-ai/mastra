import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconChevronTopMedium } from '@/ds/icons/central/IconChevronTopMedium';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';

/**
 * The end of the intake order: where a new issue or pull request lands when no board's rules take it, with the recent
 * ones listed under it. Route again files one after its rules or labels change.
 */
export function NotRoutedCard({
  id,
  defaultOpen,
  count,
  pending,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  children,
}: {
  /** The section's id, the anchor a link to the card points at. */
  id: string;
  /** Starts with the items shown, such as when a link pointed at the card. */
  defaultOpen: boolean;
  /** Items loaded so far. */
  count: number;
  pending: boolean;
  error: boolean;
  /** More items wait after the loaded ones. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** The loaded items, each a `NotRoutedItem`. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const listed = count > 0 || hasMore;

  return (
    <section
      id={id}
      aria-label="Not routed"
      className={cn(raisedSurfaceStyle, 'flex scroll-mt-4 flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3')}
    >
      <header className="flex min-h-5.5 items-center gap-2">
        <IconCircleDashed className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
        <Txt as="h2" variant="card-title-strong" tone="ink">
          Not routed
        </Txt>
        <Txt as="span" variant="caption" tone="muted" className="min-w-0 flex-1 truncate">
          {notRoutedSummary({ pending, error, hasMore }, count)}
        </Txt>
        {listed && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-expanded={open}
            tooltip={open ? 'Hide items not routed' : 'Show items not routed'}
            onClick={() => setOpen(!open)}
          >
            {open ? <IconChevronTopMedium /> : <IconChevronDownMedium />}
          </Button>
        )}
      </header>
      {!listed && !pending && !error && (
        <Txt as="p" variant="caption" tone="muted">
          A new issue or pull request ends up here when no board’s rules take it.
        </Txt>
      )}
      {open && listed && (
        <ul aria-label="Items not routed" className="flex flex-col">
          {children}
          {hasMore && (
            <li className="flex justify-center border-t border-border pt-2">
              <Button size="sm" variant="ghost" onClick={onLoadMore} loading={loadingMore}>
                Load more
              </Button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** The header's one-line count of what is waiting. */
function notRoutedSummary(query: { pending: boolean; error: boolean; hasMore: boolean }, count: number): string {
  if (query.pending) return 'Loading…';
  if (query.error) return 'Items not routed didn’t load.';
  if (query.hasMore) return count > 0 ? `${count}+ waiting` : 'More waiting';
  if (count === 0) return 'Every new issue and pull request found a board.';
  return `${count} waiting`;
}
