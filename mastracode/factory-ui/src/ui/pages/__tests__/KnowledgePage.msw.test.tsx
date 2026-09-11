import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type { KnowledgeNodePayload, KnowledgeGraphPayload } from '../../domains/factory/services/knowledge';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';

const nodeFixture: KnowledgeNodePayload = {
  node: {
    id: 'ent-1',
    name: 'Payments Service',
    kind: 'service',
    content: 'Handles charging flows through [[Deploy Runbook]].',
    scope: ['org:org-1', `resource:${FACTORY_ID}`],
    rung: 'resource',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T01:00:00.000Z',
  },
  records: [
    {
      id: 'record-1',
      node: 'ent-1',
      relation: 'owned',
      text: 'Payments Service uses [[Deploy Runbook]] for charging flows.',
      scope: ['org:org-1', `resource:${FACTORY_ID}`],
      rung: 'resource',
      sourceThreadId: 'thread-abc-123',
      capturedAt: '2026-08-13T02:00:00.000Z',
      pinned: true,
      metadata: { reason: 'Learned from a burned API call — costly to rediscover.' },
    },
    {
      id: 'record-2',
      node: 'ent-1',
      relation: 'owned',
      text: 'Deploys run nightly.',
      scope: ['org:org-1', `resource:${FACTORY_ID}`],
      rung: 'resource',
      sourceThreadId: 'thread-abc-123',
      capturedAt: '2026-08-13T03:00:00.000Z',
      pinned: false,
    },
  ],
};

const graphFixture: KnowledgeGraphPayload = {
  view: 'project',
  nodes: [
    {
      id: 'ent-1',
      name: 'Payments Service',
      kind: 'service',
      description:
        'Handles charging flows through [[Deploy Runbook]]. Operational reference: https://github.com/mastra-ai/mastra/tree/main/mastracode/factory',
      scope: ['org:org-1', `resource:${FACTORY_ID}`],
      rung: 'resource',
      pinned: true,
      recordCount: 3,
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
      recordCount: 1,
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T01:00:00.000Z',
    },
  ],
  edges: [
    { id: 'wikilink:ent-1:ent-2', source: 'ent-1', target: 'ent-2', type: 'wikilink', recordId: 'record-1' },
    // Both nodes carry an incoming edge so both render labels (the label
    // rule hides names on nodes with zero incoming knowledge records).
    { id: 'wikilink:ent-2:ent-1', source: 'ent-2', target: 'ent-1', type: 'wikilink', recordId: 'record-2' },
  ],
  // A11: knowledge records drive rendering when present — a pinned line (junction
  // marker), a reverse line, and a dot on ent-1 (recordCount 3 > 1 keeps it).
  records: [
    { id: 'record-1', nodeIds: ['ent-1', 'ent-2'], pinned: true, text: 'Payments Service uses Deploy Runbook.' },
    { id: 'record-2', nodeIds: ['ent-2', 'ent-1'], pinned: false, text: 'Runbook references the service.' },
    { id: 'record-3', nodeIds: ['ent-1'], pinned: false, text: 'Deploys run nightly.' },
  ],
  truncated: false,
  outOfWindow: [],
  unresolvedCapped: { count: 0, names: [] },
  pinCensus: { resource: 1, thread: null },
  version: '01TESTVERSION',
};

function stubKnowledgeRoute(
  graph: KnowledgeGraphPayload | { status: number; message: string } = graphFixture,
  nodePayload = nodeFixture,
) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json({ knowledge: true })),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/scopes`, ({ request }) => {
      const threadId = new URL(request.url).searchParams.get('threadId');
      if (threadId === 'gone-thread')
        return HttpResponse.json({ error: 'not_found', message: 'unknown thread' }, { status: 404 });
      return HttpResponse.json({
        roots: [
          { level: 'org', id: 'org-1', available: true },
          { level: 'resource', id: FACTORY_ID, available: true },
          ...(threadId ? [{ level: 'thread', id: threadId, available: true }] : []),
        ],
        defaultLevel: 'resource',
        scopeNodes: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'mastra',
            kind: 'org',
            parentIds: [],
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'features',
            kind: 'feature',
            parentIds: ['11111111-1111-4111-8111-111111111111'],
          },
          {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'memory',
            kind: 'feature',
            parentIds: ['22222222-2222-4222-8222-222222222222'],
          },
        ],
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/subgraph`, ({ request }) => {
      if ('status' in graph)
        return HttpResponse.json({ error: 'error', message: graph.message }, { status: graph.status });
      const threadId = new URL(request.url).searchParams.get('threadId');
      if (threadId === 'gone-thread')
        return HttpResponse.json({ error: 'not_found', message: 'unknown thread' }, { status: 404 });
      if (threadId)
        return HttpResponse.json({
          ...graph,
          view: 'thread',
          threadId,
          nodes: [
            ...graph.nodes,
            {
              id: 'ent-thread',
              name: 'Session Scratchpad',
              kind: 'note',
              scope: ['org:org-1', `resource:${FACTORY_ID}`, `thread:${threadId}`],
              rung: 'thread' as const,
              pinned: false,
              recordCount: 1,
              createdAt: '2026-08-13T04:00:00.000Z',
              updatedAt: '2026-08-13T04:00:00.000Z',
            },
          ],
          // Incoming edge so the thread node passes the label rule (degree >= 1).
          edges: [
            ...graph.edges,
            { id: 'edge-thread', source: 'ent-1', target: 'ent-thread', type: 'wikilink' as const },
          ],
          // A11: when knowledge records drive rendering, the same incoming connection
          // must exist as a knowledge record so the label rule still passes.
          records: [
            ...(graph.records ?? []),
            { id: 'record-thread', nodeIds: ['ent-1', 'ent-thread'], pinned: false, text: 'Session note.' },
          ],
        });
      return HttpResponse.json(graph);
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/nodes/:nodeId`, () =>
      HttpResponse.json(nodePayload),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/activity`, () =>
      HttpResponse.json({
        events: [
          {
            id: 'activity-1',
            action: 'knowledge-appended',
            recordType: 'record',
            recordId: 'record-1',
            scope: ['org:org-1', `resource:${FACTORY_ID}`],
            createdAt: '2026-08-13T03:00:00.000Z',
          },
        ],
      }),
    ),
  );
}

function renderRoute(path = `/factories/${FACTORY_ID}/knowledge?scope=resource`) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('KnowledgePage', () => {
  it('keeps the canvas empty until the user selects a scope', async () => {
    stubKnowledgeRoute();
    let subgraphReads = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/subgraph`, () => {
        subgraphReads += 1;
        return HttpResponse.json(graphFixture);
      }),
    );
    const user = userEvent.setup();
    renderRoute(`/factories/${FACTORY_ID}/knowledge`);

    expect(await screen.findByText('Select a scope to explore its knowledge.')).toBeVisible();
    expect(subgraphReads).toBe(0);
    await user.click(screen.getByRole('button', { name: /Project/ }));
    expect(await screen.findByText('Payments Service')).toBeVisible();
    expect(subgraphReads).toBe(1);
  });

  it('never sends a Knowledge key — the server resolves the host-selected runtime', async () => {
    stubKnowledgeRoute();
    const requests: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/scopes`, ({ request }) => {
        requests.push(`scopes:${new URL(request.url).searchParams.get('knowledgeKey')}`);
        return HttpResponse.json({
          roots: [
            { level: 'org', id: 'org-1', available: true },
            { level: 'resource', id: FACTORY_ID, available: true },
          ],
          defaultLevel: 'resource',
        });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/subgraph`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(`subgraph:${url.searchParams.get('knowledgeKey')}:${url.searchParams.get('scopeLevel')}`);
        return HttpResponse.json(graphFixture);
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/activity`, ({ request }) => {
        requests.push(`activity:${new URL(request.url).searchParams.get('knowledgeKey')}`);
        return HttpResponse.json({ events: [] });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/nodes/:nodeId`, ({ request }) => {
        requests.push(`node:${new URL(request.url).searchParams.get('knowledgeKey')}`);
        return HttpResponse.json(nodeFixture);
      }),
    );
    const user = userEvent.setup();
    // Even with a stale `knowledgeKey` in the URL, every request must omit it —
    // request input can never select a Knowledge runtime.
    renderRoute(`/factories/${FACTORY_ID}/knowledge?knowledgeKey=team&scope=resource`);
    fireEvent.click(await screen.findByText('Payments Service'));
    await waitFor(() => expect(requests).toContain('node:null'));
    await user.click(screen.getByRole('tab', { name: 'activity' }));
    await waitFor(() => expect(requests).toContain('activity:null'));
    expect(requests).toContain('scopes:null');
    expect(requests).toContain('subgraph:null:resource');
    expect(requests.every(entry => !entry.endsWith(':team') && !entry.endsWith(':second'))).toBe(true);
  });

  it('renders the reconciled structural scope tree and drills through scope members', async () => {
    stubKnowledgeRoute();
    const subgraphParams: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/subgraph`, ({ request }) => {
        const url = new URL(request.url);
        const scopeNodeId = url.searchParams.get('scopeNodeId');
        if (!scopeNodeId) return HttpResponse.json(graphFixture);
        subgraphParams.push(scopeNodeId);
        return HttpResponse.json({
          ...graphFixture,
          nodes: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              name: 'memory',
              kind: 'feature',
              scope: ['org:org-1', `resource:${FACTORY_ID}`],
              rung: 'resource' as const,
              pinned: false,
              recordCount: 0,
              createdAt: '2026-08-13T00:00:00.000Z',
              updatedAt: '2026-08-13T01:00:00.000Z',
            },
            {
              id: '44444444-4444-4444-8444-444444444444',
              name: 'observational',
              kind: 'feature',
              scope: ['org:org-1', `resource:${FACTORY_ID}`],
              rung: 'resource' as const,
              pinned: false,
              recordCount: 0,
              createdAt: '2026-08-13T00:00:00.000Z',
              updatedAt: '2026-08-13T01:00:00.000Z',
            },
          ],
          edges: [
            {
              id: 'wikilink:memory:observational',
              source: '33333333-3333-4333-8333-333333333333',
              target: '44444444-4444-4444-8444-444444444444',
              type: 'wikilink' as const,
            },
            {
              id: 'wikilink:observational:memory',
              source: '44444444-4444-4444-8444-444444444444',
              target: '33333333-3333-4333-8333-333333333333',
              type: 'wikilink' as const,
            },
          ],
          records: [],
        });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderRoute(`/factories/${FACTORY_ID}/knowledge`);

    // The reconciled hierarchy renders nested under the identity rungs, with
    // section labels separating tenant access from the knowledge structure.
    const scopes = await screen.findByRole('complementary', { name: 'Knowledge scopes' });
    expect(within(scopes).getByText('Your access')).toBeInTheDocument();
    expect(await within(scopes).findByText('Knowledge structure')).toBeInTheDocument();
    expect(await within(scopes).findByRole('button', { name: 'mastra' })).toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: 'features' })).toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: 'memory' })).toBeInTheDocument();

    // Selecting a structural scope fetches the bounded member subgraph by id.
    await user.click(within(scopes).getByRole('button', { name: 'features' }));
    expect(router.state.location.search).toContain('scope=22222222-2222-4222-8222-222222222222');
    expect(await screen.findByText('observational')).toBeVisible();
    await waitFor(() => expect(subgraphParams).toContain('22222222-2222-4222-8222-222222222222'));
    expect(subgraphParams.every(id => id !== '33333333-3333-4333-8333-333333333333')).toBe(true);

    // Selected scopes get a filled active pill matching aria-pressed.
    const features = within(scopes).getByRole('button', { name: 'features' });
    expect(features).toHaveAttribute('aria-pressed', 'true');
    expect(features).toHaveClass('bg-surface4');
    expect(features).toHaveClass('font-medium');
    expect(within(scopes).getByRole('button', { name: 'mastra' })).not.toHaveClass('bg-surface4');

    // Clicking a member scope node inside the structural lens drills down —
    // no record flyout opens for structural members.
    fireEvent.click(await screen.findByText('observational'));
    await waitFor(() => expect(router.state.location.search).toContain('scope=44444444-4444-4444-8444-444444444444'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('redirects direct knowledge links when the server-side feature is disabled', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${FACTORY_ID}/permissions`, () =>
        HttpResponse.json({ categories: {}, tools: {} }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/supervisor/health`, () =>
        HttpResponse.json({
          checkedAt: '2026-09-03T00:00:00.000Z',
          findings: [],
          counts: {
            'decision-stuck': 0,
            'start-stalled': 0,
            'seat-orphaned': 0,
            'seat-missing': 0,
            'held-waiting': 0,
            'label-drift': 0,
          },
        }),
      ),
    );

    const { router } = renderRoute();

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/overview`));
  });

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

  it('uses scope-first navigation and shows the authorized activity feed', async () => {
    stubKnowledgeRoute();
    const user = userEvent.setup();
    renderRoute();

    const scopes = await screen.findByRole('complementary', { name: 'Knowledge scopes' });
    expect(await within(scopes).findByRole('button', { name: /Organization/ })).toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: /Project/ })).toBeInTheDocument();

    // Identity rung selections get a filled active pill matching aria-pressed.
    const project = within(scopes).getByRole('button', { name: /Project/ });
    await user.click(project);
    expect(project).toHaveAttribute('aria-pressed', 'true');
    expect(project).toHaveClass('bg-surface4');
    expect(project).toHaveClass('font-medium');
    expect(within(scopes).getByRole('button', { name: /Organization/ })).not.toHaveClass('bg-surface4');

    await user.click(screen.getByRole('tab', { name: 'activity' }));
    expect(await screen.findByText('knowledge-appended')).toBeInTheDocument();
    expect(screen.getByText(`org:org-1 → resource:${FACTORY_ID}`)).toBeInTheDocument();
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
    expect(banner).toHaveTextContent(/newest 2 nodes/);
    expect(banner).toHaveTextContent(/1 linked nodes outside the window/);
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

    expect(await screen.findByText(/No knowledge captured at project scope yet/)).toBeInTheDocument();
  });

  it('explains exact-scope visibility when a wider rung is empty', async () => {
    // Org rung: content stamped at the project rung is NOT visible here (v2
    // has no downward inheritance) — the empty state must say why.
    stubKnowledgeRoute({ ...graphFixture, nodes: [], edges: [] });
    renderRoute(`/factories/${FACTORY_ID}/knowledge?scope=org`);

    expect(
      await screen.findByText(/knowledge captured in projects and sessions does not roll up here/),
    ).toBeInTheDocument();
  });

  it('surfaces a load error as a notice', async () => {
    stubKnowledgeRoute({ status: 503, message: 'The knowledge storage domain is not configured.' });
    renderRoute();

    // The hook retries twice before surfacing a non-404 error.
    expect(
      await screen.findByText('The knowledge storage domain is not configured.', undefined, { timeout: 8000 }),
    ).toBeInTheDocument();
  }, 15000);

  it('shows the snapshot description in the hover card without fetching node details', async () => {
    let nodeDetailRequests = 0;
    stubKnowledgeRoute();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/nodes/:nodeId`, () => {
        nodeDetailRequests += 1;
        return HttpResponse.json(nodeFixture);
      }),
    );
    renderRoute();

    const paymentsLabel = await screen.findByText('Payments Service');
    const paymentsNode = paymentsLabel.closest('[data-testid="knowledge-node"]');
    expect(paymentsNode).not.toBeNull();
    fireEvent.mouseEnter(paymentsNode!, { clientX: 120, clientY: 80 });

    const description = await screen.findByTestId('knowledge-hover-description');
    expect(description).toHaveTextContent('Handles charging flows through');
    expect(description).toHaveClass('line-clamp-3');
    expect(nodeDetailRequests).toBe(0);
  });

  it('omits hover description chrome for absent and whitespace-only descriptions', async () => {
    stubKnowledgeRoute({
      ...graphFixture,
      nodes: graphFixture.nodes.map(node =>
        node.id === 'ent-1' ? { ...node, description: '   \n  ' } : { ...node, description: undefined },
      ),
    });
    renderRoute();

    // Select by label so the whitespace-only node (ent-1) is definitely exercised,
    // regardless of render order.
    const whitespaceNode = (await screen.findByText('Payments Service')).closest('[data-testid="knowledge-node"]');
    const absentNode = (await screen.findByText('Deploy Runbook')).closest('[data-testid="knowledge-node"]');
    expect(whitespaceNode).not.toBeNull();
    expect(absentNode).not.toBeNull();
    fireEvent.mouseEnter(whitespaceNode!, { clientX: 120, clientY: 80 });
    expect(screen.getByTestId('knowledge-hover-card')).toBeInTheDocument();
    expect(screen.queryByTestId('knowledge-hover-description')).not.toBeInTheDocument();
    fireEvent.mouseLeave(whitespaceNode!);
    fireEvent.mouseEnter(absentNode!, { clientX: 140, clientY: 100 });
    expect(screen.getByTestId('knowledge-hover-card')).toBeInTheDocument();
    expect(screen.queryByTestId('knowledge-hover-description')).not.toBeInTheDocument();
  });

  it('omits flyout content chrome for whitespace-only content', async () => {
    stubKnowledgeRoute(undefined, {
      ...nodeFixture,
      node: { ...nodeFixture.node, content: '   \n  ' },
    });
    renderRoute();

    const nodes = await screen.findAllByTestId('knowledge-node');
    fireEvent.click(nodes[0]);

    const flyout = await screen.findByTestId('knowledge-flyout');
    expect(await within(flyout).findByText('Knowledge node')).toBeInTheDocument();
    expect(within(flyout).queryByText('Content')).not.toBeInTheDocument();
  });

  it('opens the flyout on node click with knowledge records and reasoning drill-in', async () => {
    stubKnowledgeRoute();
    renderRoute();
    const user = userEvent.setup();

    const nodes = await screen.findAllByTestId('knowledge-node');
    // fireEvent (not userEvent): userEvent's mousedown trips d3-drag's nodrag
    // handler, which reads event.view — null in jsdom.
    fireEvent.click(nodes[0]);

    const flyout = await screen.findByTestId('knowledge-flyout');
    // Knowledge records section resolves from the node endpoint: record rows with the
    // pin badge + wikilinks rendered as references.
    expect(await screen.findByText(/for charging flows/)).toBeInTheDocument();
    expect(flyout).toHaveTextContent('Payments Service');
    expect(flyout).toHaveTextContent('Handles charging flows through');
    const contentHeading = within(flyout).getByText('Content');
    const metadataHeading = within(flyout).getByText('Knowledge node');
    expect(contentHeading.compareDocumentPosition(metadataHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A10: the pinned knowledge record card carries the amber standout marker.
    const knowledgeRecords = screen.getAllByTestId('knowledge-record');
    expect(within(knowledgeRecords[0]!).getByRole('button', { name: 'Deploy Runbook' })).toBeInTheDocument();
    expect(knowledgeRecords.some(card => card.getAttribute('data-pinned') === 'true')).toBe(true);
    // Drill into the pinned knowledge record → provenance + reasoning.
    await user.click(screen.getByText(/for charging flows/));
    const detail = await screen.findByTestId('knowledge-record-detail');
    expect(detail).toHaveTextContent('Captured in session');
    expect(screen.getByTestId('knowledge-record-reason')).toHaveTextContent(
      'Learned from a burned API call — costly to rediscover.',
    );
    // The session link carries the source thread id.
    expect(screen.getByRole('button', { name: /thread-abc-123/ })).toBeInTheDocument();
  });

  it('drills into the thread view from the session link and back via the breadcrumb', async () => {
    stubKnowledgeRoute();
    renderRoute();
    const user = userEvent.setup();

    const nodes = await screen.findAllByTestId('knowledge-node');
    fireEvent.click(nodes[0]);
    await user.click(await screen.findByText(/for charging flows/));
    await user.click(await screen.findByRole('button', { name: /thread-abc-123/ }));

    // Thread view: breadcrumb renders and the thread-scoped node appears.
    const breadcrumb = await screen.findByRole('navigation', { name: 'Knowledge scope' });
    expect(breadcrumb).toHaveTextContent(`session ${'thread-abc-123'.slice(0, 8)}`);
    expect(await screen.findByText('Session Scratchpad')).toBeInTheDocument();
    // Project baseline nodes are still present (thread view ADDS, never swaps).
    expect(screen.getByText('Deploy Runbook')).toBeInTheDocument();

    // Crumb back to the project view clears the thread state.
    await user.click(screen.getByRole('button', { name: 'project' }));
    await waitFor(() => expect(screen.queryByText('Session Scratchpad')).not.toBeInTheDocument());
    expect(screen.queryByText(/session thread-a/)).not.toBeInTheDocument();
  });

  it('pushes wikilink hops onto the breadcrumb trail and clicks back through it (A7)', async () => {
    stubKnowledgeRoute();
    renderRoute();
    const user = userEvent.setup();

    const nodes = await screen.findAllByTestId('knowledge-node');
    fireEvent.click(nodes[0]);
    // Hop to the referenced node via the knowledge record's wikilink.
    const recordCard = (await screen.findAllByTestId('knowledge-record'))[0]!;
    await user.click(within(recordCard).getByRole('button', { name: 'Deploy Runbook' }));

    // Trail: ... project › Payments Service › Deploy Runbook (last crumb inert).
    const breadcrumb = screen.getByRole('navigation', { name: 'Knowledge scope' });
    expect(breadcrumb).toHaveTextContent('Payments Service');
    expect(breadcrumb).toHaveTextContent('Deploy Runbook');

    // Clicking the earlier crumb returns to the previously selected node.
    await user.click(within(breadcrumb).getByRole('button', { name: 'Payments Service' }));
    await waitFor(() => expect(breadcrumb).not.toHaveTextContent('Deploy Runbook'));
    expect(breadcrumb).toHaveTextContent('Payments Service');
  });

  it('renders the calm not-available state for a stale thread deep link', async () => {
    stubKnowledgeRoute();
    renderRoute(`/factories/${FACTORY_ID}/knowledge?thread=gone-thread`);

    const gone = await screen.findByTestId('knowledge-thread-gone');
    expect(gone).toHaveTextContent(/no longer available/i);
    // Crumb back works from the 404 state.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back to the project view' }));
    expect(await screen.findByText('Payments Service')).toBeInTheDocument();
  });
});
