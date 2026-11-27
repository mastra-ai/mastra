import { defaultRangeExtractor, observeElementRect, useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron/disclosure-chevron';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea/scroll-area';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 28;
const EDGE_PADDING = 8;
const INDENT = 12;
const FALLBACK_RECT = { width: 0, height: ROW_HEIGHT * 30 };

export interface VirtualTreeRow {
  id: string;
  level: number;
  posInSet: number;
  setSize: number;
  expanded?: boolean;
}

export interface VirtualTreeProps<Row extends VirtualTreeRow> {
  'aria-label': string;
  rows: readonly Row[];
  selectedId?: string;
  onActivate: (row: Row) => void;
  onExpandedChange: (row: Row, expanded: boolean) => void;
  renderRow: (row: Row) => ReactNode;
  className?: string;
}

function isEditableTarget(target: EventTarget) {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, button, [contenteditable="true"]');
}

export function VirtualTree<Row extends VirtualTreeRow>({
  'aria-label': ariaLabel,
  rows,
  selectedId,
  onActivate,
  onExpandedChange,
  renderRow,
  className,
}: VirtualTreeProps<Row>) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement>();
  const [focusedId, setFocusedId] = useState<string>();
  const pendingFocus = useRef<string | undefined>(undefined);
  const revealed = useRef<string | undefined>(undefined);

  const selectedIndex = selectedId === undefined ? -1 : rows.findIndex(row => row.id === selectedId);
  const focusIndex = focusedId === undefined ? -1 : rows.findIndex(row => row.id === focusedId);
  const tabStopIndex = focusIndex >= 0 ? focusIndex : Math.max(selectedIndex, 0);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: index => rows[index]?.id ?? index,
    paddingStart: EDGE_PADDING,
    paddingEnd: EDGE_PADDING,
    overscan: 10,
    initialRect: FALLBACK_RECT,
    rangeExtractor: range => {
      const indexes = defaultRangeExtractor(range);
      if (tabStopIndex >= rows.length || indexes.includes(tabStopIndex)) return indexes;
      return [...indexes, tabStopIndex].toSorted((a, b) => a - b);
    },
    observeElementRect: (instance, onRect) =>
      observeElementRect(instance, rect => onRect(rect.height > 0 ? rect : FALLBACK_RECT)),
  });

  useEffect(() => {
    if (selectedId === undefined) revealed.current = undefined;
    if (!scrollElement || selectedIndex < 0 || revealed.current === selectedId) return;
    revealed.current = selectedId;
    virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
  }, [scrollElement, selectedId, selectedIndex, virtualizer]);

  const moveTo = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    pendingFocus.current = row.id;
    setFocusedId(row.id);
    virtualizer.scrollToIndex(rows.indexOf(row), { align: 'auto' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const row = rows[index];
    if (!row || isEditableTarget(event.target)) return;
    switch (event.key) {
      case 'ArrowDown':
        moveTo(index + 1);
        break;
      case 'ArrowUp':
        moveTo(index - 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(rows.length - 1);
        break;
      case 'ArrowRight':
        if (row.expanded === false) onExpandedChange(row, true);
        else if (row.expanded && (rows[index + 1]?.level ?? -1) > row.level) moveTo(index + 1);
        break;
      case 'ArrowLeft':
        if (row.expanded) onExpandedChange(row, false);
        else {
          const parent = rows.findLastIndex((candidate, at) => at < index && candidate.level < row.level);
          if (parent >= 0) moveTo(parent);
        }
        break;
      case 'Enter':
      case ' ':
        onActivate(row);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <ScrollArea className={cn('min-h-0 flex-1', className)}>
      <ScrollAreaViewport ref={element => setScrollElement(element ?? undefined)}>
        <div
          role="tree"
          aria-label={ariaLabel}
          className="relative mx-2 text-caption"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map(item => {
            const row = rows[item.index];
            if (!row) return null;
            const selected = row.id === selectedId;
            return (
              <div
                key={row.id}
                ref={element => {
                  if (element && pendingFocus.current === row.id) {
                    pendingFocus.current = undefined;
                    element.focus({ preventScroll: true });
                  }
                }}
                role="treeitem"
                aria-level={row.level + 1}
                aria-posinset={row.posInSet}
                aria-setsize={row.setSize}
                aria-expanded={row.expanded}
                aria-selected={selected}
                tabIndex={item.index === tabStopIndex ? 0 : -1}
                onFocus={() => setFocusedId(row.id)}
                onKeyDown={event => onKeyDown(event, item.index)}
                onClick={() => {
                  setFocusedId(row.id);
                  onActivate(row);
                }}
                className={cn(
                  'group absolute inset-x-0 top-0 flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-sm pr-1 outline-hidden',
                  transitions.colors,
                  'hover:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:text-foreground',
                  selected && 'bg-fill-hover text-foreground',
                )}
                style={{ transform: `translateY(${item.start}px)`, paddingLeft: row.level * INDENT }}
              >
                <span aria-hidden className="flex size-3 shrink-0 items-center justify-center text-muted-foreground">
                  {row.expanded === undefined ? null : (
                    <DisclosureChevron direction="right" open={row.expanded} className="size-3" />
                  )}
                </span>
                {renderRow(row)}
              </div>
            );
          })}
        </div>
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
