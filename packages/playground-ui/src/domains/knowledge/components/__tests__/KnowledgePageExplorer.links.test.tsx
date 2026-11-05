// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgeNotePayload, KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerGraph,
  KnowledgeExplorerPageDetail,
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerView,
} from '../KnowledgePageExplorer';
import { KnowledgePageExplorer } from '../KnowledgePageExplorer';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: 'docs',
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

const docs = page('docs', null, { name: 'Mastra docs', address: 'docs:mastra' });
const workflows = page('workflows', 'docs', { name: 'Workflows', key: 'workflows' });
const suspend = page('suspend', 'workflows', { name: 'Suspend and resume', key: 'suspend-and-resume' });
const overview = page('overview', 'docs', {
  name: 'Overview',
  key: 'overview',
  position: 'a1',
  body: [
    'Pause a run with [[docs:mastra#workflows/suspend-and-resume]], or read [[Workflows]] first.',
    '',
    'Not written yet: [[docs:mastra#workflows/human-in-the-loop]].',
    '',
    'Escaped: [[<img src=x onerror="window.__pwned=1">]]',
    '',
    'Inline `[[docs:mastra#workflows]]` stays code.',
    '',
    '```',
    '[[docs:mastra#workflows]]',
    '```',
  ].join('\n'),
});

const pathNote: KnowledgeNotePayload = {
  id: 'n1',
  pageId: 'overview',
  text: 'Moved to [[docs:mastra#workflows/suspend-and-resume]]',
  stampScopeIds: [],
  mentions: ['suspend'],
  provenance: { author: 'docs-agent' },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const all = [docs, workflows, suspend, overview];
const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

function detail(pageId: string): KnowledgeExplorerPageDetail {
  const target = all.find(candidate => candidate.id === pageId) ?? overview;
  const ancestors = target.parentId === 'workflows' ? [docs, workflows] : target.parentId ? [docs] : [];
  return { page: target, notes: target === overview ? [pathNote] : [], ancestors, related: [] };
}

const source: KnowledgeExplorerSource = {
  usePage: pageId => (pageId ? ok(detail(pageId)) : idle),
  useSearch: () => ({ data: { results: [] } }),
};

const graph: KnowledgeExplorerGraph = { pages: all, edges: [], pinnedIds: [], truncated: false };

function Host({ initial, initialView }: { initial: string | null; initialView: KnowledgeExplorerView }) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [view, setView] = useState<KnowledgeExplorerView>(initialView);
  return (
    <>
      <output data-testid="selected">{selected}</output>
      <KnowledgePageExplorer
        graph={graph}
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

describe('KnowledgePageExplorer body links', () => {
  describe('when an open page body links other pages with [[ref]]', () => {
    const body = () => within(screen.getByTestId('knowledge-page-body'));

    it('draws a nested scope#path link as the target page, and opens it on click', () => {
      renderWithProviders(<Host initial="overview" initialView="page" />);
      const link = body().getByRole('button', { name: 'Suspend and resume' });
      expect(link.getAttribute('title')).toBe('docs:mastra#workflows/suspend-and-resume');
      fireEvent.click(link);
      expect(screen.getByTestId('selected').textContent).toBe('suspend');
    });

    it('links a ref by page name too', () => {
      renderWithProviders(<Host initial="overview" initialView="page" />);
      expect(body().getByRole('button', { name: 'Workflows' })).toBeTruthy();
    });

    it('shows a ref no loaded page answers to as quiet text, not a link', () => {
      renderWithProviders(<Host initial="overview" initialView="page" />);
      const unresolved = body().getAllByTestId('knowledge-body-link-unresolved');
      expect(unresolved.map(element => element.tagName)).toEqual(['SPAN']);
      expect(unresolved[0]?.textContent).toBe('docs:mastra#workflows/human-in-the-loop');
    });

    it('lets no markup in a ref reach the page', () => {
      const { container } = renderWithProviders(<Host initial="overview" initialView="page" />);
      expect(container.querySelector('[data-testid="knowledge-page-body"] img')).toBeNull();
      expect((window as { __pwned?: number }).__pwned).toBeUndefined();
    });

    it('leaves refs inside inline code and code blocks as written', () => {
      renderWithProviders(<Host initial="overview" initialView="page" />);
      expect(body().getAllByTestId('knowledge-body-link')).toHaveLength(2);
      expect(body().getByText('[[docs:mastra#workflows]]', { selector: 'code' })).toBeTruthy();
    });
  });

  describe('when a note mentions a page by its scope#path', () => {
    it('links the mention to the page the server resolved', () => {
      renderWithProviders(<Host initial="overview" initialView="page" />);
      const notes = within(screen.getByRole('region', { name: 'Notes' }));
      fireEvent.click(notes.getByRole('button', { name: 'docs:mastra#workflows/suspend-and-resume' }));
      expect(screen.getByTestId('selected').textContent).toBe('suspend');
    });
  });

  describe('when the graph shows pages whose bodies link each other', () => {
    const linkLines = (container: HTMLElement) =>
      [...container.querySelectorAll('.react-flow__edge')]
        .map(edge => edge.getAttribute('data-id'))
        .filter(id => id?.startsWith('link:'))
        .sort();

    it('draws none of them until all links are turned on, but counts them on each circle', () => {
      const { container } = renderWithProviders(<Host initial={null} initialView="graph" />);
      expect(linkLines(container)).toEqual([]);
      expect(screen.getByRole('button', { name: 'All links' }).getAttribute('aria-pressed')).toBe('false');
      const overview = container.querySelector('.react-flow__node [data-page-id="overview"]');
      expect(overview?.querySelector('[data-testid="knowledge-hidden-links"]')?.textContent).toBe('2→');
    });

    it("reads each circle's badge as links in on the left and links out on the right, and says so for a screen reader", () => {
      const { container } = renderWithProviders(<Host initial={null} initialView="graph" />);
      const badge = container
        .querySelector('.react-flow__node [data-page-id="overview"]')
        ?.querySelector('[data-testid="knowledge-hidden-links"]');
      expect(badge?.getAttribute('aria-label')).toBe('0 links in, 2 links out');
      expect(badge?.getAttribute('title')).toBe('0 links in, 2 links out');
      // A count of none is left off rather than written as 0.
      expect(badge?.textContent).toBe('2→');
    });

    it('draws a body-link line from the linking page to each page it links once all links are on', () => {
      const { container } = renderWithProviders(<Host initial={null} initialView="graph" />);
      fireEvent.click(screen.getByRole('button', { name: 'All links' }));
      expect(linkLines(container)).toEqual(['link:overview->suspend', 'link:overview->workflows']);
      expect(screen.getByTestId('knowledge-legend-link')).toBeTruthy();
    });
  });
  describe('when the exact link counts fail to refresh', () => {
    const counts = { overview: { in: 0, out: 9 } };
    const badge = (container: HTMLElement) =>
      container
        .querySelector('.react-flow__node [data-page-id="overview"]')
        ?.querySelector('[data-testid="knowledge-hidden-links"]');

    it('keeps drawing the last exact counts rather than the loaded-page numbers', () => {
      const failed: KnowledgeExplorerSource = {
        ...source,
        useLinkCounts: () => ({ data: counts, isPending: false, isError: true, error: new Error('refetch failed') }),
      };
      const { container } = renderWithProviders(
        <KnowledgePageExplorer
          graph={graph}
          source={failed}
          selectedPageId={null}
          onSelect={() => {}}
          view="graph"
          onViewChange={() => {}}
        />,
      );
      expect(badge(container)?.textContent).toBe('9→');
    });

    it('falls back to the loaded-page numbers only when there never were exact counts', () => {
      const never: KnowledgeExplorerSource = {
        ...source,
        useLinkCounts: () => ({ isPending: false, isError: true, error: new Error('unavailable') }),
      };
      const { container } = renderWithProviders(
        <KnowledgePageExplorer
          graph={graph}
          source={never}
          selectedPageId={null}
          onSelect={() => {}}
          view="graph"
          onViewChange={() => {}}
        />,
      );
      expect(badge(container)?.textContent).toBe('2→');
    });
  });

  describe('the graph toggles', () => {
    it('float over the graph, beside Back, and not in the toolbar', () => {
      renderWithProviders(<Host initial={null} initialView="graph" />);
      const canvas = screen.getByTestId('knowledge-graph-container');
      const back = screen.getByTestId('knowledge-graph-back');
      for (const name of ['All links', 'Link counts']) {
        const toggle = screen.getByRole('button', { name });
        expect(canvas.contains(toggle)).toBe(true);
        expect(toggle.parentElement).toBe(back.parentElement);
        expect(toggle.getAttribute('title')).toContain(name);
      }
    });

    it('are not shown in page view', () => {
      renderWithProviders(<Host initial="overview" initialView="page" />);
      expect(screen.queryByRole('button', { name: 'All links' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Link counts' })).toBeNull();
    });

    it('flip aria-pressed and say whether they are on when clicked', () => {
      renderWithProviders(<Host initial={null} initialView="graph" />);
      const toggle = screen.getByRole('button', { name: 'All links' });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.getAttribute('title')).toContain('off');
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.getAttribute('title')).toContain('on');
    });
  });

  describe('the Graph and Page toggle', () => {
    it('marks the current view as the selected tab', () => {
      renderWithProviders(<Host initial="overview" initialView="graph" />);
      expect(screen.getByRole('tab', { name: 'Graph' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Page' }).getAttribute('aria-selected')).toBe('false');
    });
  });
});
