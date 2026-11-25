// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerSource,
  KnowledgeExplorerTreeLevel,
  KnowledgeExplorerTreeRequest,
  KnowledgeExplorerView,
} from '../KnowledgePageExplorer';
import { KnowledgePageExplorer } from '../KnowledgePageExplorer';

function scope(index: number, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  const id = `s${String(index).padStart(2, '0')}`;
  return {
    id,
    scopeId: id,
    parentId: null,
    isScope: true,
    address: `team:${id}`,
    position: `a${String(index).padStart(2, '0')}`,
    name: `team:${id}`,
    version: 1,
    childCount: 0,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  };
}

const idle = { isPending: false, isError: false, error: null } as const;

/** Root scopes served a chunk at a time: the first `firstChunk` without a cursor, the rest behind cursor `c1`. */
function Host({
  requested,
  firstChunk,
  total,
}: {
  requested: KnowledgeExplorerTreeRequest[];
  firstChunk: number;
  total: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<KnowledgeExplorerView>('graph');
  const roots = Array.from({ length: total }, (_, index) => scope(index));
  const levelOf = ({ parentId, cursor }: KnowledgeExplorerTreeRequest): KnowledgeExplorerTreeLevel => {
    if (parentId !== null) return { pages: [] };
    if (cursor === 'c1') return { pages: roots.slice(firstChunk) };
    return { pages: roots.slice(0, firstChunk), ...(total > firstChunk ? { nextCursor: 'c1' } : {}) };
  };
  const source: KnowledgeExplorerSource = {
    usePage: () => idle,
    useSearch: () => ({ data: { results: [] } }),
    useTreeLevels: requests => {
      requested.push(...requests);
      return requests.map(request => ({ ...idle, data: levelOf(request) }));
    },
  };
  return (
    <KnowledgePageExplorer
      graph={{ pages: [], edges: [], pinnedIds: [], truncated: true }}
      source={source}
      selectedPageId={selected}
      onSelect={setSelected}
      view={view}
      onViewChange={setView}
    />
  );
}

beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const graphNode = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node [data-page-id="${id}"]`);
const rootsRest = () => graphNode('rest:roots:');
const clickRootsRest = () => {
  const node = rootsRest()?.closest('.react-flow__node');
  if (!node) throw new Error('no root scopes "more" circle');
  fireEvent.click(node);
};
const rootCursorRequested = (requested: KnowledgeExplorerTreeRequest[]) =>
  requested.some(request => request.parentId === null && request.cursor === 'c1');

describe('KnowledgePageExplorer graph with more root scopes than it draws', () => {
  it('draws every root scope of a first chunk up to 24, with no "more" circle when the server has no more', () => {
    renderWithProviders(<Host requested={[]} firstChunk={14} total={14} />);
    for (let index = 0; index < 14; index++) expect(graphNode(scope(index).id)).not.toBeNull();
    expect(rootsRest()).toBeNull();
  });

  it('counts the loaded roots past 24 on a circle that draws them and fetches the next chunk', () => {
    const requested: KnowledgeExplorerTreeRequest[] = [];
    renderWithProviders(<Host requested={requested} firstChunk={30} total={34} />);
    expect(rootsRest()?.textContent).toContain('+6+ more scopes');
    expect(graphNode('s29')).toBeNull();
    clickRootsRest();
    expect(rootCursorRequested(requested)).toBe(true);
    expect(graphNode('s29')).not.toBeNull();
  });

  it('keeps the circle while the server holds more roots, even when every loaded root is drawn', () => {
    const requested: KnowledgeExplorerTreeRequest[] = [];
    renderWithProviders(<Host requested={requested} firstChunk={5} total={8} />);
    expect(rootsRest()?.textContent).toContain('More scopes');
    expect(graphNode('s06')).toBeNull();
    expect(rootCursorRequested(requested)).toBe(false);
    clickRootsRest();
    expect(rootCursorRequested(requested)).toBe(true);
    expect(graphNode('s06')).not.toBeNull();
    // Every root is loaded and drawn now, so the circle is gone and the sidebar lists them too.
    expect(rootsRest()).toBeNull();
    const tree = within(screen.getByRole('tree', { name: 'Knowledge pages' }));
    expect(tree.getAllByRole('treeitem')).toHaveLength(8);
  });
});
