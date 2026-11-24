import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  KnowledgeExplorerGraph,
  KnowledgeExplorerPageDetail,
} from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import type { KnowledgePagePayload } from '@mastra/playground-ui/domains/knowledge/pageTypes';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const KNOWLEDGE = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge`;

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: parentId === null ? id : 'project',
    parentId,
    isScope: false,
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

const org = page('org', null, { isScope: true, address: 'org:org-1', name: 'Mastra' });
const project = page('project', 'org', {
  scopeId: 'project',
  isScope: true,
  address: `project:${FACTORY_ID}`,
  name: 'Acme Factory',
});
const runbook = page('runbook', 'project', { name: 'Deploy runbook', body: 'Deploys run nightly.' });
const handbook = page('handbook', 'org', { scopeId: 'org', name: 'Handbook' });
const archived = page('archived', 'project', { name: 'Archived runbook' });

const graphFixture: KnowledgeExplorerGraph = {
  pages: [org, project, runbook, handbook],
  edges: [{ source: 'runbook', target: 'handbook', kind: 'mention', count: 1 }],
  pinnedIds: ['runbook'],
  truncated: false,
};

const detail = (target: KnowledgePagePayload): KnowledgeExplorerPageDetail => ({
  page: target,
  notes: [
    {
      id: `note-${target.id}`,
      pageId: target.id,
      text: 'Follow the [[Handbook]] first',
      stampScopeIds: ['project'],
      mentions: ['handbook'],
      provenance: { author: 'agent:alex' },
      createdAt: '2026-10-28T00:00:00.000Z',
      updatedAt: '2026-10-28T00:00:00.000Z',
    },
  ],
  pin: null,
  ancestors: [org, project],
  related: [handbook],
});

function stubFactory(features: { knowledge: boolean } = { knowledge: true }) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json(features)),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory', repositories: [] }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-records`, () =>
      HttpResponse.json({ workRecords: [] }),
    ),
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
      () => new HttpResponse(null, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({}),
    ),
  );
}

function stubKnowledge(graph: KnowledgeExplorerGraph | { status: number; message: string } = graphFixture) {
  stubFactory();
  server.use(
    http.get(`${KNOWLEDGE}/graph`, () =>
      'status' in graph
        ? HttpResponse.json({ error: 'failed', message: graph.message }, { status: graph.status })
        : HttpResponse.json(graph),
    ),
    http.get(`${KNOWLEDGE}/pages/:pageId`, ({ params }) => {
      const target = [...graphFixture.pages, archived].find(candidate => candidate.id === params.pageId);
      return target
        ? HttpResponse.json(detail(target))
        : HttpResponse.json({ error: 'page_not_found' }, { status: 404 });
    }),
    http.get(`${KNOWLEDGE}/tree`, ({ request }) => {
      const parentId = new URL(request.url).searchParams.get('parentId');
      const pages = [...graphFixture.pages, archived].filter(candidate => candidate.parentId === parentId);
      return HttpResponse.json({ pages, truncated: false });
    }),
    http.get(`${KNOWLEDGE}/activity`, () => HttpResponse.json({ events: [] })),
    // A server without the change stream: the page falls back to polling.
    http.get(`${KNOWLEDGE}/events`, () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
    http.get(`${KNOWLEDGE}/search`, ({ request }) => {
      const query = new URL(request.url).searchParams.get('q') ?? '';
      return HttpResponse.json({ results: query.includes('arch') ? [{ page: archived }] : [] });
    }),
  );
}

function renderRoute(path = `/factories/${FACTORY_ID}/knowledge`) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('KnowledgePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when the tree arrives before the graph', () => {
    it('keeps the selected tree page when the overview supplies its pins', async ({ onTestFinished }) => {
      stubKnowledge();
      let releaseOverview!: () => void;
      const pending = new Promise<void>(resolve => {
        releaseOverview = resolve;
      });
      onTestFinished(releaseOverview);
      server.use(
        http.get(`${KNOWLEDGE}/graph`, async () => {
          await pending;
          return HttpResponse.json(graphFixture);
        }),
      );
      const { router } = renderRoute();
      const tree = await screen.findByRole('tree', {}, { timeout: 5_000 });
      fireEvent.click(await within(tree).findByRole('button', { name: 'Expand Acme Factory' }));
      fireEvent.click(await within(tree).findByText('Deploy runbook'));
      const runbookRow = () => screen.getByRole('treeitem', { name: /Deploy runbook/ });
      await waitFor(() => expect(runbookRow()).toHaveAttribute('aria-selected', 'true'));
      expect(within(runbookRow()).queryByLabelText('Pinned')).toBeNull();

      releaseOverview();
      await waitFor(() => expect(within(runbookRow()).getByLabelText('Pinned')).toBeInTheDocument());
      expect(runbookRow()).toHaveAttribute('aria-selected', 'true');
      expect(router.state.location.search).toContain('page=runbook');
    });

    it('keeps the selected tree page when the overview fails, and says why the graph is incomplete', async ({
      onTestFinished,
    }) => {
      stubKnowledge();
      let failOverview!: () => void;
      const pending = new Promise<void>(resolve => {
        failOverview = resolve;
      });
      onTestFinished(failOverview);
      server.use(
        http.get(`${KNOWLEDGE}/graph`, async () => {
          await pending;
          return HttpResponse.json({ error: 'failed', message: 'The graph read timed out.' }, { status: 500 });
        }),
      );
      const { router } = renderRoute();
      const tree = await screen.findByRole('tree', {}, { timeout: 5_000 });
      fireEvent.click(await within(tree).findByRole('button', { name: 'Expand Acme Factory' }));
      fireEvent.click(await within(tree).findByText('Deploy runbook'));
      const runbookRow = () => screen.getByRole('treeitem', { name: /Deploy runbook/ });
      await waitFor(() => expect(runbookRow()).toHaveAttribute('aria-selected', 'true'));

      failOverview();
      expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent('The graph read timed out.');
      expect(runbookRow()).toHaveAttribute('aria-selected', 'true');
      expect(router.state.location.search).toContain('page=runbook');
    });
  });

  it('keeps the mobile drawer trigger in the header while feature flags load', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    stubFactory();
    server.use(http.get(`${TEST_BASE_URL}/web/config/features`, () => new Promise<Response>(() => {})));
    renderRoute();

    expect(await screen.findByLabelText('Loading page')).toBeInTheDocument();
    const header = screen.getByRole('banner');
    await userEvent.click(within(header).getByRole('button', { name: 'Open navigation menu' }));
    expect(await screen.findByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
  });

  it('redirects direct knowledge links when the server-side feature is disabled', async () => {
    stubFactory({ knowledge: false });
    const { router } = renderRoute();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
  });

  it('frames a tree page in the graph on the first click, opens it on the second, and keeps it in the URL', async () => {
    stubKnowledge();
    const { router } = renderRoute();
    const tree = await screen.findByRole('tree');
    fireEvent.click(await within(tree).findByRole('button', { name: 'Expand Acme Factory' }));
    fireEvent.click(await within(tree).findByText('Deploy runbook'));
    await waitFor(() => expect(router.state.location.search).toContain('page=runbook'));
    expect(router.state.location.search).toContain('view=graph');
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId('knowledge-page-node')
          .find(node => node.dataset.pageId === 'runbook')
          ?.querySelector('.knowledge-circle'),
      ).toHaveAttribute('data-selected'),
    );
    expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();

    fireEvent.click(within(tree).getByText('Deploy runbook'));
    const pane = await screen.findByRole('region', { name: 'Selected page' });
    expect(await within(pane).findByText('Deploys run nightly.')).toBeInTheDocument();
    expect(router.state.location.search).toContain('page=runbook');
  });

  it('shows an edit an agent makes to the open page without a reload', async () => {
    stubKnowledge();
    let body = 'Deploys run nightly.';
    server.use(
      http.get(`${KNOWLEDGE}/pages/:pageId`, ({ params }) => {
        const target = graphFixture.pages.find(candidate => candidate.id === params.pageId);
        return target
          ? HttpResponse.json(detail({ ...target, body }))
          : HttpResponse.json({ error: 'page_not_found' }, { status: 404 });
      }),
    );
    renderRoute(`/factories/${FACTORY_ID}/knowledge?page=runbook`);
    const pane = await screen.findByRole('region', { name: 'Selected page' });
    expect(await within(pane).findByText('Deploys run nightly.')).toBeInTheDocument();
    body = 'Deploys run hourly.';
    expect(await within(pane).findByText('Deploys run hourly.', {}, { timeout: 8_000 })).toBeInTheDocument();
  }, 15_000);

  it('shows an edit as soon as the change stream announces it', async () => {
    stubKnowledge();
    let body = 'Deploys run nightly.';
    let push: ((frame: string) => void) | undefined;
    server.use(
      http.get(`${KNOWLEDGE}/pages/:pageId`, ({ params }) => {
        const target = graphFixture.pages.find(candidate => candidate.id === params.pageId);
        return target
          ? HttpResponse.json(detail({ ...target, body }))
          : HttpResponse.json({ error: 'page_not_found' }, { status: 404 });
      }),
      http.get(`${KNOWLEDGE}/events`, () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(': connected\n\n'));
            push = frame => controller.enqueue(encoder.encode(frame));
          },
        });
        return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );
    renderRoute(`/factories/${FACTORY_ID}/knowledge?page=runbook`);
    const pane = await screen.findByRole('region', { name: 'Selected page' });
    expect(await within(pane).findByText('Deploys run nightly.')).toBeInTheDocument();
    await waitFor(() => expect(push).toBeDefined());

    body = 'Deploys run hourly.';
    push!(
      `event: change\ndata: ${JSON.stringify({ kind: 'page', op: 'update', pageId: 'runbook', at: '2026-10-28T00:00:01.000Z' })}\n\n`,
    );
    // Well inside the 5s poll: only the stream can have refreshed it.
    expect(await within(pane).findByText('Deploys run hourly.', {}, { timeout: 2_000 })).toBeInTheDocument();
  });

  it('shows a page an agent adds in the tree without a reload', async () => {
    stubKnowledge();
    const added = page('added', 'project', { name: 'Incident review' });
    let pages = [...graphFixture.pages, archived];
    server.use(
      http.get(`${KNOWLEDGE}/tree`, ({ request }) => {
        const parentId = new URL(request.url).searchParams.get('parentId');
        return HttpResponse.json({
          pages: pages.filter(candidate => candidate.parentId === parentId),
          truncated: false,
        });
      }),
    );
    renderRoute();
    const tree = await screen.findByRole('tree');
    fireEvent.click(await within(tree).findByRole('button', { name: 'Expand Acme Factory' }));
    expect(await within(tree).findByText('Deploy runbook')).toBeInTheDocument();
    pages = [...pages, added];
    expect(await within(tree).findByText('Incident review', {}, { timeout: 8_000 })).toBeInTheDocument();
  }, 15_000);

  it('says when a page linked into the graph does not exist', async () => {
    stubKnowledge();
    renderRoute(`/factories/${FACTORY_ID}/knowledge?page=missing&view=graph`);
    expect((await screen.findByRole('alert')).textContent).toContain('Page not found');
  });

  it('opens a deep-linked page and a search hit outside the loaded graph', async () => {
    stubKnowledge();
    renderRoute(`/factories/${FACTORY_ID}/knowledge?page=runbook`);
    const pane = await screen.findByRole('region', { name: 'Selected page' });
    expect(await within(pane).findByText('Deploys run nightly.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search knowledge'), { target: { value: 'arch' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Archived runbook' }));
    expect(
      await within(screen.getByRole('region', { name: 'Selected page' })).findByRole('heading', {
        name: 'Archived runbook',
      }),
    ).toBeInTheDocument();
  });

  it.each([
    ['with ?view=graph', '?view=graph'],
    ['with no query params', ''],
  ])('selects a graph page on the first click and opens it on the second (%s)', async (_, query) => {
    stubKnowledge();
    const { router } = renderRoute(`/factories/${FACTORY_ID}/knowledge${query}`);
    const graphNode = (pageId: string) =>
      waitFor(() => {
        const node = screen.getAllByTestId('knowledge-page-node').find(n => n.dataset.pageId === pageId);
        if (!node) throw new Error(`${pageId} not drawn`);
        return node;
      });
    const runbookNode = () => graphNode('runbook');
    // The graph loads a level at a time: focusing the project scope draws the pages inside it.
    fireEvent.click(await graphNode('project'));
    await waitFor(() => expect(router.state.location.search).toContain('page=project'));
    fireEvent.click(await runbookNode());
    await waitFor(() => expect(router.state.location.search).toContain('page=runbook'));
    expect(router.state.location.search).toContain('view=graph');
    expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();
    expect((await runbookNode()).querySelector('.knowledge-circle')).toHaveAttribute('data-selected');

    fireEvent.click(await runbookNode());
    const pane = await screen.findByRole('region', { name: 'Selected page' });
    expect(await within(pane).findByText('Deploys run nightly.')).toBeInTheDocument();
    expect(router.state.location.search).toContain('view=page');
  });

  it('drops the selected page from the URL on a click on empty graph canvas', async () => {
    stubKnowledge();
    const { router, container } = renderRoute(`/factories/${FACTORY_ID}/knowledge?view=graph&page=runbook`);
    await screen.findAllByTestId('knowledge-page-node');
    const pane = container.querySelector('.react-flow__pane');
    if (!pane) throw new Error('no graph pane');
    fireEvent.pointerDown(pane, { clientX: 30, clientY: 30 });
    fireEvent.click(pane, { clientX: 30, clientY: 30 });
    await waitFor(() => expect(router.state.location.search).not.toContain('page='));
    expect(router.state.location.search).toContain('view=graph');
  });

  it('draws the grants the server sends from the principal scope to the scope it reaches', async () => {
    stubKnowledge({
      ...graphFixture,
      grants: [{ principal: 'org:org-1', principalId: 'org', target: 'project', role: 'contributor' }],
    });
    const { container } = renderRoute(`/factories/${FACTORY_ID}/knowledge?view=graph`);
    await screen.findAllByTestId('knowledge-page-node');
    await waitFor(() => expect(container.querySelector('[data-testid="knowledge-grant-edge"]')).not.toBeNull());
    const grant = container.querySelector<SVGPathElement>('[data-testid="knowledge-grant-edge"]');
    expect(grant?.closest('.react-flow__edge')?.getAttribute('data-id')).toBe('grant:org->project');
    expect(grant?.dataset.role).toBe('contributor');
    expect(screen.getByTestId('knowledge-legend-grant')).toBeInTheDocument();
  });

  it('says when a linked page is gone', async () => {
    stubKnowledge();
    renderRoute(`/factories/${FACTORY_ID}/knowledge?page=missing`);
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('explains an empty project', async () => {
    stubKnowledge({ pages: [], edges: [], pinnedIds: [], truncated: false });
    renderRoute();
    expect(
      await screen.findByText('No knowledge in this project yet. Pages appear here as factory sessions write them.'),
    ).toBeInTheDocument();
  });

  it('says why when neither the tree nor the graph can load', async () => {
    stubKnowledge({ status: 500, message: 'Knowledge is misconfigured' });
    server.use(
      http.get(`${KNOWLEDGE}/tree`, () =>
        HttpResponse.json({ error: 'failed', message: 'Knowledge is misconfigured' }, { status: 500 }),
      ),
    );
    renderRoute();
    expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent('Knowledge is misconfigured');
    expect(await screen.findByText('Couldn’t load the pages.')).toBeInTheDocument();
  });

  it('keeps the open page’s path in the tree when the top tree level fails', async () => {
    stubKnowledge();
    server.use(
      http.get(`${KNOWLEDGE}/tree`, ({ request }) =>
        new URL(request.url).searchParams.has('parentId')
          ? HttpResponse.json({ pages: [], truncated: false })
          : HttpResponse.json({ error: 'failed', message: 'Knowledge is misconfigured' }, { status: 500 }),
      ),
    );
    renderRoute(`/factories/${FACTORY_ID}/knowledge?page=runbook`);
    expect(await screen.findByText('Couldn’t load the pages.', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(await screen.findByRole('treeitem', { name: /Deploy runbook/ })).toBeInTheDocument();
  });
});
