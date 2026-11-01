// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgeNotePayload, KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerPageDetail,
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerTreeLevel,
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

function note(id: string, pageId: string, text: string, mentions: string[] = []): KnowledgeNotePayload {
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
const policies = page('policies', 'org', { name: 'Policies', key: 'policies', position: 'a0' });
const refund = page('refund', 'policies', {
  name: 'Refund Policy',
  key: 'refund',
  version: 3,
  updatedBy: { author: 'admin' },
  body: '## Limits\n\nRefunds over **$100** need a manager.\n\n<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>\n\n[bad](javascript:alert(1))',
});
const escalation = page('escalation', 'policies', { name: 'Escalation Process', key: 'escalation', position: 'a1' });
const children = Array.from({ length: 3 }, (_, index) =>
  page(`child-${index}`, 'refund', { name: `Child ${index}`, position: `a${index}` }),
);

const firstNotes = [note('n1', 'refund', 'First note')];
const laterNotes = [note('n2', 'refund', 'Later note')];

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

function detail(pageId: string, noteCursor?: string): KnowledgeExplorerPageDetail {
  const target = [org, policies, refund, escalation, ...children].find(candidate => candidate.id === pageId) ?? refund;
  if (pageId === 'refund') {
    return {
      page: refund,
      notes: noteCursor ? laterNotes : firstNotes,
      ...(noteCursor ? {} : { notesNextCursor: 'notes-2' }),
      ancestors: [org, policies],
      related: [escalation],
      mentionedBy: [note('m1', 'escalation', 'See [[Refund Policy]] first', ['refund'])],
    };
  }
  const ancestors =
    target.parentId === 'refund' ? [org, policies, refund] : target.parentId === 'policies' ? [org, policies] : [org];
  return { page: target, notes: [], ancestors, related: [] };
}

const levels: Record<string, KnowledgeExplorerTreeLevel> = {
  '': { pages: [org] },
  org: { pages: [policies] },
  policies: { pages: [refund], nextCursor: 'policies-2' },
  'policies@policies-2': { pages: [escalation] },
  refund: { pages: children.slice(0, 2), nextCursor: 'refund-2' },
  'refund@refund-2': { pages: children.slice(2) },
};

const source: KnowledgeExplorerSource = {
  usePage: (pageId, noteCursor) => (pageId ? ok(detail(pageId, noteCursor)) : idle),
  useSearch: () => ({ data: { results: [] } }),
  useTreeLevels: requests =>
    requests.map(({ parentId, cursor }) =>
      ok(levels[`${parentId ?? ''}${cursor ? `@${cursor}` : ''}`] ?? { pages: [] }),
    ),
  useActivity: () =>
    ok({
      events: [
        {
          id: 'a1',
          action: 'page-updated',
          scopeId: 'org',
          pageId: 'refund',
          provenance: { author: 'admin' },
          createdAt: '2026-10-29T10:00:00.000Z',
        },
      ],
    }),
};

const graph = { pages: [org, policies, refund, escalation], edges: [], pinnedIds: [], truncated: true };

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

const pageView = () => screen.getByRole('region', { name: 'Selected page' });

describe('KnowledgePageExplorer page view', () => {
  describe('when a page is open', () => {
    it('shows the page instead of the graph', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      expect(pageView()).toBeTruthy();
      expect(screen.queryByTestId('knowledge-graph-container')).toBeNull();
      expect(screen.getByRole('button', { name: 'Page' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('returns to the graph from the toggle, keeping the selection', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      fireEvent.click(screen.getByRole('button', { name: 'Graph' }));
      expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();
      expect(screen.getByTestId('knowledge-graph-container')).toBeTruthy();
      expect(within(screen.getByRole('tree')).getByRole('treeitem', { selected: true }).textContent).toContain(
        'Refund Policy',
      );
    });

    it('renders the body as markdown without letting raw HTML or script links through', () => {
      const { container } = renderWithProviders(<Host initial="refund" initialView="page" />);
      const body = screen.getByTestId('knowledge-page-body');
      expect(within(body).getByRole('heading', { name: 'Limits' })).toBeTruthy();
      expect(within(body).getByText('$100').tagName).toBe('STRONG');
      expect(container.querySelector('[data-testid="knowledge-page-body"] img')).toBeNull();
      expect(container.querySelector('[data-testid="knowledge-page-body"] script')).toBeNull();
      expect(container.querySelector('[data-testid="knowledge-page-body"] a[href^="javascript"]')).toBeNull();
      expect((window as { __pwned?: number }).__pwned).toBeUndefined();
    });

    it('shows where the page lives, its version and who last changed it', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      const view = within(pageView());
      expect(view.getByTestId('knowledge-page-path').textContent).toBe('org:acme#policies/refund');
      expect(view.getByTestId('knowledge-page-version').textContent).toMatch(/^Version 3 · updated .* by admin$/);
      const crumbs = within(view.getByRole('navigation', { name: 'Breadcrumb' }));
      expect(crumbs.getAllByRole('button').map(button => button.textContent)).toEqual(['Acme', 'Policies']);
    });

    it('lists child pages a page at a time and opens one', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      const childList = within(within(pageView()).getByRole('region', { name: 'Pages' }));
      expect(childList.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Child 0', 'Child 1']);
      fireEvent.click(childList.getByRole('button', { name: 'Load more' }));
      expect(childList.getAllByRole('listitem').map(item => item.textContent)).toEqual([
        'Child 0',
        'Child 1',
        'Child 2',
      ]);
      fireEvent.click(childList.getByRole('button', { name: 'Child 2' }));
      expect(within(pageView()).getByRole('heading', { name: 'Child 2' })).toBeTruthy();
    });

    it('starts the next page’s child list from its first batch, not where the last one was', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      const refundChildren = within(within(pageView()).getByRole('region', { name: 'Pages' }));
      fireEvent.click(refundChildren.getByRole('button', { name: 'Load more' }));
      expect(refundChildren.queryByRole('button', { name: 'Load more' })).toBeNull();

      const crumbs = within(within(pageView()).getByRole('navigation', { name: 'Breadcrumb' }));
      fireEvent.click(crumbs.getByRole('button', { name: 'Policies' }));
      const policyChildren = within(within(pageView()).getByRole('region', { name: 'Pages' }));
      expect(policyChildren.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Refund Policy']);
      expect(policyChildren.getByRole('button', { name: 'Load more' })).toBeTruthy();
    });

    it('loads more notes past the first page', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      const notes = within(within(pageView()).getByRole('region', { name: 'Notes' }));
      expect(notes.queryByText('Later note')).toBeNull();
      fireEvent.click(notes.getByRole('button', { name: 'Load more notes' }));
      expect(notes.getByText('First note')).toBeTruthy();
      expect(notes.getByText('Later note')).toBeTruthy();
    });

    it('lists notes elsewhere that mention the page, linking to where they sit', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      const mentioned = within(within(pageView()).getByRole('region', { name: 'Mentioned in' }));
      fireEvent.click(mentioned.getByRole('button', { name: 'Escalation Process' }));
      expect(within(pageView()).getByRole('heading', { name: 'Escalation Process' })).toBeTruthy();
    });

    it('shows the page activity', () => {
      renderWithProviders(<Host initial="refund" initialView="page" />);
      const activity = within(within(pageView()).getByRole('region', { name: 'Activity' }));
      expect(activity.getByText('Page edited')).toBeTruthy();
      expect(activity.getByText('Page edited').parentElement?.textContent).toMatch(/Page editedadmin · /);
    });
  });

  describe('when a page is clicked in the graph', () => {
    const escalationNode = async () => {
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const node = nodes.find(n => n.textContent?.includes('Escalation Process'));
      if (!node) throw new Error('no Escalation Process node');
      return node;
    };

    it('selects it on the first click and stays on the graph', async () => {
      renderWithProviders(<Host />);
      fireEvent.click(await escalationNode());
      expect(screen.getByTestId('view').textContent).toBe('graph');
      expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();
      expect((await escalationNode()).querySelector('.knowledge-circle')?.hasAttribute('data-selected')).toBe(true);
      const row = screen.getByRole('treeitem', { selected: true });
      expect(row.textContent).toContain('Escalation Process');
    });

    it('pins the view to the graph when it was opened in the default view', async () => {
      renderWithProviders(<Host initialView="tree" />);
      fireEvent.click(await escalationNode());
      expect(screen.getByTestId('view').textContent).toBe('graph');
      expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();
    });

    it('clears the selection on a click on empty canvas', async () => {
      const { container } = renderWithProviders(<Host />);
      fireEvent.click(await escalationNode());
      expect(screen.getAllByTestId('knowledge-page-node').some(node => node.style.opacity === '0.35')).toBe(true);

      const pane = container.querySelector('.react-flow__pane');
      if (!pane) throw new Error('no graph pane');
      fireEvent.pointerDown(pane, { clientX: 40, clientY: 40 });
      fireEvent.click(pane, { clientX: 40, clientY: 40 });

      expect((await escalationNode()).querySelector('.knowledge-circle')?.hasAttribute('data-selected')).toBe(false);
      expect(screen.queryByRole('treeitem', { selected: true })).toBeNull();
      expect(screen.getAllByTestId('knowledge-page-node').every(node => node.style.opacity === '1')).toBe(true);
      expect(screen.getByTestId('view').textContent).toBe('graph');
    });

    it('keeps the selection when the canvas is dragged', async () => {
      const { container } = renderWithProviders(<Host />);
      fireEvent.click(await escalationNode());

      const pane = container.querySelector('.react-flow__pane');
      if (!pane) throw new Error('no graph pane');
      fireEvent.pointerDown(pane, { clientX: 40, clientY: 40 });
      fireEvent.click(pane, { clientX: 140, clientY: 90 });

      expect((await escalationNode()).querySelector('.knowledge-circle')?.hasAttribute('data-selected')).toBe(true);
      expect(screen.getByRole('treeitem', { selected: true }).textContent).toContain('Escalation Process');
    });

    it('opens it as a page on the second click', async () => {
      renderWithProviders(<Host />);
      fireEvent.click(await escalationNode());
      fireEvent.click(await escalationNode());
      expect(screen.getByTestId('view').textContent).toBe('page');
      expect(within(pageView()).getByRole('heading', { name: 'Escalation Process' })).toBeTruthy();
    });

    it('selects then opens it with Enter on the focused node', async () => {
      renderWithProviders(<Host />);
      const wrapper = async () => {
        const node = (await escalationNode()).closest('.react-flow__node');
        if (!node) throw new Error('no node wrapper');
        return node;
      };
      fireEvent.keyDown(await wrapper(), { key: 'Enter' });
      expect(screen.getByTestId('view').textContent).toBe('graph');
      fireEvent.keyDown(await wrapper(), { key: ' ' });
      expect(screen.getByTestId('view').textContent).toBe('page');
    });
  });

  describe('the tree, loaded a level at a time', () => {
    it('opens levels on demand and pages through long ones', () => {
      renderWithProviders(<Host />);
      const tree = within(screen.getByRole('tree'));
      expect(tree.getAllByRole('treeitem').map(row => row.textContent)).toEqual(['Acmeorg:acme', 'Policies']);
      fireEvent.click(tree.getByRole('button', { name: 'Expand Policies' }));
      expect(tree.getByRole('treeitem', { name: /Refund Policy/ })).toBeTruthy();
      expect(tree.queryByText('Escalation Process')).toBeNull();
      fireEvent.click(tree.getByRole('button', { name: 'Load more' }));
      expect(tree.getByText('Escalation Process')).toBeTruthy();
    });

    it('opens the path to a page selected outside the loaded levels', () => {
      renderWithProviders(<Host initial="child-2" initialView="page" />);
      const tree = within(screen.getByRole('tree'));
      expect(tree.getByRole('treeitem', { selected: true }).textContent).toContain('Child 2');
    });
  });
});
