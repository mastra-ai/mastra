// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import type { KnowledgeExplorerSource, KnowledgeExplorerView } from '../KnowledgePageExplorer';
import { KnowledgePageExplorer } from '../KnowledgePageExplorer';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}) {
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
  } satisfies KnowledgePagePayload;
}

const org = page('org', null, { name: 'Acme' });
const refunds = page('refunds', 'org', { name: 'Refunds', body: 'Refunds take 5 days' });
const archived = page('archived', 'outside', { name: 'Archived' });
const graph = { pages: [org, refunds], edges: [], pinnedIds: [], truncated: true };

const source: KnowledgeExplorerSource = {
  usePage: pageId =>
    pageId === null
      ? { isPending: false, isError: false, error: null }
      : pageId === 'missing'
        ? { isPending: false, isError: true, error: Object.assign(new Error('gone'), { status: 404 }) }
        : {
            isPending: false,
            isError: false,
            error: null,
            data: { page: pageId === 'archived' ? archived : refunds, notes: [], ancestors: [org], related: [] },
          },
  useSearch: query => ({
    data: { results: query.includes('arch') ? [{ page: archived }, { page: archived }] : [] },
  }),
};

function Host({
  initial = null,
  initialView = 'tree',
}: {
  initial?: string | null;
  initialView?: KnowledgeExplorerView;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [view, setView] = useState<KnowledgeExplorerView>(initialView);
  return (
    <KnowledgePageExplorer
      graph={graph}
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

describe('KnowledgePageExplorer', () => {
  it('opens the page selected in the tree', () => {
    renderWithProviders(<Host />);
    expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();
    fireEvent.click(within(screen.getByRole('tree')).getByText('Refunds'));
    const detail = screen.getByRole('region', { name: 'Selected page' });
    expect(within(detail).getByText('Refunds take 5 days')).toBeTruthy();
  });

  it('selects a search hit outside the loaded graph, listing each page once', () => {
    renderWithProviders(<Host />);
    fireEvent.change(screen.getByLabelText('Search knowledge'), { target: { value: 'arch' } });
    const results = within(screen.getByRole('listbox', { name: 'Search results' }));
    expect(results.getAllByRole('option')).toHaveLength(1);
    fireEvent.click(results.getByRole('button', { name: 'Archived' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Selected page' })).getByText('Archived')).toBeTruthy();
  });

  it('says when a selected page is gone', () => {
    renderWithProviders(<Host initial="missing" initialView="page" />);
    expect(screen.getByText('Page not found')).toBeTruthy();
  });

  it('says a linked page is gone while the graph is showing', () => {
    renderWithProviders(<Host initial="missing" initialView="graph" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Page not found');
    // `text-destructive` isn't a theme colour and renders as plain ink; the error colour is this one.
    expect(alert.classList.contains('text-destructive-foreground')).toBe(true);
  });

  it('marks pinned pages in the tree', () => {
    renderWithProviders(
      <KnowledgePageExplorer
        graph={{ ...graph, pinnedIds: ['refunds'] }}
        source={source}
        selectedPageId={null}
        onSelect={() => {}}
        view="tree"
        onViewChange={() => {}}
      />,
    );
    const tree = screen.getByRole('tree');
    const pinned = within(tree)
      .getAllByRole('treeitem')
      .filter(row => within(row).queryByLabelText('Pinned'));
    expect(pinned.map(row => row.textContent)).toEqual(['Refunds']);
  });

  it('toggles between tree and graph and notes a truncated graph', () => {
    renderWithProviders(<Host />);
    expect(
      screen.getByText('The graph shows the first 2 pages. Open the tree or search to reach the rest.'),
    ).toBeTruthy();
    const graphButton = screen.getByRole('button', { name: 'Graph' });
    expect(graphButton.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(graphButton);
    expect(graphButton.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('knowledge-graph-container').className).toContain('block');
  });
});
