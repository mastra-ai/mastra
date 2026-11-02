// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerPageDetail,
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerTreeLevel,
  KnowledgeExplorerTreeRequest,
  KnowledgeExplorerView,
} from '../KnowledgePageExplorer';
import { KnowledgePageExplorer } from '../KnowledgePageExplorer';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: parentId === null ? id : 'site',
    parentId,
    isScope: parentId === null,
    position: 'a0',
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  };
}

// The server counts the pages under each one, so the tree knows which pages have children before loading them.
const site = page('site', null, { name: 'site:mastra', address: 'site:mastra', childCount: 2 });
const articles = page('articles', 'site', { name: 'Articles', position: 'a0', childCount: 2 });
const pricing = page('pricing', 'site', { name: 'Pricing', position: 'a1', childCount: 0 });
const first = page('first', 'articles', { name: 'First article', position: 'a0', childCount: 0 });
const second = page('second', 'articles', { name: 'Second article', position: 'a1', childCount: 0 });
const all = [site, articles, pricing, first, second];

const levels: Record<string, KnowledgeExplorerTreeLevel> = {
  '': { pages: [site] },
  site: { pages: [articles, pricing] },
  articles: { pages: [first, second] },
};

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

function detail(pageId: string): KnowledgeExplorerPageDetail {
  const target = all.find(candidate => candidate.id === pageId) ?? site;
  const ancestors = target.parentId === 'articles' ? [site, articles] : target.parentId === 'site' ? [site] : [];
  return { page: target, notes: [], ancestors, related: [] };
}

function Host({ requested, siteChildCount }: { requested: KnowledgeExplorerTreeRequest[]; siteChildCount?: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<KnowledgeExplorerView>('graph');
  const source: KnowledgeExplorerSource = {
    usePage: pageId => (pageId ? ok(detail(pageId)) : idle),
    useSearch: () => ({ data: { results: [] } }),
    useTreeLevels: requests => {
      requested.push(...requests);
      return requests.map(({ parentId }) => ok(levels[parentId ?? ''] ?? { pages: [] }));
    },
  };
  return (
    <>
      <output data-testid="view">{view}</output>
      <KnowledgePageExplorer
        // The graph loaded only the first pages; the articles are outside it.
        graph={{
          pages: [siteChildCount === undefined ? site : { ...site, childCount: siteChildCount }, pricing],
          edges: [],
          pinnedIds: [],
          truncated: true,
        }}
        source={source}
        selectedPageId={selected}
        onSelect={setSelected}
        view={view}
        onViewChange={setView}
      />
    </>
  );
}

beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const tree = () => within(screen.getByRole('tree'));
const row = (name: string) => tree().getByRole('treeitem', { name: new RegExp(`^${name}`) });

describe('KnowledgePageExplorer tree with child counts', () => {
  it('loads the root scope and its children, nothing deeper', () => {
    const requested: KnowledgeExplorerTreeRequest[] = [];
    renderWithProviders(<Host requested={requested} />);
    expect(tree().getAllByRole('treeitem')).toHaveLength(3);
    expect(new Set(requested.map(request => request.parentId))).toEqual(new Set([null, 'site']));
  });

  it('shows how many pages sit under each page that has any', () => {
    renderWithProviders(<Host requested={[]} />);
    expect(within(row('Articles')).getByTestId('knowledge-tree-count').textContent).toBe('2');
    expect(within(row('Pricing')).queryByTestId('knowledge-tree-count')).toBeNull();
  });

  describe('when a page has no children', () => {
    it('offers no expand button', () => {
      renderWithProviders(<Host requested={[]} />);
      expect(within(row('Pricing')).queryByRole('button')).toBeNull();
      expect(row('Pricing').getAttribute('aria-expanded')).toBeNull();
      expect(within(row('Articles')).getByRole('button', { name: 'Expand Articles' })).toBeTruthy();
    });
  });

  describe('when a page with children is clicked', () => {
    it('loads its children, opens it and highlights it', () => {
      const requested: KnowledgeExplorerTreeRequest[] = [];
      renderWithProviders(<Host requested={requested} />);
      fireEvent.click(row('Articles'));
      expect(requested.some(request => request.parentId === 'articles')).toBe(true);
      expect(row('Articles').getAttribute('aria-expanded')).toBe('true');
      expect(row('Articles').getAttribute('aria-selected')).toBe('true');
      expect(row('First article')).toBeTruthy();
    });
  });

  describe('when a page outside the loaded graph is clicked in the graph view', () => {
    it('opens it as a page instead of selecting nothing visible', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('Articles'));
      fireEvent.click(row('Second article'));
      expect(screen.getByTestId('view').textContent).toBe('page');
      expect(within(screen.getByRole('region', { name: 'Selected page' })).getByText('Second article')).toBeTruthy();
    });

    it('stays on the graph for a page the graph has', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('Pricing'));
      expect(screen.getByTestId('view').textContent).toBe('graph');
    });
  });

  describe('when a page the graph has is clicked twice in the graph view', () => {
    it('focuses it in the graph first, then opens it as a page', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('Pricing'));
      expect(screen.getByTestId('view').textContent).toBe('graph');
      expect(row('Pricing').getAttribute('aria-selected')).toBe('true');
      fireEvent.click(row('Pricing'));
      expect(screen.getByTestId('view').textContent).toBe('page');
      expect(within(screen.getByRole('region', { name: 'Selected page' })).getByText('Pricing')).toBeTruthy();
    });

    it('focuses a different page instead of opening when the second click lands elsewhere', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('Pricing'));
      fireEvent.click(row('site:mastra'));
      expect(screen.getByTestId('view').textContent).toBe('graph');
      expect(row('site:mastra').getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('when a page is focused in the graph', () => {
    const parentLines = (container: HTMLElement) =>
      [...container.querySelectorAll('.react-flow__edge')]
        .map(edge => edge.getAttribute('data-id'))
        .filter(id => id?.startsWith('parent:'))
        .sort();

    it('adds the children the graph had not loaded, joined to it', () => {
      const { container } = renderWithProviders(<Host requested={[]} />);
      expect(parentLines(container)).toEqual(['parent:site->pricing']);
      fireEvent.click(row('site:mastra'));
      expect(parentLines(container)).toEqual(['parent:site->articles', 'parent:site->pricing']);
      expect(screen.getByTestId('view').textContent).toBe('graph');
    });

    it('keeps going down: focusing an added child adds its children too', () => {
      const { container } = renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('site:mastra'));
      fireEvent.click(row('Articles'));
      expect(parentLines(container)).toEqual([
        'parent:articles->first',
        'parent:articles->second',
        'parent:site->articles',
        'parent:site->pricing',
      ]);
      expect(screen.getByTestId('view').textContent).toBe('graph');
    });

    it('counts the children it still does not draw', () => {
      renderWithProviders(<Host requested={[]} siteChildCount={5} />);
      fireEvent.click(row('site:mastra'));
      expect(screen.getByTestId('knowledge-graph-more-children').textContent).toBe(
        '+3 more pages under site:mastra not drawn. Open the tree to see them all.',
      );
    });

    it('says nothing more when every child is drawn', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('site:mastra'));
      expect(screen.queryByTestId('knowledge-graph-more-children')).toBeNull();
    });
  });
});
