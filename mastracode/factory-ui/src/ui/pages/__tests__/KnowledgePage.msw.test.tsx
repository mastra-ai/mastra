import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type { KnowledgeGraphPayload } from '../../domains/factory/services/knowledge';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';

const graphFixture: KnowledgeGraphPayload = {
  view: 'project',
  nodes: [
    {
      id: 'ent-1',
      name: 'Payments Service',
      kind: 'service',
      scope: ['org:org-1', `resource:${FACTORY_ID}`],
      rung: 'resource',
      pinned: true,
      factCount: 3,
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T01:00:00.000Z',
    },
    {
      id: 'ent-2',
      name: 'Deploy Runbook',
      kind: 'doc',
      scope: ['org:org-1', `resource:${FACTORY_ID}`],
      rung: 'resource',
      pinned: false,
      factCount: 1,
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T01:00:00.000Z',
    },
  ],
  edges: [
    { id: 'wikilink:ent-1:ent-2', source: 'ent-1', target: 'ent-2', type: 'wikilink', factId: 'fact-1' },
    // Both entities carry an incoming edge so both render labels (the label
    // rule hides names on nodes with zero incoming memories).
    { id: 'wikilink:ent-2:ent-1', source: 'ent-2', target: 'ent-1', type: 'wikilink', factId: 'fact-2' },
  ],
  truncated: false,
  outOfWindow: [],
  unresolvedCapped: { count: 0, names: [] },
  pinCensus: { resource: 1, thread: null },
  version: '01TESTVERSION',
};

function stubKnowledgeRoute(graph: KnowledgeGraphPayload | { status: number; message: string } = graphFixture) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({}),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/graph`, () =>
      'status' in graph
        ? HttpResponse.json({ error: 'error', message: graph.message }, { status: graph.status })
        : HttpResponse.json(graph),
    ),
  );
}

function renderRoute() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/knowledge`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('KnowledgePage', () => {
  it('renders graph nodes from the endpoint payload', async () => {
    stubKnowledgeRoute();
    renderRoute();

    expect(await screen.findByRole('region', { name: 'Knowledge graph' })).toBeInTheDocument();
    const nodes = await screen.findAllByTestId('knowledge-node');
    expect(nodes).toHaveLength(2);
    expect(screen.getByText('Payments Service')).toBeInTheDocument();
    expect(screen.getByText('Deploy Runbook')).toBeInTheDocument();
    // Rung + pin filter chips render.
    expect(screen.getByRole('button', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeInTheDocument();
    // Clean payload → no truncation banner.
    expect(screen.queryByTestId('knowledge-truncation-banner')).not.toBeInTheDocument();
  });

  it('shows the truncation banner when the payload window was capped', async () => {
    stubKnowledgeRoute({
      ...graphFixture,
      truncated: true,
      outOfWindow: [{ id: 'ent-x', name: 'Elsewhere' }],
      unresolvedCapped: { count: 3, names: ['Ghost'] },
    });
    renderRoute();

    const banner = await screen.findByTestId('knowledge-truncation-banner');
    expect(banner).toHaveTextContent(/Partial view/);
    expect(banner).toHaveTextContent(/newest 2 entities/);
    expect(banner).toHaveTextContent(/1 linked entities outside the window/);
    expect(banner).toHaveTextContent(/3 links unresolved/);
  });

  it('shows the sidebar Knowledge entry (brain icon) under Audit log', async () => {
    stubKnowledgeRoute();
    renderRoute();

    const knowledgeLink = await screen.findByRole('link', { name: 'Knowledge' });
    expect(knowledgeLink).toHaveAttribute('href', `/factories/${FACTORY_ID}/knowledge`);
    const auditLink = screen.getByRole('link', { name: 'Audit log' });
    expect(auditLink).toHaveAttribute('href', `/factories/${FACTORY_ID}/audit`);
    // Directly under Audit log in the sidebar nav order.
    expect(auditLink.compareDocumentPosition(knowledgeLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the empty state when no knowledge exists yet', async () => {
    stubKnowledgeRoute({ ...graphFixture, nodes: [], edges: [] });
    renderRoute();

    expect(await screen.findByText(/No knowledge captured yet/)).toBeInTheDocument();
  });

  it('surfaces a load error as a notice', async () => {
    stubKnowledgeRoute({ status: 503, message: 'The knowledge storage domain is not configured.' });
    renderRoute();

    expect(await screen.findByText('The knowledge storage domain is not configured.')).toBeInTheDocument();
  });
});
