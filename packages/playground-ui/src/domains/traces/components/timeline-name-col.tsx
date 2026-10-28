import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { UISpan, UISpanStyle } from '../types';
import { SPAN_TREE_INDENT, SPAN_TREE_LINE, SPAN_TREE_META_GAP, SPAN_TREE_PAD_Y, SpanTreeRail } from './span-tree-rail';
import { SpanTypeBadge } from './span-type-badge';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { focusRing, focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type TimelineNameColProps = {
  span: UISpan;
  spanUI?: UISpanStyle | null;
  isFaded?: boolean;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  revealSpanId?: string;
  isLastChild?: boolean;
  guides?: boolean[];
  hasChildren?: boolean;
  numOfChildren?: number;
  isRootSpan?: boolean;
  isExpanded?: boolean;
  toggleChildren?: () => void;
  /** Secondary line rendered under the span name (duration, ...). */
  meta?: ReactNode;
};

/** `agent run: 'chef-agent'` → `['agent run', 'chef-agent']`; names without a `kind: ` prefix stay whole. */
function splitSpanName(name: string): [kind: string | null, value: string] {
  const index = name.indexOf(': ');
  if (index < 0) return [null, name];
  return [name.slice(0, index), name.slice(index + 2).replace(/^'(.*)'$/, '$1')];
}

export function TimelineNameCol({
  span,
  spanUI,
  isFaded,
  onSpanClick,
  selectedSpanId,
  revealSpanId,
  isLastChild,
  guides,
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
    if (shouldScrollIntoView) {
      rowRef.current?.scrollIntoView({ block: isRevealed ? 'center' : 'nearest', behavior: 'smooth' });
    }
  }, [shouldScrollIntoView, isRevealed]);

  const toggleLabel = isExpanded ? `Collapse children (${numOfChildren})` : `Expand children (${numOfChildren})`;
  const depth = isRootSpan ? 0 : (guides?.length ?? 0) + 1;
  const [kind, value] = splitSpanName(span.name);

  return (
    <div
      ref={rowRef}
      aria-label={`View details for span ${span.name}`}
      aria-selected={isSelected}
      // The whole row selects the span; the name button is the keyboard target and its click bubbles here.
      onClick={() => onSpanClick?.(span.id)}
      className={cn('relative flex cursor-pointer items-stretch rounded-md pl-1 hover:bg-fill-subtle', {
        'opacity-40 dark:opacity-30 [&:hover]:opacity-70 dark:[&:hover]:opacity-60': isFaded,
        'bg-fill-hover': isSelected,
      })}
    >
      <SpanTreeRail depth={depth} guides={guides ?? []} isLastChild={isLastChild} hasStem={hasChildren && isExpanded} />

      <div
        className="flex min-w-0 flex-1"
        style={{ paddingLeft: depth * SPAN_TREE_INDENT, paddingBlock: SPAN_TREE_PAD_Y }}
      >
        <span
          className="flex shrink-0 items-center justify-center"
          style={{ width: SPAN_TREE_INDENT, height: SPAN_TREE_LINE }}
        >
          <SpanTypeBadge type={span.type} spanUI={spanUI} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <div data-slot="timeline-name-line" className="flex min-w-0 items-center" style={{ height: SPAN_TREE_LINE }}>
            <button
              type="button"
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer rounded-md px-2 text-left text-foreground',
                focusRingInset,
              )}
            >
              {/* Searchable: the span name is what the timeline search matches on. When the match
                  is in the span's payload instead, the whole name is painted in the indirect color
                  so the row explains its own presence. */}
              <Txt
                as="span"
                variant="body-sm"
                data-highlight={span.matchedInPayloadOnly ? undefined : ''}
                data-highlight-indirect={span.matchedInPayloadOnly ? '' : undefined}
                title={span.matchedInPayloadOnly ? 'Matches your search in this span’s details' : undefined}
                className="min-w-0 truncate font-[450]"
              >
                {kind ? (
                  <>
                    {kind}
                    <span aria-hidden className="text-foreground/70 px-1">
                      ›
                    </span>
                    {value}
                  </>
                ) : (
                  span.name
                )}
              </Txt>
            </button>
            {span.signalLabel && (
              <Badge
                size="xs"
                data-slot="span-signal-badge"
                title={span.signalLabel}
                className="mr-1 max-w-1/2 min-w-0 shrink"
              >
                <span className="truncate">{span.signalLabel}</span>
              </Badge>
            )}
          </div>

          {/* Duration always stacks under the name. */}
          {meta && (
            <Txt
              as="span"
              variant="caption"
              tone="muted"
              style={{ marginTop: SPAN_TREE_META_GAP }}
              className="truncate pl-2 leading-4 tabular-nums"
            >
              {meta}
            </Txt>
          )}
        </div>
      </div>

      {/* Expand toggle sits at the end of the row; the slot is always present so names stay aligned. */}
      <div className="flex w-8 shrink-0 justify-center pr-1" style={{ paddingTop: SPAN_TREE_PAD_Y }}>
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
              focusRing,
            )}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
        )}
      </div>
    </div>
  );
}
