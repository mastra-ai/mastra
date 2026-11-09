// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgeNotePayload, KnowledgePageEdge, KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerView,
} from '../KnowledgePageExplorer';
import { KnowledgePageExplorer } from '../KnowledgePageExplorer';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: parentId === null ? id : 'org',
    parentId,
    isScope: parentId === null,
    position: 'a0',
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
    ...extra,
  };
}

function note(id: string, pageId: string, text: string, mentions: string[]): KnowledgeNotePayload {
  return {
    id,
    pageId,
    text,
    stampScopeIds: ['org'],
    mentions,
    provenance: { author: 'support-agent' },
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
  };
}

const org = page('org', null, { name: 'Acme', address: 'org:acme' });
const team = page('team', null, { name: 'Support team', address: 'team:support', displayLabel: 'Team' });
const refunds = page('refunds', 'org', { name: 'Refunds' });
const roadmap = page('roadmap', 'org', { name: 'Roadmap', position: 'a1' });
const macros = page('macros', 'team', { name: 'Macros', scopeId: 'team' });

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

const refundsNotes = [
  note('n1', 'refunds', 'Big refunds wait for [[Roadmap]] item 4', ['roadmap']),
  note('n2', 'refunds', 'Unrelated note', []),
];

const source: KnowledgeExplorerSource = {
  usePage: pageId => {
    if (!pageId) return idle;
    const target = [org, team, refunds, roadmap, macros].find(candidate => candidate.id === pageId) ?? refunds;
    return ok({
      page: target,
      notes: pageId === 'refunds' ? refundsNotes : [],
      ancestors: target.parentId === 'org' ? [org] : target.parentId === 'team' ? [team] : [],
      related: [],
    });
  },
  useSearch: () => ({ data: { results: [] } }),
};

const edges: KnowledgePageEdge[] = [
  { source: 'org', target: 'refunds', kind: 'parent' },
  { source: 'org', target: 'roadmap', kind: 'parent' },
  { source: 'team', target: 'macros', kind: 'parent' },
  { source: 'refunds', target: 'roadmap', kind: 'mention' },
];
const graph = { pages: [org, team, refunds, roadmap, macros], edges, pinnedIds: [], truncated: false };

function Host({ initialView = 'graph' }: { initialView?: KnowledgeExplorerView }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<KnowledgeExplorerView>(initialView);
  return (
    <KnowledgePageExplorer
      source={source}
      graph={graph}
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

const tree = () => screen.getByRole('tree', { name: 'Knowledge pages' });
const treeNames = () =>
  within(tree())
    .getAllByRole('treeitem')
    .map(item => item.getAttribute('aria-label') ?? item.textContent);

describe('KnowledgePageExplorer scope focus', () => {
  it('shows only the clicked scope and its pages in the tree and graph, until All scopes', async () => {
    renderWithProviders(<Host />);
    await screen.findAllByTestId('knowledge-page-node');
    fireEvent.click(within(tree()).getByText('Support team'));

    const focus = screen.getByTestId('knowledge-scope-focus');
    expect(focus.textContent).toContain('Team');
    expect(focus.textContent).toContain('Support team');
    await waitFor(() => expect(within(tree()).queryByText('Refunds')).toBeNull());
    expect(within(tree()).getByText('Macros')).toBeTruthy();
    // Labelled circles and dots alike.
    const graphIds = () =>
      [...document.querySelectorAll('.react-flow__node [data-page-id]')].map(node => node.getAttribute('data-page-id'));
    await waitFor(() => expect(graphIds().sort()).toEqual(['macros', 'team']));

    fireEvent.click(within(focus).getByRole('button', { name: 'All scopes' }));
    expect(screen.queryByTestId('knowledge-scope-focus')).toBeNull();
    expect(within(tree()).getByText('Refunds')).toBeTruthy();
    await waitFor(() => expect(graphIds()).toHaveLength(5));
    expect(treeNames().length).toBeGreaterThan(0);
  });
});

describe('KnowledgePageExplorer mention popup', () => {
  it('lists the notes that make a mention when its line is clicked, without leaving the graph', async () => {
    const { container } = renderWithProviders(<Host />);
    await screen.findAllByTestId('knowledge-page-node');
    // Lines between pages other than the selected one are drawn once all links are on.
    fireEvent.click(screen.getByRole('button', { name: 'All links' }));
    const line = container.querySelector('[data-id="mention:refunds->roadmap"]');
    if (!line) throw new Error('mention line not drawn');
    fireEvent.click(line);

    const popup = await screen.findByRole('dialog', { name: /Refunds mentions Roadmap/ });
    expect(within(popup).getByText(/item 4/)).toBeTruthy();
    expect(within(popup).queryByText('Unrelated note')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Graph' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes when empty canvas is clicked', async () => {
    const { container } = renderWithProviders(<Host />);
    await screen.findAllByTestId('knowledge-page-node');
    // Lines between pages other than the selected one are drawn once all links are on.
    fireEvent.click(screen.getByRole('button', { name: 'All links' }));
    const line = container.querySelector('[data-id="mention:refunds->roadmap"]');
    if (!line) throw new Error('mention line not drawn');
    fireEvent.click(line);
    await screen.findByRole('dialog', { name: /Refunds mentions Roadmap/ });

    const pane = container.querySelector('.react-flow__pane');
    if (!pane) throw new Error('no graph pane');
    fireEvent.pointerDown(pane, { clientX: 20, clientY: 20 });
    fireEvent.click(pane, { clientX: 20, clientY: 20 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens the mentioning page from the popup', async () => {
    const { container } = renderWithProviders(<Host />);
    await screen.findAllByTestId('knowledge-page-node');
    // Lines between pages other than the selected one are drawn once all links are on.
    fireEvent.click(screen.getByRole('button', { name: 'All links' }));
    const line = container.querySelector('[data-id="mention:refunds->roadmap"]');
    if (!line) throw new Error('mention line not drawn');
    fireEvent.click(line);
    const popup = await screen.findByRole('dialog', { name: /Refunds mentions Roadmap/ });
    fireEvent.click(within(popup).getByRole('button', { name: 'Refunds' }));
    expect(await screen.findByRole('article', { name: 'Refunds' })).toBeTruthy();
  });
});

describe('KnowledgePageExplorer search', () => {
  const searchSource: KnowledgeExplorerSource = {
    ...source,
    useSearch: query => ({ data: { results: query.length >= 2 ? [{ page: roadmap }] : [] } }),
  };
  function SearchHost({ initialView }: { initialView: KnowledgeExplorerView }) {
    const [selected, setSelected] = useState<string | null>(null);
    const [view, setView] = useState<KnowledgeExplorerView>(initialView);
    return (
      <KnowledgePageExplorer
        source={searchSource}
        graph={graph}
        selectedPageId={selected}
        onSelect={setSelected}
        view={view}
        onViewChange={setView}
      />
    );
  }
  const search = (name: string) => {
    fireEvent.change(screen.getByLabelText('Search knowledge'), { target: { value: 'ro' } });
    fireEvent.click(screen.getByRole('button', { name }));
  };
  const pressed = (name: string) => screen.getByRole('tab', { name }).getAttribute('aria-selected');

  it('in graph view, focuses the result and stays on the graph; a second pick opens it', async () => {
    renderWithProviders(<SearchHost initialView="graph" />);
    await screen.findAllByTestId('knowledge-page-node');
    search('Roadmap');
    expect(pressed('Graph')).toBe('true');
    expect(pressed('Page')).toBe('false');
    await waitFor(() =>
      expect(document.querySelector('[data-page-id="roadmap"] .knowledge-circle')?.getAttribute('data-selected')).toBe(
        'true',
      ),
    );
    search('Roadmap');
    expect(pressed('Page')).toBe('true');
  });

  it('leaves a scope focus the result falls outside of, whether it focuses or opens', async () => {
    for (const initialView of ['graph', 'page'] as const) {
      const { unmount } = renderWithProviders(<SearchHost initialView={initialView} />);
      await screen.findAllByTestId('knowledge-page-node');
      fireEvent.click(within(tree()).getByText('Support team'));
      expect(screen.getByTestId('knowledge-scope-focus')).toBeTruthy();
      search('Roadmap');
      expect(screen.queryByTestId('knowledge-scope-focus')).toBeNull();
      unmount();
    }
  });

  it('in page view, opens the result as a page, as before', () => {
    renderWithProviders(<SearchHost initialView="page" />);
    search('Roadmap');
    expect(pressed('Page')).toBe('true');
  });
});
