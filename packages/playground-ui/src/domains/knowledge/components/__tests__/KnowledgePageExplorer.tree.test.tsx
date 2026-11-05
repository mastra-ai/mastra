// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

function Host({
  requested,
  siteChildCount,
  siteCapped,
  extraSiblings = 0,
  freshLeaf = false,
}: {
  requested: KnowledgeExplorerTreeRequest[];
  siteChildCount?: number;
  siteCapped?: boolean;
  /** Extra pages under the site, each with one child waiting. */
  extraSiblings?: number;
  /** A page under the site that no count covers yet, created just now. */
  freshLeaf?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<KnowledgeExplorerView>('graph');
  const siteNow = {
    ...site,
    ...(siteChildCount === undefined ? {} : { childCount: siteChildCount }),
    ...(siteCapped ? { childCountCapped: true } : {}),
  };
  const extras = Array.from({ length: extraSiblings }, (_, index) =>
    page(`x${String(index).padStart(2, '0')}`, 'site', {
      name: `Extra ${index}`,
      position: `b${String(index).padStart(2, '0')}`,
      childCount: 1,
    }),
  );
  const levelOf = (parentId: string): KnowledgeExplorerTreeLevel => {
    if (parentId === 'site')
      return {
        pages: [
          articles,
          pricing,
          ...(freshLeaf
            ? [
                page('fresh', 'site', { name: 'Fresh', position: 'a2', createdAt: new Date().toISOString() }),
                page('stale', 'site', { name: 'Stale', position: 'a3' }),
              ]
            : []),
          ...extras,
        ],
      };
    if (parentId.startsWith('x'))
      return { pages: [page(`y-${parentId}`, parentId, { name: `Child of ${parentId}`, childCount: 0 })] };
    return levels[parentId] ?? { pages: [] };
  };
  const source: KnowledgeExplorerSource = {
    usePage: pageId => (pageId ? ok(detail(pageId)) : idle),
    useSearch: () => ({ data: { results: [] } }),
    useTreeLevels: requests => {
      requested.push(...requests);
      return requests.map(({ parentId }) => ok(parentId === null ? { pages: [siteNow] } : levelOf(parentId)));
    },
  };
  return (
    <>
      <output data-testid="view">{view}</output>
      <KnowledgePageExplorer
        // The graph loaded only the first pages; the articles are outside it.
        graph={{
          pages: [siteNow, pricing],
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

const tree = () => within(screen.getByRole('tree', { name: 'Knowledge pages' }));
const row = (name: string) => tree().getByRole('treeitem', { name: new RegExp(`^${name}`) });

describe('KnowledgePageExplorer tree with child counts', () => {
  it('loads the root scope and its children, nothing deeper', () => {
    const requested: KnowledgeExplorerTreeRequest[] = [];
    renderWithProviders(<Host requested={requested} />);
    expect(tree().getAllByRole('treeitem')).toHaveLength(3);
    // The tree holds one level; the graph also loads the next, to draw its pages as dots.
    expect(new Set(requested.map(request => request.parentId))).toEqual(new Set([null, 'site', 'articles']));
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

  describe('when a page was just created and no count covers it yet', () => {
    it('offers no expand arrow, while an older uncounted page still does', () => {
      renderWithProviders(<Host requested={[]} freshLeaf />);
      expect(within(row('Fresh')).queryByRole('button')).toBeNull();
      expect(within(row('Stale')).getByRole('button', { name: 'Expand Stale' })).toBeTruthy();
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

  describe('when a page is focused in the graph while its row is out of sight', () => {
    const scrolled: Array<{ id: string | null; options: unknown; margin: string }> = [];
    beforeEach(() => {
      scrolled.length = 0;
      Element.prototype.scrollIntoView = function scrollIntoView(this: Element, options?: unknown) {
        scrolled.push({
          id: this.getAttribute('aria-selected') === 'true' ? this.textContent : null,
          options,
          margin: (this as HTMLElement).style.scrollMarginTop,
        });
      };
    });
    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });

    it('opens its ancestors, highlights its row and scrolls it to the start of the view', () => {
      renderWithProviders(<Host requested={[]} />);
      expect(within(tree().getByRole('treeitem', { name: /^site:mastra/ })).queryByText('Second article')).toBeNull();
      const dot = document.querySelector('.react-flow__node [data-page-id="second"]')?.closest('.react-flow__node');
      if (!dot) throw new Error('no second dot');
      fireEvent.click(dot);
      expect(row('Second article').getAttribute('aria-selected')).toBe('true');
      const hit = scrolled.find(entry => entry.id?.startsWith('Second article'));
      expect(hit?.options).toMatchObject({ block: 'start' });
    });

    // The tree is 100px tall; every row sits below it, as a deep row does while rows above it are still loading.
    const stubLayout = () => {
      const original = HTMLElement.prototype.getBoundingClientRect;
      HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
        const role = this.getAttribute('role');
        if (role === 'tree') return { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 } as DOMRect;
        if (role === 'treeitem')
          return { top: 300, bottom: 332, left: 0, right: 100, width: 100, height: 32 } as DOMRect;
        return original.call(this);
      };
      return () => {
        HTMLElement.prototype.getBoundingClientRect = original;
      };
    };
    const selectedScrolls = () => scrolled.filter(entry => entry.id?.startsWith('Second article')).length;

    describe('where the row lands', () => {
      const withRowAt = (top: number) => {
        const original = HTMLElement.prototype.getBoundingClientRect;
        const rect = (from: number, to: number) =>
          ({ top: from, bottom: to, left: 0, right: 100, width: 100, height: to - from }) as DOMRect;
        HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
          if (this.getAttribute('role') === 'tree') return rect(0, 300);
          if (this.getAttribute('role') === 'treeitem') return rect(top, top + 32);
          return original.call(this);
        };
        return () => {
          HTMLElement.prototype.getBoundingClientRect = original;
        };
      };
      const focusSecond = () => {
        renderWithProviders(<Host requested={[]} />);
        fireEvent.click(row('Articles'));
        fireEvent.click(row('Second article'));
      };

      it('puts a row at the bottom edge a third of the way down the scroller instead', () => {
        const restore = withRowAt(260);
        focusSecond();
        expect(selectedScrolls()).toBeGreaterThan(0);
        expect(scrolled.find(entry => entry.id?.startsWith('Second article'))?.margin).toBe('100px');
        // It steers the one scroll and is gone after, so focus() on the row does not leave a gap.
        expect(row('Second article').style.scrollMarginTop).toBe('');
        expect(scrolled.find(entry => entry.id?.startsWith('Second article'))?.options).toMatchObject({
          block: 'start',
        });
        restore();
      });

      it('leaves a row that is already comfortably in view where it is', () => {
        const restore = withRowAt(80);
        focusSecond();
        expect(selectedScrolls()).toBe(0);
        restore();
      });
    });

    it('scrolls again when more rows load and leave the selected row out of view', () => {
      const restore = stubLayout();
      renderWithProviders(<Host requested={[]} extraSiblings={3} />);
      fireEvent.click(row('Articles'));
      fireEvent.click(row('Second article'));
      const first = selectedScrolls();
      expect(first).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Expand Extra 0' }));
      expect(selectedScrolls()).toBeGreaterThan(first);
      restore();
    });

    it('measures the ancestor that actually scrolls, not the tree element inside it', () => {
      // In the explorer the tree is as tall as its rows; a wrapper around it is what scrolls.
      const original = HTMLElement.prototype.getBoundingClientRect;
      const rect = (top: number, bottom: number) =>
        ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top }) as DOMRect;
      HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === 'outer-scroller') return rect(0, 100);
        if (this.getAttribute('role') === 'tree') return rect(-2800, 8500);
        if (this.getAttribute('role') === 'treeitem') return rect(300, 332);
        return original.call(this);
      };
      renderWithProviders(
        <div data-testid="outer-scroller" style={{ overflowY: 'auto' }}>
          <Host requested={[]} extraSiblings={3} />
        </div>,
      );
      // As in the app, the tree sets overflow-y itself but is as tall as its rows, so it does not scroll.
      const treeElement = screen.getByRole('tree', { name: 'Knowledge pages' });
      treeElement.style.overflowY = 'auto';
      const heights = (element: HTMLElement, scrollHeight: number, clientHeight: number) => {
        Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
        Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
      };
      heights(treeElement, 11300, 11300);
      heights(screen.getByTestId('outer-scroller'), 11300, 100);
      fireEvent.click(row('Articles'));
      fireEvent.click(row('Second article'));
      const first = selectedScrolls();
      fireEvent.click(screen.getByRole('button', { name: 'Expand Extra 0' }));
      expect(selectedScrolls()).toBeGreaterThan(first);
      HTMLElement.prototype.getBoundingClientRect = original;
    });

    describe.each([
      ['scrolls the wheel', (tree: HTMLElement) => fireEvent.wheel(tree)],
      ['presses a key in the tree', (tree: HTMLElement) => fireEvent.keyDown(tree, { key: 'ArrowDown' })],
      ['presses the pointer on the tree (a scrollbar drag)', (tree: HTMLElement) => fireEvent.pointerDown(tree)],
    ])('when the user %s', (_name, act) => {
      it('leaves the scroll alone as more rows load', () => {
        const restore = stubLayout();
        renderWithProviders(<Host requested={[]} extraSiblings={3} />);
        fireEvent.click(row('Articles'));
        fireEvent.click(row('Second article'));
        const first = selectedScrolls();
        act(screen.getByRole('tree', { name: 'Knowledge pages' }));
        fireEvent.click(screen.getByRole('button', { name: 'Expand Extra 0' }));
        expect(selectedScrolls()).toBe(first);
        restore();
      });
    });

    it('scrolls once per selection, not on every refresh', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('Pricing'));
      const count = scrolled.length;
      fireEvent.click(row('Pricing'));
      expect(scrolled.length).toBe(count);
    });
  });

  describe('when a page outside the loaded graph is clicked in the graph view', () => {
    it('focuses it in the graph, which loads around whatever is focused', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('Articles'));
      fireEvent.click(row('Second article'));
      expect(screen.getByTestId('view').textContent).toBe('graph');
      const node = document.querySelector('.react-flow__node [data-page-id="second"]');
      expect(node?.querySelector('.knowledge-circle')?.hasAttribute('data-selected')).toBe(true);
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
      expect(
        within(screen.getByRole('region', { name: 'Selected page' })).getByRole('heading', { name: 'Pricing' }),
      ).toBeTruthy();
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

    const graphNode = (id: string) => {
      const node = document.querySelector<HTMLElement>(`.react-flow__node [data-page-id="${id}"]`);
      if (!node) throw new Error(`no ${id} in the graph`);
      return node;
    };
    const standIns = (container: HTMLElement) => container.querySelectorAll('[data-page-type="stand-in"]');

    it('starts from the root scope and its first level, with the level after as dots', () => {
      const { container } = renderWithProviders(<Host requested={[]} />);
      expect(parentLines(container)).toEqual([
        'parent:articles->first',
        'parent:articles->second',
        'parent:site->articles',
        'parent:site->pricing',
      ]);
      expect(graphNode('first').getAttribute('data-testid')).toBe('knowledge-page-dot');
      expect(standIns(container)).toHaveLength(0);
      expect(within(graphNode('pricing')).queryByTestId('knowledge-child-count-badge')).toBeNull();
    });

    it('keeps counting a parent whose children are only partly drawn', () => {
      renderWithProviders(<Host requested={[]} siteChildCount={5} />);
      expect(within(graphNode('site')).getByTestId('knowledge-child-count-badge').textContent).toBe('5');
    });

    it('counts a capped parent as a lower bound', () => {
      renderWithProviders(<Host requested={[]} siteChildCount={1000} siteCapped />);
      expect(within(graphNode('site')).getByTestId('knowledge-child-count-badge').textContent).toBe('1000+');
    });

    it("loads a page's children when the pointer rests on the dots standing in for them", () => {
      // Only so many circles load their children up front; the rest stand in with dots from their count.
      const requested: KnowledgeExplorerTreeRequest[] = [];
      const { container } = renderWithProviders(<Host requested={requested} extraSiblings={30} />);
      const standIn = standIns(container)[0]?.closest('.react-flow__node');
      if (!standIn) throw new Error('no stand-in dot');
      const before = standIns(container).length;
      fireEvent.mouseEnter(standIn);
      expect(standIns(container).length).toBeLessThan(before);
      expect(requested.some(request => request.parentId?.startsWith('x'))).toBe(true);
    });

    it('grows a dot into a labelled circle when it is focused', () => {
      const { container } = renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('Articles'));
      expect(screen.getByTestId('view').textContent).toBe('graph');
      expect(parentLines(container)).toContain('parent:articles->first');
      expect(graphNode('first').getAttribute('data-testid')).toBe('knowledge-page-node');
      expect(graphNode('first').textContent).toContain('First article');
    });

    it('counts the children it still does not draw on the "+N more" circle, not in a line that shifts the layout', () => {
      const { container } = renderWithProviders(<Host requested={[]} siteChildCount={5} />);
      fireEvent.click(row('site:mastra'));
      expect(document.querySelector('.react-flow__node [data-page-id="rest:site"]')?.getAttribute('aria-label')).toBe(
        'Show 3 more of 3',
      );
      expect(screen.queryByTestId('knowledge-graph-more-children')).toBeNull();
      expect(container.textContent ?? '').not.toMatch(/pages under .* not drawn/);
    });

    describe('when the "+N more" circle is clicked', () => {
      const restNode = () => document.querySelector<HTMLElement>('.react-flow__node [data-page-id="rest:site"]');
      const clickRest = () => {
        const node = restNode()?.closest('.react-flow__node');
        if (!node) throw new Error('no +N more circle');
        fireEvent.click(node);
      };
      const drawnChildren = (container: HTMLElement) =>
        container.querySelectorAll('.react-flow__node [data-page-type="page"]').length;

      it('draws the next batch of children, counting down, until the circle is gone', () => {
        const { container } = renderWithProviders(<Host requested={[]} extraSiblings={60} siteChildCount={62} />);
        fireEvent.click(row('site:mastra'));
        expect(restNode()?.textContent).toContain('+14 more');
        expect(restNode()?.getAttribute('aria-label')).toBe('Show 12 more of 14');
        expect(restNode()?.className).toContain('cursor-pointer');
        const before = drawnChildren(container);
        clickRest();
        expect(drawnChildren(container)).toBe(before + 12);
        expect(restNode()?.textContent).toContain('+2 more');
        clickRest();
        expect(restNode()).toBeNull();
      });
    });
  });

  describe('when the link counts toggle is pressed', () => {
    it('starts on, and flips its pressed state', () => {
      renderWithProviders(<Host requested={[]} />);
      const toggle = screen.getByTestId('knowledge-graph-dot-counts');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('when pages are focused one after another in the graph', () => {
    const back = () => screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement;

    it('shows Back disabled until there is a page to go back to', () => {
      renderWithProviders(<Host requested={[]} />);
      expect(back().disabled).toBe(true);
      fireEvent.click(row('Pricing'));
      expect(back().disabled).toBe(true);
      fireEvent.click(row('Articles'));
      expect(back().disabled).toBe(false);
    });

    it('floats Back over the graph with the other graph options', () => {
      renderWithProviders(<Host requested={[]} />);
      expect(screen.getByTestId('knowledge-graph-container').contains(back())).toBe(true);
      expect(within(screen.getByRole('group', { name: 'Graph options' })).getByRole('button', { name: 'Back' })).toBe(
        back(),
      );
    });

    it('goes back one focus at a time through the walk', () => {
      renderWithProviders(<Host requested={[]} />);
      fireEvent.click(row('site:mastra'));
      fireEvent.click(row('Pricing'));
      fireEvent.click(row('Articles'));
      expect(row('Articles').getAttribute('aria-selected')).toBe('true');
      fireEvent.click(back());
      expect(row('Pricing').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('view').textContent).toBe('graph');
      fireEvent.click(back());
      expect(row('site:mastra').getAttribute('aria-selected')).toBe('true');
      expect(back().disabled).toBe(true);
    });
  });

  describe('when the server capped a count', () => {
    it('shows it as a lower bound in the tree', () => {
      renderWithProviders(<Host requested={[]} siteChildCount={1000} siteCapped />);
      expect(within(row('site:mastra')).getByTestId('knowledge-tree-count').textContent).toBe('1000+');
    });

    it('adds no line above the graph, so refocusing never moves it', () => {
      const { container } = renderWithProviders(<Host requested={[]} siteChildCount={1000} siteCapped />);
      fireEvent.click(row('site:mastra'));
      expect(screen.queryByTestId('knowledge-graph-more-children')).toBeNull();
      expect(container.textContent ?? '').not.toMatch(/pages under .* drawn/);
    });
  });
});
