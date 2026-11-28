import { useEffect, useMemo, useRef, useState } from 'react';

import { scopeSource, scopeTitle } from '../lib/pageAddress';
import { buildPageTree, childCountLabel, pageAncestorIds } from '../lib/pageTree';
import type { KnowledgePageTreeNode } from '../lib/pageTree';
import type { KnowledgePagePayload } from '../pageTypes';
import { KnowledgeSourceIcon } from './KnowledgeSourceIcon';

import { Tree } from '@/ds/components/Tree';
import type { TreeRow } from '@/ds/components/Tree';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconFolder1 } from '@/ds/icons/central/IconFolder1';
import { IconPin } from '@/ds/icons/central/IconPin';
import { cn } from '@/utils/cn';

type KnowledgeTreeRow = TreeRow &
  (
    | { kind: 'page'; page: KnowledgePagePayload; hasChildren: boolean }
    | { kind: 'more'; parentId: string; load: () => void }
  );

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

  const rows: KnowledgeTreeRow[] = [];
  const addLevel = (nodes: KnowledgePageTreeNode[], level: number, parentId: string) => {
    const load = loadMore?.get(parentId);
    const setSize = nodes.length + (load ? 1 : 0);
    nodes.forEach(({ page, children }, index) => {
      const open = expanded.has(page.id);
      const hasChildren = children.length > 0 || !!mayHaveChildren?.(page);
      rows.push({
        kind: 'page',
        id: page.id,
        page,
        hasChildren,
        level,
        posInSet: index + 1,
        setSize,
        expanded: hasChildren ? open : undefined,
      });
      if (open) addLevel(children, level + 1, page.id);
    });
    if (load) rows.push({ kind: 'more', id: `${parentId}\0more`, parentId, load, level, posInSet: setSize, setSize });
  };
  addLevel(roots, 0, KNOWLEDGE_TREE_ROOT);

  const toggle = (id: string, open: boolean) =>
    setExpanded(current => {
      if (current.has(id) === open) return current;
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  if (rows.length === 0) {
    return <p className="px-3 py-2 text-body text-muted-foreground">No pages yet.</p>;
  }

  return (
    <Tree
      aria-label={ariaLabel}
      size="md"
      contentClassName="py-1"
      rows={rows}
      getRowLabel={row => (row.kind === 'page' ? scopeTitle(row.page) : '')}
      selectedId={selectedPageId ?? undefined}
      onActivate={row => {
        if (row.kind === 'more') return row.load();
        onSelect(row.page);
        if (row.hasChildren) toggle(row.page.id, true);
      }}
      onExpandedChange={(row, open) => toggle(row.id, open)}
      renderRow={row => <KnowledgePageTreeRowContent row={row} pinned={pinned.has(row.id)} />}
    />
  );
}

function KnowledgePageTreeRowContent({ row, pinned }: { row: KnowledgeTreeRow; pinned: boolean }) {
  if (row.kind === 'more') {
    return (
      <>
        <span className="size-icon-sm shrink-0" aria-hidden />
        <button type="button" className="text-caption text-muted-foreground hover:text-foreground" onClick={row.load}>
          Load more
        </button>
      </>
    );
  }
  const { page } = row;
  return (
    <>
      <Tree.Icon className="text-muted-foreground">
        {scopeSource(page)?.icon ? (
          <KnowledgeSourceIcon page={page} />
        ) : page.isScope || row.hasChildren ? (
          <IconFolder1 />
        ) : (
          <IconFileText />
        )}
      </Tree.Icon>
      <Tree.Label className={cn('flex-1', page.isScope && 'font-medium')}>{scopeTitle(page)}</Tree.Label>
      {page.childCount ? (
        <span
          data-testid="knowledge-tree-count"
          aria-label={`${childCountLabel(page)} below`}
          className="shrink-0 text-caption text-subtle-foreground tabular-nums"
        >
          {childCountLabel(page)}
        </span>
      ) : null}
      {pinned ? <IconPin className="size-icon-xs shrink-0 text-badge-amber-indicator" aria-label="Pinned" /> : null}
      {page.isScope && page.address && page.address !== scopeTitle(page) ? (
        <span
          data-testid="knowledge-tree-address"
          className="max-w-1/2 min-w-0 truncate text-caption text-muted-foreground"
        >
          {page.address}
        </span>
      ) : null}
    </>
  );
}
