import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { scopeTitle } from '../lib/pageAddress';
import { buildPageTree, childCountLabel, pageAncestorIds, visiblePageRows } from '../lib/pageTree';
import { prefersMotion } from '../lib/useLeavingNodes';
import type { KnowledgePagePayload } from '../pageTypes';
import { KnowledgeSourceIcon } from './KnowledgeSourceIcon';

import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconFolder1 } from '@/ds/icons/central/IconFolder1';
import { IconPin } from '@/ds/icons/central/IconPin';
import { cn } from '@/utils/cn';

/**
 * The box of the nearest ancestor (or the element itself) that really scrolls vertically. The tree sets
 * `overflow-y: auto` itself but, as tall as its rows, never overflows; a parent is what scrolls, so a
 * node counts only when its content is taller than it is.
 */
function scrollingBox(element: HTMLElement | null): DOMRect | undefined {
  let overflowing: HTMLElement | undefined;
  for (let node = element; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') continue;
    if (node.scrollHeight > node.clientHeight) return node.getBoundingClientRect();
    overflowing ??= node;
  }
  return (overflowing ?? element)?.getBoundingClientRect();
}

/** Where in the scroller a row focused from elsewhere lands, as a fraction of its height from the top. */
const SCROLL_ROW_AT = 1 / 3;
/** A row between these fractions of the scroller is comfortably in view and is not moved. */
const COMFORT_TOP = 0.1;
const COMFORT_BOTTOM = 0.7;

/** The key {@link KnowledgePageTree}'s `loadMore` uses for the root level. */
export const KNOWLEDGE_TREE_ROOT = '';

/**
 * The Knowledge page tree: scopes and pages nested by parent, siblings in
 * stored order. Selecting a page from elsewhere (graph, search) opens the path
 * to it. Keyboard follows the WAI-ARIA tree pattern: Up/Down move, Right opens
 * or enters, Left closes or goes to the parent, Enter/Space selects.
 *
 * A host that loads the tree a level at a time passes `mayHaveChildren` (so unloaded pages still offer
 * a chevron), listens to `onExpandedChange` to load the opened levels, and passes `loadMore` for
 * levels with more children to fetch. A page's `childCount`, when the server sends one, shows beside
 * its name. Selecting a page with children also opens it.
 */
export function KnowledgePageTree({
  pages,
  pinnedIds,
  selectedPageId,
  onSelect,
  initiallyExpanded,
  mayHaveChildren,
  onExpandedChange,
  loadMore,
  'aria-label': ariaLabel = 'Knowledge pages',
}: {
  pages: KnowledgePagePayload[];
  pinnedIds?: readonly string[];
  selectedPageId?: string | null;
  onSelect: (page: KnowledgePagePayload) => void;
  /** Ids open on first render; defaults to every root. */
  initiallyExpanded?: string[];
  /** True for a page whose children are not loaded yet, so it can still be opened. */
  mayHaveChildren?: (page: KnowledgePagePayload) => boolean;
  onExpandedChange?: (expanded: ReadonlySet<string>) => void;
  /** Parent id ({@link KNOWLEDGE_TREE_ROOT} for the roots) to a loader for its next children. */
  loadMore?: ReadonlyMap<string, () => void>;
  'aria-label'?: string;
}) {
  const roots = useMemo(() => buildPageTree(pages), [pages]);
  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initiallyExpanded ?? roots.map(root => root.page.id)),
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  // Open the path to a selection once. Later renders with the same selection and path (a refetch, a
  // level loading) leave it alone, so a parent the user collapses over the selection stays collapsed.
  const revealed = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedPageId) {
      // Forget the last reveal, so picking the same page again after a clear opens its path.
      revealed.current = null;
      return;
    }
    const path = pageAncestorIds(pages, selectedPageId);
    const key = [selectedPageId, ...path].join('/');
    if (revealed.current === key) return;
    revealed.current = key;
    setExpanded(current => (path.every(id => current.has(id)) ? current : new Set([...current, ...path])));
  }, [pages, selectedPageId]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  const rows = useMemo(
    () =>
      visiblePageRows(roots, expanded).map(row =>
        !row.hasChildren && mayHaveChildren?.(row.page) ? { ...row, hasChildren: true } : row,
      ),
    [roots, expanded, mayHaveChildren],
  );
  // Bring the selected row into view when it is selected, as soon as it exists, and again if rows that load
  // later push it out of view (a deep page's levels arrive one after another). Once the user scrolls, presses a key or
  // a pointer in the tree it is left alone. The row goes a third of the way down the scroller, middle-top, not
  // hard against its bottom edge; keyboard focus is not moved.
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);
  const userScrolled = useRef(false);
  useEffect(() => {
    if (!selectedPageId) {
      scrolledTo.current = null;
      return;
    }
    const element = itemRefs.current.get(selectedPageId);
    if (!element) return;
    const first = scrolledTo.current !== selectedPageId;
    if (first) {
      scrolledTo.current = selectedPageId;
      userScrolled.current = false;
    } else if (userScrolled.current) return;
    const box = scrollingBox(scroller.current);
    const at = element.getBoundingClientRect();
    if (!first && !box) return;
    if (!first && box && box.height === 0 && at.top >= box.top && at.bottom <= box.bottom) return;
    if (box && box.height > 0) {
      // A row already well inside the scroller stays where it is.
      const inView = at.top >= box.top + box.height * COMFORT_TOP && at.bottom <= box.top + box.height * COMFORT_BOTTOM;
      if (inView) return;
      // Otherwise it lands a third of the way down; the browser clamps this at the top and bottom of the list.
      element.style.scrollMarginTop = `${box.height * SCROLL_ROW_AT}px`;
    }
    element.scrollIntoView?.({ block: 'start', behavior: first && prefersMotion() ? 'smooth' : 'auto' });
    // The margin only steers this scroll; left on, focus() scrolls and a resized pane would keep a stale gap.
    element.style.scrollMarginTop = '';
  }, [rows, selectedPageId]);
  const activeId =
    focusedId && rows.some(row => row.page.id === focusedId)
      ? focusedId
      : (rows.find(row => row.page.id === selectedPageId)?.page.id ?? rows[0]?.page.id);

  const toggle = (id: string, open: boolean) =>
    setExpanded(current => {
      if (current.has(id) === open) return current;
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const focus = (id: string | undefined) => {
    if (!id) return;
    setFocusedId(id);
    itemRefs.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const row = rows[index];
    if (!row) return;
    switch (event.key) {
      case 'ArrowDown':
        focus(rows[index + 1]?.page.id);
        break;
      case 'ArrowUp':
        focus(rows[index - 1]?.page.id);
        break;
      case 'ArrowRight':
        if (row.hasChildren && !row.expanded) toggle(row.page.id, true);
        else if (row.expanded) focus(rows[index + 1]?.page.id);
        break;
      case 'ArrowLeft':
        if (row.expanded) toggle(row.page.id, false);
        else focus(rows.slice(0, index).findLast(candidate => candidate.depth < row.depth)?.page.id);
        break;
      case 'Enter':
      case ' ':
        onSelect(row.page);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  if (rows.length === 0) {
    return <p className="px-3 py-2 text-body text-muted-foreground">No pages yet.</p>;
  }

  const ancestorAt: string[] = [];
  return (
    <div
      ref={scroller}
      role="tree"
      aria-label={ariaLabel}
      className="min-h-0 overflow-y-auto py-1"
      onWheel={() => (userScrolled.current = true)}
      onTouchMove={() => (userScrolled.current = true)}
      onPointerDown={() => (userScrolled.current = true)}
      onKeyDown={() => (userScrolled.current = true)}
    >
      {rows.map((row, index) => {
        const selected = row.page.id === selectedPageId;
        ancestorAt[row.depth] = row.page.id;
        // Levels whose last loaded child is this row's subtree end here: offer their next children.
        const nextDepth = rows[index + 1]?.depth ?? -1;
        const closing: Array<{ parentId: string; depth: number }> = [];
        for (let depth = row.depth - 1; depth >= nextDepth; depth--) {
          const parentId = depth < 0 ? KNOWLEDGE_TREE_ROOT : ancestorAt[depth];
          if (parentId !== undefined) closing.push({ parentId, depth: depth + 1 });
        }
        if (row.expanded && rows[index + 1]?.depth !== row.depth + 1)
          closing.unshift({ parentId: row.page.id, depth: row.depth + 1 });
        return (
          <Fragment key={row.page.id}>
            <div
              ref={element => {
                if (element) itemRefs.current.set(row.page.id, element);
                else itemRefs.current.delete(row.page.id);
              }}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-selected={selected}
              aria-expanded={row.hasChildren ? row.expanded : undefined}
              tabIndex={row.page.id === activeId ? 0 : -1}
              onFocus={() => setFocusedId(row.page.id)}
              onKeyDown={event => onKeyDown(event, index)}
              onClick={() => {
                onSelect(row.page);
                // Selecting a page with children opens it too, which loads them in a lazily loaded tree.
                if (row.hasChildren) toggle(row.page.id, true);
              }}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-2 rounded-md pr-2 text-body-sm text-foreground outline-none focus-visible:bg-fill-subtle',
                selected ? 'bg-fill-hover' : 'hover:bg-fill-subtle',
              )}
              style={{ paddingLeft: `${row.depth * 12 + 4}px` }}
            >
              {row.hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={row.expanded ? `Collapse ${row.page.name}` : `Expand ${row.page.name}`}
                  className="flex size-3 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={event => {
                    event.stopPropagation();
                    toggle(row.page.id, !row.expanded);
                  }}
                >
                  <DisclosureChevron direction="right" open={row.expanded} className="size-3" />
                </button>
              ) : (
                <span className="size-3 shrink-0" aria-hidden />
              )}
              <span className="flex shrink-0 items-center text-muted-foreground [&>svg]:size-3.5" aria-hidden>
                {row.page.isScope && scopeTitle(row.page) !== row.page.name ? (
                  <KnowledgeSourceIcon page={row.page} />
                ) : row.hasChildren ? (
                  <IconFolder1 />
                ) : (
                  <IconFileText />
                )}
              </span>
              <span className={cn('min-w-0 flex-1 truncate', row.page.isScope && 'font-medium')}>
                {scopeTitle(row.page)}
              </span>
              {row.page.childCount ? (
                <span
                  data-testid="knowledge-tree-count"
                  aria-label={`${childCountLabel(row.page)} below`}
                  className="shrink-0 text-caption text-placeholder tabular-nums"
                >
                  {childCountLabel(row.page)}
                </span>
              ) : null}
              {pinned.has(row.page.id) ? (
                <IconPin size={12} className="shrink-0 text-badge-amber-indicator" aria-label="Pinned" />
              ) : null}
              {row.page.isScope && row.page.address && row.page.address !== row.page.name ? (
                <span
                  data-testid="knowledge-tree-address"
                  className="max-w-1/2 min-w-0 truncate text-caption text-muted-foreground"
                >
                  {row.page.address}
                </span>
              ) : null}
            </div>
            {closing.map(({ parentId, depth }) => {
              const more = loadMore?.get(parentId);
              return more ? (
                <button
                  key={`more-${parentId}`}
                  type="button"
                  className="flex h-8 w-full items-center text-left text-caption text-muted-foreground hover:text-foreground"
                  style={{ paddingLeft: `${depth * 12 + 42}px` }}
                  onClick={more}
                >
                  Load more
                </button>
              ) : null;
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
