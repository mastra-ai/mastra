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

const org = page('org', null, { name: 'Acme', address: 'org:acme' });
const onboarding = page('onboarding', 'org', {
  name: 'Customer onboarding',
  description: 'Taking a new workspace from trial to production.',
});
const billing = page('billing', 'org', { name: 'Billing and refunds', position: 'a1' });
const pages = [org, onboarding, billing];

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

function detail(pageId: string): KnowledgeExplorerPageDetail {
  const target = pages.find(candidate => candidate.id === pageId) ?? onboarding;
  return { page: target, notes: [], ancestors: target.parentId ? [org] : [], related: [] };
}

const source: KnowledgeExplorerSource = {
  usePage: pageId => (pageId ? ok(detail(pageId)) : idle),
  useSearch: () => ({ data: { results: [] } }),
};

const graph = { pages, edges: [], pinnedIds: [], truncated: false };

function Host({
  initial = null,
  initialView = 'graph',
}: {
  initial?: string | null;
  initialView?: KnowledgeExplorerView;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [view, setView] = useState<KnowledgeExplorerView>(initialView);
  return (
    <>
      <output data-testid="view">{view}</output>
      <output data-testid="selected">{selected ?? ''}</output>
      <button type="button" onClick={() => setSelected(null)}>
        Host clears the selection
      </button>
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

const pageDrawer = () => screen.getByRole('region', { name: 'Page details' });
const treeDrawer = () => screen.getByRole('region', { name: 'Pages' });
const noPageDrawer = () => screen.queryByRole('region', { name: 'Page details' }) === null;
const noTreeDrawer = () => screen.queryByRole('region', { name: 'Pages' }) === null;

describe('KnowledgePageExplorer drawers', () => {
  it('keeps the same tree when switching between the graph and the page', () => {
    renderWithProviders(<Host initial="onboarding" />);
    const tree = within(treeDrawer()).getByRole('tree', { name: 'Knowledge pages' });
    fireEvent.click(within(pageDrawer()).getByRole('button', { name: 'Open page' }));
    expect(within(treeDrawer()).getByRole('tree', { name: 'Knowledge pages' })).toBe(tree);
  });

  it('collapses the page tree and brings it back', () => {
    renderWithProviders(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide pages' }));
    expect(noTreeDrawer()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Show pages' }));
    expect(within(treeDrawer()).getByRole('tree', { name: 'Knowledge pages' })).toBeTruthy();
  });

  it('opens the selected page in a drawer over the graph', () => {
    renderWithProviders(<Host initial="onboarding" />);
    const drawer = pageDrawer();
    expect(screen.getByTestId('knowledge-graph-container').contains(drawer)).toBe(true);
    expect(within(drawer).getByRole('heading', { name: 'Customer onboarding' })).toBeTruthy();
    expect(screen.getByTestId('view').textContent).toBe('graph');
  });

  it('shows no page drawer while nothing is selected', () => {
    renderWithProviders(<Host />);
    expect(noPageDrawer()).toBe(true);
  });

  it('opens the full page from the drawer', () => {
    renderWithProviders(<Host initial="onboarding" />);
    fireEvent.click(within(pageDrawer()).getByRole('button', { name: 'Open page' }));
    expect(screen.getByTestId('view').textContent).toBe('page');
    expect(screen.getByRole('region', { name: 'Selected page' })).toBeTruthy();
  });

  it('closes the drawer by clearing the selection', () => {
    renderWithProviders(<Host initial="onboarding" />);
    fireEvent.click(within(pageDrawer()).getByRole('button', { name: 'Close page details' }));
    expect(noPageDrawer()).toBe(true);
    expect(screen.getByTestId('selected').textContent).toBe('');
  });

  it('treats a tree view as the graph on a wide screen, so a tree pick opens the drawer', () => {
    renderWithProviders(<Host initialView="tree" />);
    expect(screen.getByRole('tab', { name: 'Graph' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(within(treeDrawer()).getByRole('treeitem', { name: /Customer onboarding/ }));
    expect(screen.getByTestId('view').textContent).toBe('graph');
    expect(within(pageDrawer()).getByRole('heading', { name: 'Customer onboarding' })).toBeTruthy();
  });

  it('fades out the page that was showing, not one closed earlier', () => {
    renderWithProviders(<Host initial="onboarding" />);
    fireEvent.click(within(pageDrawer()).getByRole('button', { name: 'Close page details' }));
    fireEvent.click(within(treeDrawer()).getByRole('treeitem', { name: /Billing and refunds/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Host clears the selection' }));
    const closing = screen.getByRole('region', { name: 'Page details', hidden: true });
    expect(within(closing).getByRole('heading', { name: 'Billing and refunds', hidden: true })).toBeTruthy();
    const drawer = closing.closest('[data-state="closed"]');
    if (!drawer) throw new Error('no closing drawer');
    fireEvent.transitionEnd(drawer);
    expect(screen.queryByRole('region', { name: 'Page details', hidden: true })).toBeNull();
  });

  it('moves focus to the Graph tab when the drawer closes', () => {
    renderWithProviders(<Host initial="onboarding" />);
    const close = within(pageDrawer()).getByRole('button', { name: 'Close page details' });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Graph' }));
  });

  it('moves focus to the Page tab when the drawer opens the full page', () => {
    renderWithProviders(<Host initial="onboarding" />);
    const open = within(pageDrawer()).getByRole('button', { name: 'Open page' });
    open.focus();
    fireEvent.click(open);
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Page' }));
  });

  it('keeps focus on the tree toggle as the tree hides and shows', () => {
    renderWithProviders(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide pages' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show pages' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show pages' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide pages' }));
  });

  it('keeps the tree beside the page in the page view', () => {
    renderWithProviders(<Host initial="onboarding" initialView="page" />);
    expect(screen.queryByTestId('knowledge-graph-container')).toBeNull();
    expect(within(treeDrawer()).getByRole('tree', { name: 'Knowledge pages' })).toBeTruthy();
    expect(noPageDrawer()).toBe(true);
  });
});
