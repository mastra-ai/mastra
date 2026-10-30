import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  KnowledgeExplorerGraph,
  KnowledgeExplorerPageDetail,
} from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import type { KnowledgePagePayload } from '@mastra/playground-ui/domains/knowledge/pageTypes';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

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
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-records`, () =>
      HttpResponse.json({ workRecords: [] }),
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
  it('redirects direct knowledge links when the server-side feature is disabled', async () => {
    stubFactory({ knowledge: false });
    const { router } = renderRoute();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
  });

  it("shows the project's pages in the tree and graph", async () => {
    stubKnowledge();
    renderRoute();
    const tree = await screen.findByRole('tree');
    expect(within(tree).getByText('Mastra')).toBeInTheDocument();
    expect(screen.getByTestId('knowledge-graph-container')).toBeInTheDocument();
  });

  it('opens the selected page from the tree and keeps it in the URL', async () => {
    stubKnowledge();
    const { router } = renderRoute();
    const tree = await screen.findByRole('tree');
    fireEvent.click(await within(tree).findByRole('button', { name: 'Expand Acme Factory' }));
    fireEvent.click(await within(tree).findByText('Deploy runbook'));
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
      await within(screen.getByRole('region', { name: 'Selected page' })).findByText('Archived runbook'),
    ).toBeInTheDocument();
  });

  it.each([
    ['with ?view=graph', '?view=graph'],
    ['with no query params', ''],
  ])('selects a graph page on the first click and opens it on the second (%s)', async (_, query) => {
    stubKnowledge();
    const { router } = renderRoute(`/factories/${FACTORY_ID}/knowledge${query}`);
    const runbookNode = async () => {
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const node = nodes.find(n => n.dataset.pageId === 'runbook');
      if (!node) throw new Error('runbook not drawn');
      return node;
    };
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

  it("shows the server's message when the graph fails", async () => {
    stubKnowledge({ status: 500, message: 'Knowledge is misconfigured' });
    renderRoute();
    expect(await screen.findByText('Knowledge is misconfigured', {}, { timeout: 5_000 })).toBeInTheDocument();
  });
});
