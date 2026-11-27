import { defaultRangeExtractor, observeElementRect, useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { TreeFindChunk } from './tree-find-chunk';
import { FIND_CHUNK, FIND_TEXT, hideUntilFound } from './tree-find-text';
import { findTypeaheadMatch } from './tree-typeahead';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron/disclosure-chevron';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea/scroll-area';
import { transitions } from '@/ds/primitives/transitions';
import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 28;
const INDENT = 12;
const TYPEAHEAD_TIMEOUT = 500;
const FALLBACK_RECT = { width: 0, height: ROW_HEIGHT * 30 };
const FIND_CHUNK_SIZE = 100;
const FOUND_TEXT_CLASS = 'absolute left-0 max-w-full overflow-hidden whitespace-nowrap [clip-path:inset(50%)]';

export interface TreeRow {
  id: string;
  level: number;
  posInSet: number;
  setSize: number;
  expanded?: boolean;
}

export interface TreeProps<Row extends TreeRow> {
  'aria-label': string;
  rows: readonly Row[];
  getRowLabel: (row: Row) => string;
  selectedId?: string;
  onActivate: (row: Row) => void;
  onExpandedChange: (row: Row, expanded: boolean) => void;
  renderRow: (row: Row) => ReactNode;
  className?: string;
  contentClassName?: string;
}

function isInteractiveTarget(target: EventTarget) {
  return (
    target instanceof HTMLElement && !!target.closest('input, textarea, select, button, a, [contenteditable="true"]')
  );
}

export function TreeRoot<Row extends TreeRow>({
  'aria-label': ariaLabel,
  rows,
  getRowLabel,
  selectedId,
  onActivate,
  onExpandedChange,
  renderRow,
  className,
  contentClassName,
}: TreeProps<Row>) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement>();
  const [treeElement, setTreeElement] = useState<HTMLDivElement>();
  const [focusedId, setFocusedId] = useState<string>();
  const [foundId, setFoundId] = useState<string>();
  const [scrollMargin, setScrollMargin] = useState(0);
  const pendingFocus = useRef<string | undefined>(undefined);
  const revealed = useRef<string | undefined>(undefined);
  const typeahead = useRef({ query: '', at: 0 });

  const selectedIndex = selectedId === undefined ? -1 : rows.findIndex(row => row.id === selectedId);
  const focusIndex = focusedId === undefined ? -1 : rows.findIndex(row => row.id === focusedId);
  const tabStopIndex = focusIndex >= 0 ? focusIndex : Math.max(selectedIndex, 0);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: index => rows[index]?.id ?? index,
    overscan: 10,
    scrollMargin,
    initialRect: FALLBACK_RECT,
    rangeExtractor: range => {
      const indexes = defaultRangeExtractor(range);
      if (tabStopIndex >= rows.length || indexes.includes(tabStopIndex)) return indexes;
      return [...indexes, tabStopIndex].toSorted((a, b) => a - b);
    },
    observeElementRect: (instance, onRect) =>
      observeElementRect(instance, rect => onRect(rect.height > 0 ? rect : FALLBACK_RECT)),
  });

  useIsomorphicLayoutEffect(() => {
    if (!treeElement || !scrollElement) return;
    const offset = treeElement.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top;
    setScrollMargin(offset + scrollElement.scrollTop);
  }, [treeElement, scrollElement, contentClassName]);

  useEffect(() => {
    if (selectedId === undefined) revealed.current = undefined;
    if (!scrollElement || selectedIndex < 0 || revealed.current === selectedId) return;
    revealed.current = selectedId;
    virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
  }, [scrollElement, selectedId, selectedIndex, virtualizer]);

  useEffect(() => {
    if (!treeElement) return;
    const onBeforeMatch = (event: Event) => {
      if (!(event.target instanceof HTMLElement) || event.target.dataset.treeFindIndex === undefined) return;
      const index = Number(event.target.dataset.treeFindIndex);
      treeElement.querySelectorAll(`${FIND_TEXT}:not([hidden])`).forEach(hideUntilFound);
      event.target.className = FOUND_TEXT_CLASS;
      event.target.style.top = `${index * ROW_HEIGHT}px`;
      setFoundId(rows[index]?.id);
    };
    treeElement.addEventListener('beforematch', onBeforeMatch);
    return () => treeElement.removeEventListener('beforematch', onBeforeMatch);
  }, [treeElement, rows]);

  useIsomorphicLayoutEffect(() => {
    const id = pendingFocus.current;
    if (id === undefined || !treeElement) return;
    const row = [...treeElement.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
      element => element.dataset.treeItemId === id,
    );
    if (!row) return;
    pendingFocus.current = undefined;
    row.focus({ preventScroll: true });
  });

  const clearFound = () => {
    if (foundId === undefined) return;
    treeElement?.querySelectorAll(`${FIND_TEXT}:not([hidden]), ${FIND_CHUNK}:not([hidden])`).forEach(hideUntilFound);
    setFoundId(undefined);
  };

  const moveTo = (index: number, align: 'auto' | 'center' = 'auto') => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    pendingFocus.current = row.id;
    setFocusedId(row.id);
    virtualizer.scrollToIndex(rows.indexOf(row), { align });
  };

  const jumpTo = (event: KeyboardEvent, index: number) => {
    const previous = typeahead.current;
    const query = event.timeStamp - previous.at < TYPEAHEAD_TIMEOUT ? previous.query + event.key : event.key;
    typeahead.current = { query, at: event.timeStamp };
    const match = findTypeaheadMatch(rows.map(getRowLabel), index, query);
    if (match >= 0) moveTo(match, 'center');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const row = rows[index];
    if (!row || isInteractiveTarget(event.target)) return;
    const typing = event.timeStamp - typeahead.current.at < TYPEAHEAD_TIMEOUT;
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
      case ' ':
        if (typing) jumpTo(event, index);
        else onActivate(row);
        break;
      case 'Enter':
        onActivate(row);
        break;
      default:
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        jumpTo(event, index);
    }
    event.preventDefault();
  };

  const items = virtualizer.getVirtualItems();
  const rendered = new Map(items.map(item => [item.index, item.start - scrollMargin]));

  const renderRowAt = (index: number) => {
    const row = rows[index];
    const start = rendered.get(index);
    if (!row || start === undefined) return undefined;
    const selected = row.id === selectedId;
    const found = row.id === foundId;
    return [
      <div
        key={row.id}
        role="treeitem"
        aria-level={row.level + 1}
        aria-posinset={row.posInSet}
        aria-setsize={row.setSize}
        aria-expanded={row.expanded}
        aria-selected={selected}
        data-tree-item-id={row.id}
        data-found={found || undefined}
        tabIndex={index === tabStopIndex ? 0 : -1}
        onFocus={() => setFocusedId(row.id)}
        onKeyDown={event => onKeyDown(event, index)}
        onClick={event => {
          if (isInteractiveTarget(event.target)) return;
          setFocusedId(row.id);
          onActivate(row);
        }}
        className={cn(
          'group absolute inset-x-0 top-0 flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-sm pr-1 outline-hidden',
          transitions.colors,
          'hover:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:text-foreground',
          found && 'bg-fill-subtle text-foreground',
          selected && 'bg-fill-hover text-foreground',
        )}
        style={{ transform: `translateY(${start}px)`, paddingLeft: row.level * INDENT }}
      >
        <span aria-hidden className="flex size-3 shrink-0 items-center justify-center text-muted-foreground">
          {row.expanded === undefined ? null : (
            <DisclosureChevron direction="right" open={row.expanded} className="size-3" />
          )}
        </span>
        {renderRow(row)}
      </div>,
      ...(found
        ? [
            <div key={`find:${row.id}`} ref={hideUntilFound} aria-hidden data-tree-find-index={index}>
              {getRowLabel(row)}
            </div>,
          ]
        : []),
    ];
  };

  return (
    <ScrollArea className={cn('min-h-0 flex-1', className)}>
      <ScrollAreaViewport ref={element => setScrollElement(element ?? undefined)} contentClassName={contentClassName}>
        <div
          ref={element => setTreeElement(element ?? undefined)}
          role="tree"
          aria-label={ariaLabel}
          className="relative text-caption"
          style={{ height: virtualizer.getTotalSize() }}
          onKeyDownCapture={clearFound}
          onPointerDownCapture={clearFound}
        >
          {Array.from({ length: Math.ceil(rows.length / FIND_CHUNK_SIZE) }, (_, chunk) => {
            const from = chunk * FIND_CHUNK_SIZE;
            const to = Math.min(rows.length, from + FIND_CHUNK_SIZE);
            const drawn = items.some(item => item.index >= from && item.index < to);
            return (
              <TreeFindChunk
                key={chunk}
                rows={rows}
                from={from}
                to={to}
                getRowLabel={getRowLabel}
                renderRowAt={drawn ? renderRowAt : undefined}
              />
            );
          })}
        </div>
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
