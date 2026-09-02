import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type { KnowledgeGraphPayload, KnowledgeScopeTreePayload } from '../../../services/knowledge';
import { createAppRoutes } from '../../../../../router';

const projectId = 'canvas-project';
const rootScope = { id: 'scope:root', name: 'Project scope', kind: 'project' };
const adjacentScope = { id: 'scope:adjacent', name: 'Platform scope', kind: 'team' };

const rootLens = {
  view: 'project',
  scope: rootScope,
  nodes: [
    {
      id: 'node:source',
      reference: 'kr_source',
      name: 'Source service',
      kind: 'service',
      pinned: false,
      recordCount: 1,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
    {
      id: 'node:boundary',
      reference: 'kr_boundary',
      name: 'Boundary service',
      kind: 'service',
      pinned: false,
      recordCount: 0,
      boundary: { scope: adjacentScope },
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
  ],
  edges: [
    {
      id: 'edge:boundary',
      source: 'node:source',
      target: 'node:boundary',
      type: 'wikilink',
      recordId: 'record:source',
      boundary: true,
    },
  ],
  records: [],
  page: { truncated: false, incomplete: false },
  limits: { maxNodes: 250, maxEdges: 500, maxBoundaryNodes: 100, boundaryHops: 1 },
} satisfies KnowledgeGraphPayload;

const adjacentLens = {
  ...rootLens,
  scope: adjacentScope,
  nodes: [
    {
      id: 'node:adjacent',
      reference: 'kr_adjacent',
      name: 'Platform detail',
      kind: 'service',
      pinned: false,
      recordCount: 0,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
  ],
  edges: [],
} satisfies KnowledgeGraphPayload;

function installHandlers(
  rootPayload: KnowledgeGraphPayload | ((cursor: string | null) => KnowledgeGraphPayload) = rootLens,
) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json({ knowledge: true })),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: projectId, name: 'Canvas project' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${projectId}`, () =>
      HttpResponse.json({ project: { id: projectId, name: 'Canvas project' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${projectId}/knowledge/scopes`, ({ request }) => {
      const selected = new URL(request.url).searchParams.get('scopeId');
      return HttpResponse.json({
        scope: selected === adjacentScope.id ? adjacentScope : rootScope,
        children: selected ? [] : [adjacentScope],
      } satisfies KnowledgeScopeTreePayload);
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${projectId}/knowledge/subgraph`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const selected = params.get('scopeId');
      const payload = typeof rootPayload === 'function' ? rootPayload(params.get('cursor')) : rootPayload;
      return HttpResponse.json(selected === adjacentScope.id ? adjacentLens : payload);
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${projectId}/work-records`, () =>
      HttpResponse.json({ workRecords: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/source-control-connections`, () => HttpResponse.json({ connections: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({}),
    ),
  );
}

function renderCanvas(path = `/factories/${projectId}/knowledge`) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('Knowledge graph canvas', () => {
  it('keeps the canvas empty until the user selects a scope', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderCanvas();

    expect(await screen.findByText('Select a scope to open its bounded knowledge lens.')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Project scope' }));
    expect(await screen.findByRole('region', { name: 'Knowledge graph' })).toBeInTheDocument();
  });

  it('synchronizes boundary navigation with the scope lens', async () => {
    installHandlers();
    const user = userEvent.setup();
    const { router } = renderCanvas(`/factories/${projectId}/knowledge?scope=${encodeURIComponent(rootScope.id)}`);

    expect(await screen.findByText('Boundary service')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Open Platform scope' }));
    await waitFor(() => expect(router.state.location.search).toContain('scope=scope%3Aadjacent'));
    expect(await screen.findByTestId('knowledge-scope-overlay')).toHaveTextContent('Platform scope');
  });

  it('builds the scope map incrementally from complete visited lenses', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderCanvas(`/factories/${projectId}/knowledge?scope=${encodeURIComponent(rootScope.id)}`);

    await user.click(await screen.findByRole('button', { name: 'Open Platform scope' }));
    expect(await screen.findByTestId('knowledge-scope-overlay')).toHaveTextContent('Platform scope');
    await user.click(screen.getByRole('button', { name: 'Scope map' }));

    const map = screen.getByLabelText('Scope map');
    expect(map).toHaveTextContent('Project scope');
    expect(map).toHaveTextContent('Platform scope');
    expect(map).toHaveTextContent('Source service');
    expect(map).toHaveTextContent('Platform detail');
  });

  it('includes a paginated scope in the map after its final page loads', async () => {
    const secondPage = {
      ...rootLens,
      nodes: [
        {
          id: 'node:second-page',
          reference: 'kr_second_page',
          name: 'Second page service',
          kind: 'service',
          pinned: false,
          recordCount: 0,
          createdAt: '2026-09-02T00:00:00.000Z',
          updatedAt: '2026-09-02T00:00:00.000Z',
        },
      ],
      edges: [],
      page: { truncated: false, incomplete: false },
    } satisfies KnowledgeGraphPayload;
    installHandlers(cursor =>
      cursor ? secondPage : { ...rootLens, page: { nextCursor: 'cursor-2', truncated: true, incomplete: false } },
    );
    const user = userEvent.setup();
    renderCanvas(`/factories/${projectId}/knowledge?scope=${encodeURIComponent(rootScope.id)}`);

    await user.click(await screen.findByRole('button', { name: 'Load more in this lens' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load more in this lens' })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Scope map' }));

    const map = screen.getByLabelText('Scope map');
    expect(map).toHaveTextContent('Project scope');
    expect(map).toHaveTextContent('Source service');
    expect(map).toHaveTextContent('Second page service');
  });

  it('drops an incomplete scope as a whole from the scope map', async () => {
    installHandlers({ ...rootLens, page: { truncated: true, incomplete: true } });
    const user = userEvent.setup();
    renderCanvas(`/factories/${projectId}/knowledge?scope=${encodeURIComponent(rootScope.id)}`);

    await user.click(await screen.findByRole('button', { name: 'Open Platform scope' }));
    expect(await screen.findByTestId('knowledge-scope-overlay')).toHaveTextContent('Platform scope');
    await user.click(screen.getByRole('button', { name: 'Scope map' }));

    const map = screen.getByLabelText('Scope map');
    expect(map).not.toHaveTextContent('Source service');
    expect(map).toHaveTextContent('1 scope omitted by canvas bounds');
  });
});
