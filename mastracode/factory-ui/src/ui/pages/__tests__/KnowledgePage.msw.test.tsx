import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type {
  KnowledgeNodePayload,
  KnowledgeGraphPayload,
  KnowledgeScopeTreePayload,
} from '../../domains/factory/services/knowledge';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';

const nodeFixture: KnowledgeNodePayload = {
  node: {
    id: 'ent-1',
    name: 'Payments Service',
    kind: 'service',
    description: 'Handles charging flows through [[Deploy Runbook]].',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T01:00:00.000Z',
  },
  records: [
    {
      id: 'record-1',
      nodeId: 'ent-1',
      relation: 'owned',
      text: 'Payments Service uses [[Deploy Runbook]] for charging flows.',
      createdAt: '2026-08-13T02:00:00.000Z',
      pinned: true,
      reason: 'Learned from a burned API call — costly to rediscover.',
    },
    {
      id: 'record-2',
      nodeId: 'ent-1',
      relation: 'owned',
      text: 'Deploys run nightly.',
      createdAt: '2026-08-13T03:00:00.000Z',
      pinned: false,
    },
  ],
};

const scopeTreeFixture: KnowledgeScopeTreePayload = {
  scope: {
    id: `resource:${FACTORY_ID}`,
    name: 'Acme Factory',
    kind: 'project',
  },
  children: [
    {
      id: 'scope:payments',
      name: 'Payments',
      kind: 'feature',
    },
    {
      id: 'scope:uncurated',
      name: 'Payments intake',
      kind: 'scope',
      needsCuration: true,
    },
  ],
};

const graphFixture: KnowledgeGraphPayload = {
  view: 'project',
  scopeId: `resource:${FACTORY_ID}`,
  nodes: [
    {
      id: 'ent-1',
      reference: 'reference-ent-1',
      name: 'Payments Service',
      kind: 'service',
      description:
        'Handles charging flows through [[Deploy Runbook]]. Operational reference: https://github.com/mastra-ai/mastra/tree/main/mastracode/factory',
      pinned: true,
      recordCount: 3,
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T01:00:00.000Z',
    },
    {
      id: 'ent-2',
      reference: 'reference-ent-2',
      name: 'Deploy Runbook',
      kind: 'doc',
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
  let proposalStatus: 'pending' | 'approved' | 'rejected' | 'conflicted' = 'pending';
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
      return HttpResponse.json(scopeTreeFixture);
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/curation/worklist`, () =>
      HttpResponse.json({
        scopeId: 'scope:uncurated',
        items: [
          {
            id: 'curation-node-1',
            reference: 'curation-reference-1',
            name: 'Provisional runbook',
            kind: 'document',
            version: 2,
            description: 'Untrusted draft waiting for review.',
            evidence: [
              { source: 'customer-report', provenance: 'subconscious:capture' },
              { source: 'verified-runbook', provenance: 'import:github' },
            ],
            evidenceCursor: 'kh_evidence_cursor',
            createdAt: '2026-08-13T03:00:00.000Z',
            updatedAt: '2026-08-13T03:00:00.000Z',
          },
          {
            id: 'curation-node-2',
            reference: 'curation-reference-2',
            name: 'Independent draft',
            kind: 'document',
            version: 1,
            evidence: [],
            createdAt: '2026-08-13T03:01:00.000Z',
            updatedAt: '2026-08-13T03:01:00.000Z',
          },
        ],
      }),
    ),
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/curation/items/:nodeId/evidence`,
      ({ request }) => {
        expect(new URL(request.url).searchParams.get('cursor')).toBe('kh_evidence_cursor');
        return HttpResponse.json({
          evidence: [{ source: 'incident-review', provenance: 'human:verified' }],
        });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/curation/merge-targets`, () =>
      HttpResponse.json({
        targets: [
          {
            id: 'merge-target-1',
            reference: 'merge-reference-1',
            name: 'Canonical runbook',
            kind: 'document',
            version: 4,
          },
        ],
      }),
    ),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/curation/actions/:action`,
      ({ params }) => {
        if (params.action === 'promote') {
          return HttpResponse.json({
            outcome: 'proposed',
            proposal: { id: 'proposal-2', reference: 'proposal-reference-2', status: 'pending' },
          });
        }
        return HttpResponse.json({
          outcome: 'applied',
          node: {
            id: 'curation-node-1',
            reference: 'curation-reference-1',
            name: 'Provisional runbook',
            kind: 'document',
            version: 3,
          },
        });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/activity`, () =>
      HttpResponse.json({
        events: [
          {
            id: 'activity-1',
            action: 'create',
            targetType: 'record',
            scopeId: 'scope:payments',
            sourceType: 'importer',
            sourceId: 'github',
            importRunId: 'run-reference-1',
            createdAt: '2026-08-13T03:00:00.000Z',
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/proposals`, ({ request }) => {
      const requestedStatus = new URL(request.url).searchParams.get('status');
      return HttpResponse.json({
        proposals:
          !requestedStatus || requestedStatus === proposalStatus
            ? [
                {
                  id: 'proposal-1',
                  reference: 'proposal-reference-1',
                  operation: 'update-node',
                  status: proposalStatus,
                  reason: 'The current name is stale',
                  targets: [
                    {
                      type: 'node',
                      id: 'ent-1',
                      name: 'Payments Service',
                      expectedVersion: 1,
                      currentVersion: proposalStatus === 'conflicted' ? 2 : 1,
                    },
                  ],
                  proposer: 'private',
                  actions:
                    proposalStatus === 'conflicted'
                      ? ['re-review']
                      : proposalStatus === 'pending'
                        ? ['approve', 'reject']
                        : [],
                  createdAt: '2026-08-13T03:00:00.000Z',
                },
              ]
            : [],
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/proposals/proposal-reference-1`, () =>
      HttpResponse.json({
        id: 'proposal-1',
        reference: 'proposal-reference-1',
        operation: 'update-node',
        status: proposalStatus,
        reason: 'The current name is stale',
        targets: [
          {
            type: 'node',
            id: 'ent-1',
            name: 'Payments Service',
            expectedVersion: 1,
            currentVersion: proposalStatus === 'conflicted' ? 2 : 1,
          },
        ],
        proposer: 'private',
        actions: proposalStatus === 'pending' ? ['approve', 'reject'] : [],
        createdAt: '2026-08-13T03:00:00.000Z',
      }),
    ),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/proposals/proposal-1/:action`,
      ({ params }) => {
        proposalStatus = params.action === 'reject' ? 'rejected' : 'approved';
        return HttpResponse.json({
          id: 'proposal-1',
          reference: 'proposal-reference-1',
          operation: 'update-node',
          status: proposalStatus,
          targets: [{ type: 'node', id: 'ent-1', name: 'Payments Service', expectedVersion: 1, currentVersion: 1 }],
          proposer: 'private',
          reviewer: 'visible',
          actions: [],
          createdAt: '2026-08-13T03:00:00.000Z',
          reviewedAt: '2026-08-13T03:01:00.000Z',
        });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/importers`, () =>
      HttpResponse.json({
        importers: [
          {
            id: 'github',
            importKind: 'agentic',
            triggers: ['programmatic', 'webhook'],
            bindings: [{ source: 'repo:mastra', binding: 'kh_binding' }],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/importers/github/runs`, () =>
      HttpResponse.json({
        runs: [
          {
            id: 'run-1',
            reference: 'run-reference-1',
            importerId: 'github',
            binding: 'kh_binding',
            source: 'repo:mastra',
            importKind: 'agentic',
            triggerKind: 'webhook',
            status: 'succeeded',
            queuedAt: '2026-08-13T03:00:00.000Z',
            startedAt: '2026-08-13T03:00:01.000Z',
            completedAt: '2026-08-13T03:00:02.000Z',
          },
        ],
      }),
    ),
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/importers/github/runs/run-reference-1`,
      () =>
        HttpResponse.json({
          run: {
            id: 'run-1',
            reference: 'run-reference-1',
            importerId: 'github',
            binding: 'kh_binding',
            source: 'repo:mastra',
            importKind: 'agentic',
            triggerKind: 'webhook',
            status: 'succeeded',
            queuedAt: '2026-08-13T03:00:00.000Z',
            startedAt: '2026-08-13T03:00:01.000Z',
            completedAt: '2026-08-13T03:00:02.000Z',
          },
          activity: [
            { id: 'activity-import', action: 'create', targetType: 'record', createdAt: '2026-08-13T03:00:02.000Z' },
          ],
        }),
    ),
  );
}

function renderRoute(path = `/factories/${FACTORY_ID}/knowledge`) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('KnowledgePage', () => {
  it('redirects direct knowledge links when the server-side feature is disabled', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
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
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeInTheDocument();
    // Clean payload → no truncation banner.
    expect(screen.queryByTestId('knowledge-truncation-banner')).not.toBeInTheDocument();
  });

  it('uses scope-first navigation and shows the authorized activity feed', async () => {
    stubKnowledgeRoute();
    const user = userEvent.setup();
    renderRoute();

    const scopes = await screen.findByRole('complementary', { name: 'Knowledge scopes' });
    expect(within(scopes).getByRole('button', { name: 'Project scope' })).toBeInTheDocument();
    expect(await within(scopes).findByRole('button', { name: 'Acme Factory' })).toBeInTheDocument();
    expect(within(scopes).getByRole('button', { name: 'Payments' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'activity' }));
    expect(await screen.findByText('create')).toBeInTheDocument();
    expect(screen.getByText('record')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'github' }));
    expect(await screen.findByRole('heading', { name: 'Knowledge activity' })).toBeInTheDocument();
    expect(screen.queryByText('Agent transcript')).not.toBeInTheDocument();
  });

  it('continues the authorized activity feed with its opaque cursor', async () => {
    stubKnowledgeRoute();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/activity`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        return HttpResponse.json(
          cursor
            ? {
                events: [
                  {
                    id: 'activity-2',
                    action: 'edit',
                    targetType: 'node',
                    sourceType: 'system',
                    createdAt: '2026-08-13T03:00:01.000Z',
                  },
                ],
              }
            : {
                events: [
                  {
                    id: 'activity-1',
                    action: 'create',
                    targetType: 'record',
                    sourceType: 'system',
                    createdAt: '2026-08-13T03:00:02.000Z',
                  },
                ],
                nextCursor: 'activity-cursor',
              },
        );
      }),
    );
    const user = userEvent.setup();
    renderRoute();

    await user.click(await screen.findByRole('tab', { name: 'activity' }));
    await user.click(await screen.findByRole('button', { name: 'Load more activity' }));
    expect(await screen.findByText('edit')).toBeInTheDocument();
  });

  it('shows the filtered approvals worklist and applies a review action', async () => {
    stubKnowledgeRoute();
    const user = userEvent.setup();
    renderRoute();

    await user.click(await screen.findByRole('tab', { name: 'approvals' }));
    expect(await screen.findByText('The current name is stale')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payments Service' })).toBeInTheDocument();
    expect(screen.getByText('Proposer: private')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.getByText('No pending proposals.')).toBeInTheDocument());
  });

  it('keeps proposal deep links addressable and loads authorized continuation pages', async () => {
    stubKnowledgeRoute();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/knowledge/proposals`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === 'page-2') {
          return HttpResponse.json({
            proposals: [
              {
                id: 'proposal-2',
                reference: 'proposal-reference-2',
                operation: 'update-node',
                status: 'pending',
                reason: 'Second authorized proposal',
                targets: [{ type: 'node', id: 'ent-2', name: 'Deploy Runbook', expectedVersion: 1, currentVersion: 1 }],
                proposer: 'private',
                actions: ['approve', 'reject'],
                createdAt: '2026-08-13T02:00:00.000Z',
              },
            ],
          });
        }
        return HttpResponse.json({
          proposals: [
            {
              id: 'proposal-1',
              reference: 'proposal-reference-1',
              operation: 'update-node',
              status: 'pending',
              reason: 'The current name is stale',
              targets: [{ type: 'node', id: 'ent-1', name: 'Payments Service', expectedVersion: 1, currentVersion: 1 }],
              proposer: 'private',
              actions: ['approve', 'reject'],
              createdAt: '2026-08-13T03:00:00.000Z',
            },
          ],
          nextCursor: 'page-2',
        });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderRoute(`/factories/${FACTORY_ID}/knowledge?view=approvals`);

    expect(await screen.findByText('The current name is stale')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open proposal' }));
    await waitFor(() => expect(router.state.location.search).toContain('proposal=proposal-reference-1'));
    await user.click(screen.getByRole('button', { name: 'Load more proposals' }));
    expect(await screen.findByText('Second authorized proposal')).toBeInTheDocument();
  });

  it('shows importer runs and filtered run activity without private transcripts', async () => {
    stubKnowledgeRoute();
    const user = userEvent.setup();
    renderRoute();

    await user.click(await screen.findByRole('tab', { name: 'imports' }));
    expect(await screen.findByText('repo:mastra')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();

    await user.click(screen.getByText('repo:mastra'));
    expect(await screen.findByRole('heading', { name: 'Knowledge activity' })).toBeInTheDocument();
    expect(screen.queryByText('Agent transcript')).not.toBeInTheDocument();
    expect(screen.queryByText('Integrated repository history.')).not.toBeInTheDocument();
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

    expect(await screen.findByText(/No knowledge captured yet/)).toBeInTheDocument();
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
      node: { ...nodeFixture.node, description: '   \n  ' },
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
    const descriptionHeading = within(flyout).getByText('Description');
    const metadataHeading = within(flyout).getByText('Knowledge node');
    expect(descriptionHeading.compareDocumentPosition(metadataHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A10: the pinned knowledge record card carries the amber standout marker.
    const knowledgeRecords = screen.getAllByTestId('knowledge-record');
    expect(within(knowledgeRecords[0]!).getByRole('button', { name: 'Deploy Runbook' })).toBeInTheDocument();
    expect(knowledgeRecords.some(card => card.getAttribute('data-pinned') === 'true')).toBe(true);
    // Drill into the pinned knowledge record → provenance + reasoning.
    await user.click(screen.getByText(/for charging flows/));
    const detail = await screen.findByTestId('knowledge-record-detail');
    expect(detail).toHaveTextContent('Created at');
    expect(screen.getByTestId('knowledge-record-reason')).toHaveTextContent(
      'Learned from a burned API call — costly to rediscover.',
    );
    expect(detail).not.toHaveTextContent('thread-abc-123');
  });

  it('renders an explicitly selected thread view and returns via the breadcrumb', async () => {
    stubKnowledgeRoute();
    renderRoute(`/factories/${FACTORY_ID}/knowledge?thread=thread-abc-123`);
    const user = userEvent.setup();

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

  it('filters provisional scopes and sends suggest-only promotion to Approvals', async () => {
    stubKnowledgeRoute();
    renderRoute();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: 'Needs curation' }));
    expect(screen.queryByRole('button', { name: 'Payments' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Payments intake' }));

    const worklist = await screen.findByTestId('knowledge-curation-worklist');
    expect(worklist).toHaveTextContent('Provisional runbook');
    expect(worklist).toHaveTextContent('subconscious:capture');
    const primaryArticle = within(worklist).getByRole('heading', { name: 'Provisional runbook' }).closest('article');
    const independentArticle = within(worklist).getByRole('heading', { name: 'Independent draft' }).closest('article');
    if (!primaryArticle || !independentArticle) throw new Error('Expected independent curation items');
    const primary = within(primaryArticle);
    const independent = within(independentArticle);
    expect(primary.getByRole('list', { name: 'Evidence for Provisional runbook' })).toHaveTextContent(
      'customer-report',
    );
    await user.click(primary.getByRole('button', { name: 'Load more evidence' }));
    expect(await primary.findByText(/incident-review/)).toBeInTheDocument();
    await user.type(primary.getByRole('textbox', { name: 'Find merge target for Provisional runbook' }), 'Canonical');
    const mergeTarget = await primary.findByRole('button', { name: /Canonical runbook/ });
    await user.click(mergeTarget);
    expect(primary.getByRole('button', { name: 'Merge' })).toBeEnabled();
    expect(independent.getByRole('button', { name: 'Merge' })).toBeDisabled();
    await user.click(primary.getByRole('button', { name: 'Retain' }));
    expect(await primary.findByText('retained · unintegrated')).toBeInTheDocument();
    expect(independent.getByText('provisional')).toBeInTheDocument();
    await user.click(primary.getByRole('button', { name: 'Promote' }));
    expect(await primary.findByText('Sent to Approvals for review.')).toBeInTheDocument();
    await user.click(primary.getByRole('button', { name: 'Open proposal' }));
    expect(await screen.findByRole('tab', { name: 'approvals' })).toHaveAttribute('aria-selected', 'true');
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
