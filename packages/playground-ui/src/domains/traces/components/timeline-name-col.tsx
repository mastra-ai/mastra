import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { UISpan, UISpanStyle } from '../types';
import { TimelineStructureSign } from './timeline-structure-sign';
import { cn } from '@/lib/utils';

type TimelineNameColProps = {
  span: UISpan;
  spanUI?: UISpanStyle | null;
  isFaded?: boolean;
  depth?: number;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  revealSpanId?: string;
  isLastChild?: boolean;
  hasChildren?: boolean;
  numOfChildren?: number;
  isRootSpan?: boolean;
  isExpanded?: boolean;
  toggleChildren?: () => void;
  /** Secondary line rendered under the span name (duration, ...). */
  meta?: ReactNode;
};

export function TimelineNameCol({
  span,
  spanUI,
  isFaded,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  revealSpanId,
  isLastChild,
  hasChildren,
  numOfChildren = 0,
  isRootSpan,
  isExpanded,
  toggleChildren,
  meta,
}: TimelineNameColProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedSpanId === span.id;
  const isRevealed = revealSpanId === span.id;
  const shouldScrollIntoView = isSelected || isRevealed;

  // Nested rows mount late, once expansion opens their ancestors; the effect runs on that
  // mount as well as when the row becomes the selected / revealed one.
  useEffect(() => {
    if (shouldScrollIntoView) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [shouldScrollIntoView]);

  const toggleLabel = isExpanded ? `Collapse children (${numOfChildren})` : `Expand children (${numOfChildren})`;

  return (
    <div
      ref={rowRef}
      aria-label={`View details for span ${span.name}`}
      aria-selected={isSelected}
      // The whole row selects the span; the name button is the keyboard target and its click bubbles here.
      onClick={() => onSpanClick?.(span.id)}
      className={cn('flex min-h-8 cursor-pointer items-stretch rounded-md opacity-80 hover:bg-fill-subtle', {
        'opacity-40 [&:hover]:opacity-70 dark:opacity-30 dark:[&:hover]:opacity-60': isFaded,
        'bg-fill-hover': isSelected,
      })}
      style={{ paddingLeft: `${depth * 1}rem` }}
    >
      {!isRootSpan && <TimelineStructureSign isLastChild={isLastChild} />}

      <button
        type="button"
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 self-stretch rounded-md px-2 py-1 text-left text-caption text-foreground',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:ring-inset',
        )}
      >
        {spanUI?.color && (
          <span
            aria-hidden
            title={spanUI.label}
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ backgroundColor: spanUI.color }}
          />
        )}
        {/* Searchable: the span name is what the timeline search matches on. When the match
            is in the span's payload instead, the whole name is painted in the indirect color
            so the row explains its own presence. */}
        {/* Duration stacks under the name on narrow layouts and moves inline at the end of the row from lg. */}
        <span className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-2">
          <span
            data-highlight={span.matchedInPayloadOnly ? undefined : ''}
            data-highlight-indirect={span.matchedInPayloadOnly ? '' : undefined}
            title={span.matchedInPayloadOnly ? 'Matches your search in this span’s details' : undefined}
            className="min-w-0 truncate"
          >
            {span.name}
          </span>
          {meta && <span className="text-meta text-muted-foreground shrink-0 lg:tabular-nums">{meta}</span>}
        </span>
      </button>

      {/* Expand toggle sits at the end of the row; the slot is always present so names stay aligned. */}
      <div className="flex w-8 shrink-0 items-center justify-center self-stretch pr-1">
        {hasChildren && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              toggleChildren?.();
            }}
            aria-label={toggleLabel}
            aria-expanded={isExpanded}
            className={cn(
              'flex size-5 cursor-pointer items-center justify-center rounded-md',
              'hover:bg-fill [&:hover>svg]:opacity-100 [&>svg]:size-4 [&>svg]:opacity-50',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent1',
            )}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
        )}
      </div>
    </div>
  );
}
