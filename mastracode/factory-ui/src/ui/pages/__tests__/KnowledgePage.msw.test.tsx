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
      // Post-vouch shape: the identity chain exists as membership-linked scope
      // nodes, so each rung merges with its node (scopeNodeId + name).
      return HttpResponse.json({
        roots: [
          {
            level: 'org',
            id: 'org-1',
            available: true,
            scopeNodeId: '11111111-1111-4111-8111-111111111111',
            name: 'mastra',
          },
          {
            level: 'resource',
            id: FACTORY_ID,
            available: true,
            scopeNodeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            name: FACTORY_ID,
          },
          ...(threadId
            ? [
                {
                  level: 'thread',
                  id: threadId,
                  available: true,
                  scopeNodeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  name: threadId,
                },
              ]
            : []),
        ],
        defaultLevel: 'resource',
        scopeNodes: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            address: 'org:org-1',
            name: 'mastra',
            kind: 'org',
            parentIds: [],
          },
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            address: `resource:${FACTORY_ID}`,
            name: FACTORY_ID,
            parentIds: ['11111111-1111-4111-8111-111111111111'],
          },
          ...(threadId
            ? [
                {
                  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  address: `thread:${threadId}`,
                  name: threadId,
                  parentIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
                },
              ]
            : []),
          {
            id: '22222222-2222-4222-8222-222222222222',
            address: 'features',
            name: 'features',
            kind: 'feature',
            parentIds: ['11111111-1111-4111-8111-111111111111'],
          },
          {
            id: '33333333-3333-4333-8333-333333333333',
            address: 'features:memory',
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
    await user.click(screen.getByRole('button', { name: /fp-1 project/ }));
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
              // The clicked scope node renders as its own graph root.
              id: '22222222-2222-4222-8222-222222222222',
              name: 'features',
              kind: 'feature',
              scope: null,
              rung: null,
              isScope: true,
              pinned: false,
              recordCount: 0,
              createdAt: '2026-08-13T00:00:00.000Z',
              updatedAt: '2026-08-13T01:00:00.000Z',
            },
            {
              id: '33333333-3333-4333-8333-333333333333',
              name: 'memory',
              kind: 'feature',
              scope: null,
              rung: null,
              isScope: true,
              pinned: false,
              recordCount: 0,
              createdAt: '2026-08-13T00:00:00.000Z',
              updatedAt: '2026-08-13T01:00:00.000Z',
            },
            {
              // Content placed into the structural scope by the curator —
              // identity-scoped, opens the record flyout on click.
              id: '55555555-5555-4555-8555-555555555555',
              name: 'Memory Extraction',
              kind: 'subsystem',
              scope: ['org:org-1', `resource:${FACTORY_ID}`],
              rung: 'resource' as const,
              pinned: false,
              recordCount: 1,
              createdAt: '2026-08-13T02:00:00.000Z',
              updatedAt: '2026-08-13T03:00:00.000Z',
            },
          ],
          // Containment edges from the root to every member, plus the
          // wikilink edge derived from member records.
          edges: [
            {
              id: 'contains:2:3',
              source: '22222222-2222-4222-8222-222222222222',
              target: '33333333-3333-4333-8333-333333333333',
              type: 'contains' as const,
            },
            {
              id: 'contains:2:5',
              source: '22222222-2222-4222-8222-222222222222',
              target: '55555555-5555-4555-8555-555555555555',
              type: 'contains' as const,
            },
          ],
          records: [
            {
              id: 'record-5555',
              nodeIds: ['55555555-5555-4555-8555-555555555555'],
              pinned: false,
              text: 'Extraction pipeline notes.',
            },
          ],
        });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderRoute(`/factories/${FACTORY_ID}/knowledge`);

    // ONE unified tree built from the scope nodes that exist: identity scopes
    // and declared structure share the same name + kind-chip treatment.
    const scopes = await screen.findByRole('complementary', { name: 'Knowledge scopes' });
    expect(within(scopes).queryByText('Your access')).not.toBeInTheDocument();
    expect(within(scopes).queryByText('Knowledge structure')).not.toBeInTheDocument();
    expect(await within(scopes).findByRole('button', { name: /mastra org/ })).toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: /fp-1 project/ })).toBeInTheDocument();
    expect(within(scopes).queryByText(/your org|your project/)).not.toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: /features feature/ })).toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: /memory feature/ })).toBeInTheDocument();

    // Selecting a structural scope fetches the bounded member subgraph by id
    // and opens the selected scope's detail in the same action.
    await user.click(within(scopes).getByRole('button', { name: /features feature/ }));
    expect(router.state.location.search).toContain('scope=22222222-2222-4222-8222-222222222222');
    expect(router.state.location.search).toContain('node=22222222-2222-4222-8222-222222222222');
    expect(await screen.findByTestId('knowledge-scope-flyout')).toHaveTextContent('features');
    // The clicked scope node renders as its own graph root inside the lens.
    const graphContainer = screen.getByTestId('knowledge-graph-container');
    const rootNode = (await within(graphContainer).findAllByTestId('knowledge-node')).find(
      node => node.getAttribute('data-node-id') === '22222222-2222-4222-8222-222222222222',
    );
    if (!rootNode) throw new Error('Expected the selected scope root node');
    expect(within(rootNode).getByText('features')).toBeVisible();
    await waitFor(() => expect(subgraphParams).toContain('22222222-2222-4222-8222-222222222222'));

    // Selected scopes get a filled active pill matching aria-pressed.
    const features = within(scopes).getByRole('button', { name: /features feature/ });
    expect(features).toHaveAttribute('aria-pressed', 'true');
    expect(features).toHaveClass('bg-surface4');
    expect(features).toHaveClass('font-medium');
    expect(within(scopes).getByRole('button', { name: /mastra org/ })).not.toHaveClass('bg-surface4');

    // Content placed into the structural scope renders alongside child scopes
    // and opens the record flyout (scoped by the node's own rung) on click.
    fireEvent.click(await within(graphContainer).findByText('Memory Extraction'));
    expect(router.state.location.search).toContain('scope=22222222-2222-4222-8222-222222222222');
    expect(await screen.findByText(/Handles charging flows/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close details' }));

    // Clicking a member scope node inside the structural lens applies the same
    // selection model: switch its lens and open its scope detail.
    const memoryNode = (await within(graphContainer).findAllByTestId('knowledge-node')).find(
      node => node.getAttribute('data-node-id') === '33333333-3333-4333-8333-333333333333',
    );
    if (!memoryNode) throw new Error('Expected the child scope node');
    fireEvent.click(memoryNode);
    await waitFor(() => expect(router.state.location.search).toContain('scope=33333333-3333-4333-8333-333333333333'));
    expect(await screen.findByTestId('knowledge-scope-flyout')).toHaveTextContent('memory');
  });

  it('identity scope entries open the structural lens and read content at its own rung', async () => {
    stubKnowledgeRoute();
    const subgraphParams: string[] = [];
    const nodeScopeLevels: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/subgraph`, ({ request }) => {
        const scopeNodeId = new URL(request.url).searchParams.get('scopeNodeId');
        if (scopeNodeId) subgraphParams.push(scopeNodeId);
        return HttpResponse.json(graphFixture);
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/nodes/:nodeId`, ({ request }) => {
        nodeScopeLevels.push(new URL(request.url).searchParams.get('scopeLevel') ?? 'none');
        return HttpResponse.json(nodeFixture);
      }),
    );
    const user = userEvent.setup();
    const { router } = renderRoute(`/factories/${FACTORY_ID}/knowledge`);

    const scopes = await screen.findByRole('complementary', { name: 'Knowledge scopes' });
    // One entry per scope: structural name with identity kind, never two
    // labels for the same scope.
    const orgScope = await within(scopes).findByRole('button', { name: /mastra org/ });
    expect(within(scopes).queryByRole('button', { name: /^mastra$/ })).not.toBeInTheDocument();

    // The identity scope entry opens its structural lens.
    await user.click(orgScope);
    expect(router.state.location.search).toContain('scope=11111111-1111-4111-8111-111111111111');
    await waitFor(() => expect(subgraphParams).toContain('11111111-1111-4111-8111-111111111111'));
    expect(orgScope).toHaveAttribute('aria-pressed', 'true');
    expect(orgScope).toHaveClass('bg-surface4');

    // A project-scoped content node reached through the org lens must
    // load detail at the node's own rung, not the lens marker's org rung.
    fireEvent.click(await screen.findByText('Payments Service'));
    await waitFor(() => expect(nodeScopeLevels).toContain('resource'));
    expect(nodeScopeLevels).not.toContain('org');

    // The project scope entry behaves the same way.
    const project = within(scopes).getByRole('button', { name: /fp-1 project/ });
    await user.click(project);
    await waitFor(() => expect(subgraphParams).toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
    expect(project).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens details and recent activity for the active structural lens root instead of re-drilling it', async () => {
    const scopeRootId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const activityScopeIds: Array<string | null> = [];
    stubKnowledgeRoute({
      ...graphFixture,
      nodes: [
        {
          id: scopeRootId,
          name: FACTORY_ID,
          kind: 'scope',
          scope: null,
          rung: null,
          isScope: true,
          pinned: false,
          recordCount: 0,
        },
        graphFixture.nodes[0]!,
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'features',
          kind: 'feature',
          scope: null,
          rung: null,
          isScope: true,
          pinned: false,
          recordCount: 0,
        },
      ],
      edges: [
        { id: 'contains:content', source: scopeRootId, target: 'ent-1', type: 'contains' },
        {
          id: 'contains:child',
          source: scopeRootId,
          target: '22222222-2222-4222-8222-222222222222',
          type: 'contains',
        },
      ],
      records: [],
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/activity`, ({ request }) => {
        activityScopeIds.push(new URL(request.url).searchParams.get('scopeNodeId'));
        return HttpResponse.json({
          events: [
            {
              id: 'activity-scope-1',
              action: 'knowledge-appended',
              recordType: 'record',
              scope: ['org:org-1', `resource:${FACTORY_ID}`],
              createdAt: '2026-08-13T03:00:00.000Z',
            },
          ],
        });
      }),
    );
    const { router } = renderRoute();

    const scopes = await screen.findByRole('complementary', { name: 'Knowledge scopes' });
    fireEvent.click(await within(scopes).findByRole('button', { name: /fp-1 project/ }));

    // Tree selection changes the lens and opens its scope detail together.
    let flyout = await screen.findByTestId('knowledge-scope-flyout');
    expect(flyout).toHaveTextContent(`resource:${FACTORY_ID}`);
    expect(flyout).toHaveTextContent('Content nodes1');
    expect(flyout).toHaveTextContent('Child scopes1');
    expect(await within(flyout).findByText('knowledge-appended')).toBeInTheDocument();
    expect(activityScopeIds).toContain(scopeRootId);
    expect(router.state.location.search).toContain(`node=${scopeRootId}`);
    expect(router.state.location.search).toContain(`scope=${scopeRootId}`);

    // Clicking the same scope in the graph applies the identical selection.
    fireEvent.click(within(flyout).getByRole('button', { name: 'Close scope details' }));
    expect(screen.queryByTestId('knowledge-scope-flyout')).not.toBeInTheDocument();
    const root = (await screen.findAllByTestId('knowledge-node')).find(node => node.textContent?.includes(FACTORY_ID));
    if (!root) throw new Error('Expected the selected structural scope root');
    fireEvent.click(root);
    flyout = await screen.findByTestId('knowledge-scope-flyout');
    expect(flyout).toHaveTextContent(`resource:${FACTORY_ID}`);
  });

  it('falls back to plain identity rung entries when the adapter exposes no scope nodes', async () => {
    stubKnowledgeRoute();
    const subgraphParams: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/scopes`, () =>
        HttpResponse.json({
          roots: [
            { level: 'org', id: 'org-1', available: true },
            { level: 'resource', id: FACTORY_ID, available: true },
          ],
          defaultLevel: 'resource',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/subgraph`, ({ request }) => {
        subgraphParams.push(new URL(request.url).searchParams.get('scopeLevel') ?? 'none');
        return HttpResponse.json(graphFixture);
      }),
    );
    const user = userEvent.setup();
    renderRoute(`/factories/${FACTORY_ID}/knowledge`);

    const scopes = await screen.findByRole('complementary', { name: 'Knowledge scopes' });
    const org = await within(scopes).findByRole('button', { name: /org-1 org/ });
    expect(within(scopes).getByRole('button', { name: /fp-1 project/ })).toBeInTheDocument();
    await user.click(org);
    expect(org).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(subgraphParams).toContain('org'));
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
    expect(await within(scopes).findByRole('button', { name: /mastra org/ })).toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: /fp-1 project/ })).toBeInTheDocument();

    // Merged entries get a filled active pill matching aria-pressed.
    const project = within(scopes).getByRole('button', { name: /fp-1 project/ });
    await user.click(project);
    expect(project).toHaveAttribute('aria-pressed', 'true');
    expect(project).toHaveClass('bg-surface4');
    expect(project).toHaveClass('font-medium');
    expect(within(scopes).getByRole('button', { name: /mastra org/ })).not.toHaveClass('bg-surface4');

    await user.click(screen.getByRole('tab', { name: 'activity' }));
    expect(await screen.findByText('knowledge-appended')).toBeInTheDocument();
    expect(screen.getByText(`org:org-1 → resource:${FACTORY_ID}`)).toBeInTheDocument();
  });

  it('shows bounded-window status and deep-links rendered out-of-window wikilinks', async () => {
    stubKnowledgeRoute(
      {
        ...graphFixture,
        truncated: true,
        outOfWindow: [
          {
            id: 'ent-x',
            name: 'Elsewhere',
            scope: ['org:org-1', `resource:${FACTORY_ID}`],
            rung: 'resource',
          },
        ],
        records: [
          ...graphFixture.records,
          { id: 'record-boundary', nodeIds: ['ent-1'], pinned: false, text: 'See [[Elsewhere]].' },
        ],
        unresolvedCapped: { count: 3, names: ['Ghost'] },
      },
      {
        ...nodeFixture,
        records: [{ ...nodeFixture.records[0]!, text: 'See [[Elsewhere]] for the related decision.' }],
      },
    );
    const detailRequests: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/nodes/:nodeId`, ({ request }) => {
        detailRequests.push(request.url);
        const nodeId = new URL(request.url).pathname.split('/').at(-1) ?? 'missing';
        return HttpResponse.json({
          ...nodeFixture,
          node: { ...nodeFixture.node, id: nodeId, name: nodeId === 'ent-x' ? 'Elsewhere' : nodeFixture.node.name },
          records: [{ ...nodeFixture.records[0]!, text: 'See [[Elsewhere]] for the related decision.' }],
        });
      }),
    );
    const { router } = renderRoute();

    const banner = await screen.findByTestId('knowledge-truncation-banner');
    expect(banner).toHaveTextContent(/Partial view/);
    expect(banner).toHaveTextContent(/newest 2 nodes/);
    expect(banner).not.toHaveTextContent(/linked nodes outside the window/);
    expect(banner).toHaveTextContent(/3 links unresolved/);

    const boundaryNode = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-node-id="ent-x"][data-node-type="boundary"]');
      if (!element) throw new Error('Expected the authorized out-of-window endpoint');
      return element;
    });
    expect(within(boundaryNode).getByText('Elsewhere')).toBeInTheDocument();
    expect(within(boundaryNode).getByText('↗ Project')).toBeInTheDocument();
    fireEvent.click(boundaryNode);
    expect(router.state.location.search).not.toContain('node=ent-x');

    fireEvent.click(screen.getByText('Payments Service'));
    fireEvent.click(await screen.findByRole('button', { name: 'Elsewhere' }));
    await waitFor(() => {
      expect(router.state.location.search).toContain('scope=resource');
      expect(router.state.location.search).toContain('node=ent-x');
      expect(router.state.location.search).toContain('nodeRung=resource');
      expect(detailRequests.some(url => url.includes('/nodes/ent-x?') && url.includes('scopeLevel=resource'))).toBe(
        true,
      );
    });
  });

  it('keeps the out-of-window count for boundary nodes that cannot be rendered', async () => {
    stubKnowledgeRoute({
      ...graphFixture,
      outOfWindow: [
        {
          id: 'ent-x',
          name: 'Elsewhere',
          scope: ['org:org-1', `resource:${FACTORY_ID}`],
          rung: 'resource',
        },
        {
          id: 'ent-y',
          name: 'Unlinked',
          scope: ['org:org-1', `resource:${FACTORY_ID}`],
          rung: 'resource',
        },
      ],
      records: [
        ...graphFixture.records,
        { id: 'record-boundary', nodeIds: ['ent-1'], pinned: false, text: 'See [[Elsewhere]].' },
      ],
    });
    renderRoute();

    const banner = await screen.findByTestId('knowledge-truncation-banner');
    expect(banner).toHaveTextContent(/1 linked nodes outside the window/);
    expect(banner).not.toHaveTextContent(/2 linked nodes outside the window/);
  });

  it('restores a node flyout from its deep link', async () => {
    stubKnowledgeRoute();
    renderRoute(
      `/factories/${FACTORY_ID}/knowledge?scope=resource&node=ent-1&nodeName=Payments+Service&nodeRung=resource`,
    );

    const flyout = await screen.findByTestId('knowledge-flyout');
    expect(await within(flyout).findByText('Payments Service')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Knowledge scope' })).toHaveTextContent('Payments Service');
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
