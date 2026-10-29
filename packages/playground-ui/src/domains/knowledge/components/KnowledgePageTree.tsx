import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { buildPageTree, pageAncestorIds, visiblePageRows } from '../lib/pageTree';
import type { KnowledgePagePayload } from '../pageTypes';

import { cn } from '@/utils/cn';

/**
 * The Knowledge page tree: scopes and pages nested by parent, siblings in
 * stored order. Selecting a page from elsewhere (graph, search) opens the path
 * to it. Keyboard follows the WAI-ARIA tree pattern: Up/Down move, Right opens
 * or enters, Left closes or goes to the parent, Enter/Space selects.
 */
export function KnowledgePageTree({
  pages,
  selectedPageId,
  onSelect,
  initiallyExpanded,
  'aria-label': ariaLabel = 'Knowledge pages',
}: {
  pages: KnowledgePagePayload[];
  selectedPageId?: string | null;
  onSelect: (page: KnowledgePagePayload) => void;
  /** Ids open on first render; defaults to every root. */
  initiallyExpanded?: string[];
  'aria-label'?: string;
}) {
  const roots = useMemo(() => buildPageTree(pages), [pages]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initiallyExpanded ?? roots.map(root => root.page.id)),
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!selectedPageId) return;
    const path = pageAncestorIds(pages, selectedPageId);
    setExpanded(current => (path.every(id => current.has(id)) ? current : new Set([...current, ...path])));
  }, [pages, selectedPageId]);

  const rows = useMemo(() => visiblePageRows(roots, expanded), [roots, expanded]);
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

  return (
    <div role="tree" aria-label={ariaLabel} className="min-h-0 overflow-y-auto py-1">
      {rows.map((row, index) => {
        const selected = row.page.id === selectedPageId;
        return (
          <div
            key={row.page.id}
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
            onClick={() => onSelect(row.page)}
            className={cn(
              'flex min-h-8 cursor-pointer items-center gap-1 rounded-md pr-2 outline-none focus-visible:ring-1 focus-visible:ring-border-focus',
              selected ? 'bg-fill text-foreground' : 'text-foreground hover:bg-fill',
            )}
            style={{ paddingLeft: `${row.depth * 16 + 4}px` }}
          >
            {row.hasChildren ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={row.expanded ? `Collapse ${row.page.name}` : `Expand ${row.page.name}`}
                className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                onClick={event => {
                  event.stopPropagation();
                  toggle(row.page.id, !row.expanded);
                }}
              >
                <ChevronRight size={14} className={cn('transition-transform', row.expanded && 'rotate-90')} />
              </button>
            ) : (
              <span className="size-5 shrink-0" aria-hidden />
            )}
            <span className={cn('min-w-0 flex-1 truncate text-body', row.page.isScope && 'font-medium')}>
              {row.page.name}
            </span>
            {row.page.isScope && row.page.address ? (
              <span className="shrink-0 truncate text-caption text-muted-foreground">{row.page.address}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
