import { describe, expect, it } from 'vitest';

import type { KnowledgePagePayload } from '../pageTypes';
import { NODE_SIZE_DOT, NODE_SIZE_MAX } from './graphModel';
import { pageGraphEdges, toPageFlow } from './pageGraph';
import { buildPageTree, comparePagePosition, pageAncestorIds, visiblePageRows } from './pageTree';

function page(id: string, parentId: string | null, position: string, extra: Partial<KnowledgePagePayload> = {}) {
  return {
    id,
    scopeId: parentId === null ? id : 'org',
    parentId,
    isScope: parentId === null,
    position,
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
    ...extra,
  } satisfies KnowledgePagePayload;
}

const pages = [
  page('org', null, 'a0'),
  page('b', 'org', 'a2'),
  page('a', 'org', 'a1'),
  page('a-child', 'a', 'a0'),
  page('orphan', 'not-loaded', 'a0'),
  page('gone', 'org', 'a3', { deletedAt: '2026-10-28T01:00:00.000Z' }),
  page('merged', 'org', 'a4', { mergedInto: 'a' }),
];

describe('page tree', () => {
  it('orders siblings by code-unit position, not locale', () => {
    // 'Z' (0x5A) sorts before 'a' (0x61) by code unit; localeCompare would put 'a' first.
    expect(comparePagePosition(page('x', null, 'Z'), page('y', null, 'a'))).toBeLessThan(0);
    expect(comparePagePosition(page('x', null, 'a'), page('y', null, 'a'))).toBeLessThan(0);
  });

  it('nests loaded pages, keeps orphans as roots and drops deleted or merged pages', () => {
    const roots = buildPageTree(pages);
    expect(roots.map(node => node.page.id)).toEqual(['org', 'orphan']);
    expect(roots[0]?.children.map(node => node.page.id)).toEqual(['a', 'b']);
    expect(roots[0]?.children[0]?.children.map(node => node.page.id)).toEqual(['a-child']);
  });

  it('lists rows only under expanded pages', () => {
    const roots = buildPageTree(pages);
    expect(visiblePageRows(roots, new Set()).map(row => row.page.id)).toEqual(['org', 'orphan']);
    const rows = visiblePageRows(roots, new Set(['org', 'a']));
    expect(rows.map(row => [row.page.id, row.depth, row.hasChildren, row.expanded])).toEqual([
      ['org', 0, true, true],
      ['a', 1, true, true],
      ['a-child', 2, false, false],
      ['b', 1, false, false],
      ['orphan', 0, false, false],
    ]);
  });

  it('returns the ancestor path to reveal a page, stopping at unloaded parents and cycles', () => {
    expect(pageAncestorIds(pages, 'a-child')).toEqual(['org', 'a']);
    expect(pageAncestorIds(pages, 'orphan')).toEqual([]);
    expect(pageAncestorIds([page('x', 'y', 'a0'), page('y', 'x', 'a0')], 'x')).toEqual(['y']);
  });
});

describe('page graph', () => {
  it('adds parent edges for loaded parents and merges mentions per pair', () => {
    const edges = pageGraphEdges(pages, [
      { source: 'a', target: 'b', kind: 'mention' },
      { source: 'a', target: 'b', kind: 'mention', count: 2 },
      { source: 'a', target: 'a', kind: 'mention' },
      { source: 'b', target: 'not-loaded', kind: 'mention' },
      { source: 'b', target: 'gone', kind: 'mention' },
    ]);
    expect(edges).toEqual([
      { source: 'org', target: 'b', kind: 'parent' },
      { source: 'org', target: 'a', kind: 'parent' },
      { source: 'a', target: 'a-child', kind: 'parent' },
      { source: 'a', target: 'b', kind: 'mention', count: 3 },
    ]);
  });

  it('sizes pages by mentions only and marks the selection', () => {
    const edges = pageGraphEdges(pages, [{ source: 'a', target: 'b', kind: 'mention' }]);
    const flow = toPageFlow(pages, edges, 'a');
    const byId = new Map(flow.nodes.map(node => [node.id, node]));
    expect([...byId.keys()]).toEqual(['org', 'b', 'a', 'a-child', 'orphan']);
    expect(byId.get('b')?.data.size).toBe(NODE_SIZE_MAX);
    // Being a parent alone doesn't earn size.
    expect(byId.get('org')?.data.size).toBe(NODE_SIZE_DOT);
    expect(byId.get('a')?.data.selected).toBe(true);
    expect(flow.edges.find(edge => edge.data?.kind === 'mention')).toMatchObject({
      id: 'mention:a->b',
      data: { count: 1 },
    });
  });
});
