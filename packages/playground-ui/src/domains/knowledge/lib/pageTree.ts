/**
 * Pure page-tree logic for the schema-4 explorer: loaded pages → a sorted
 * tree, the visible rows for a set of expanded ids, and the ancestor path
 * that must open to reveal a selection. Free of React so it unit-tests alone.
 */

import type { KnowledgePagePayload } from '../pageTypes';

export interface KnowledgePageTreeNode {
  page: KnowledgePagePayload;
  children: KnowledgePageTreeNode[];
}

export interface KnowledgePageTreeRow {
  page: KnowledgePagePayload;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

/** Sibling order: position by UTF-16 code unit (as the store defines it), then id. */
export function comparePagePosition(a: KnowledgePagePayload, b: KnowledgePagePayload): number {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function isLive(page: KnowledgePagePayload): boolean {
  return !page.deletedAt && !page.mergedInto;
}

/**
 * Builds the tree from whatever pages are loaded. A page whose parent isn't
 * loaded (or is deleted/merged) becomes a root so it is never lost.
 */
export function buildPageTree(pages: KnowledgePagePayload[]): KnowledgePageTreeNode[] {
  const nodes = new Map<string, KnowledgePageTreeNode>();
  for (const page of pages) {
    if (isLive(page) && !nodes.has(page.id)) nodes.set(page.id, { page, children: [] });
  }
  const roots: KnowledgePageTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.page.parentId ? nodes.get(node.page.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: KnowledgePageTreeNode[]) => {
    list.sort((a, b) => comparePagePosition(a.page, b.page));
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}

/** Depth-first rows for rendering, descending only into expanded pages. */
export function visiblePageRows(roots: KnowledgePageTreeNode[], expanded: ReadonlySet<string>): KnowledgePageTreeRow[] {
  const rows: KnowledgePageTreeRow[] = [];
  const walk = (list: KnowledgePageTreeNode[], depth: number) => {
    for (const node of list) {
      const open = expanded.has(node.page.id);
      rows.push({ page: node.page, depth, hasChildren: node.children.length > 0, expanded: open });
      if (open) walk(node.children, depth + 1);
    }
  };
  walk(roots, 0);
  return rows;
}

/** Ids from the root down to (not including) `pageId`; stops at unloaded parents and cycles. */
export function pageAncestorIds(pages: KnowledgePagePayload[], pageId: string): string[] {
  const byId = new Map(pages.map(page => [page.id, page]));
  const path: string[] = [];
  const seen = new Set<string>([pageId]);
  let parentId = byId.get(pageId)?.parentId ?? null;
  while (parentId && byId.has(parentId) && !seen.has(parentId)) {
    seen.add(parentId);
    path.unshift(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return path;
}
