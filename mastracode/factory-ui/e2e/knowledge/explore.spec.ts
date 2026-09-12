import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const projectId = 'factory-proof';
const output = process.env.KNOWLEDGE_PROOF_OUTPUT ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT) : undefined;

const graph = {
  view: 'project',
  nodes: [
    {
      id: 'payments',
      name: 'Payments Service',
      kind: 'service',
      description: 'Handles charging flows through [[Deploy Runbook]].',
      scope: ['org:proof', `resource:${projectId}`],
      rung: 'resource',
      pinned: true,
      recordCount: 1,
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:00.000Z',
    },
    {
      id: 'runbook',
      name: 'Deploy Runbook',
      kind: 'doc',
      scope: ['org:proof', `resource:${projectId}`],
      rung: 'resource',
      pinned: false,
      recordCount: 1,
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:00.000Z',
    },
  ],
  edges: [
    { id: 'edge-1', source: 'payments', target: 'runbook', type: 'wikilink', recordId: 'record-1' },
    { id: 'edge-2', source: 'runbook', target: 'payments', type: 'wikilink', recordId: 'record-2' },
  ],
  records: [
    { id: 'record-1', nodeIds: ['payments', 'runbook'], pinned: true, text: 'Payments uses the runbook.' },
    { id: 'record-2', nodeIds: ['runbook', 'payments'], pinned: false, text: 'Runbook covers payments.' },
  ],
  truncated: false,
  outOfWindow: [],
  unresolvedCapped: { count: 0, names: [] },
  pinCensus: { resource: 1, thread: null },
  version: 'proof-version',
};

test('explores scoped knowledge and activity', async ({ context, page }) => {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) {
      return route.fulfill({ json: { authenticated: true, authEnabled: true, user: { userId: 'proof-user' } } });
    }
    if (url.pathname.endsWith('/web/config/features')) return route.fulfill({ json: { knowledge: true } });
    if (url.pathname.endsWith('/web/factory/projects')) {
      return route.fulfill({ json: { projects: [{ id: projectId, name: 'Proof Factory' }] } });
    }
    if (url.pathname.endsWith(`/web/factory/projects/${projectId}`)) {
      return route.fulfill({ json: { project: { id: projectId, name: 'Proof Factory' } } });
    }
    if (url.pathname.endsWith('/source-control-connections')) return route.fulfill({ json: { connections: [] } });
    if (url.pathname.includes('/permissions')) return route.fulfill({ json: {} });
    if (url.pathname.endsWith('/work-items')) return route.fulfill({ json: { workItems: [] } });
    if (url.pathname.endsWith('/attention')) {
      const empty = { open: 0, unread: 0, latest: null };
      return route.fulfill({
        json: {
          items: [],
          kinds: {
            'automation-failed': empty,
            'supervisor-finding': empty,
            'agent-waiting': empty,
            mention: empty,
            'automation-proposed': empty,
            activity: empty,
          },
          hasMore: false,
        },
      });
    }
    if (url.pathname.endsWith('/active-runs')) return route.fulfill({ json: { runs: [] } });
    if (url.pathname.endsWith('/decisions')) return route.fulfill({ json: { decisions: [] } });
    if (url.pathname.endsWith('/work-records')) return route.fulfill({ json: { workRecords: [] } });
    if (url.pathname.endsWith('/web/github/subscriptions')) return route.fulfill({ json: { subscriptions: [] } });
    if (url.pathname.endsWith('/knowledge/scopes')) {
      return route.fulfill({
        json: {
          roots: [
            // The org rung's address is owned by a reconciled scope node —
            // server attaches the structural match so the UI renders one
            // merged entry instead of two labels for the same scope.
            {
              level: 'org',
              id: 'proof',
              available: true,
              scopeNodeId: '11111111-1111-4111-8111-111111111111',
              name: 'mastra',
            },
            {
              level: 'resource',
              id: projectId,
              available: true,
              scopeNodeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              name: projectId,
            },
          ],
          defaultLevel: 'resource',
          // The unified tree rides along: the host-vouched identity chain
          // (org → project) and the declared structure are all scope nodes
          // linked by membership edges.
          scopeNodes: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              address: 'org:proof',
              name: 'mastra',
              kind: 'org',
              parentIds: [],
            },
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              address: `resource:${projectId}`,
              name: projectId,
              parentIds: ['11111111-1111-4111-8111-111111111111'],
            },
            {
              id: '22222222-2222-4222-8222-222222222222',
              address: 'features',
              name: 'features',
              kind: 'feature',
              description: 'Shipped Mastra features',
              parentIds: ['11111111-1111-4111-8111-111111111111'],
            },
          ],
        },
      });
    }
    if (url.pathname.endsWith('/knowledge/subgraph')) {
      const scopeNodeId = url.searchParams.get('scopeNodeId');
      // The merged project entry's lens is the project graph itself.
      if (scopeNodeId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') {
        return route.fulfill({ json: graph });
      }
      if (scopeNodeId) {
        return route.fulfill({
          json: {
            ...graph,
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
                createdAt: '2026-08-28T10:00:00.000Z',
                updatedAt: '2026-08-28T10:00:00.000Z',
              },
              {
                id: 'memory-scope',
                name: 'memory',
                kind: 'feature',
                scope: null,
                rung: null,
                isScope: true,
                pinned: false,
                recordCount: 0,
                createdAt: '2026-08-28T10:00:00.000Z',
                updatedAt: '2026-08-28T10:00:00.000Z',
              },
              {
                id: 'subconscious-scope',
                name: 'subconscious',
                kind: 'feature',
                scope: null,
                rung: null,
                isScope: true,
                pinned: false,
                recordCount: 0,
                createdAt: '2026-08-28T10:00:00.000Z',
                updatedAt: '2026-08-28T10:00:00.000Z',
              },
            ],
            // Containment edges: the selected scope contains every member, so
            // the lens is a connected tree instead of bare dots.
            edges: [
              {
                id: 'contains:features:memory',
                source: '22222222-2222-4222-8222-222222222222',
                target: 'memory-scope',
                type: 'contains',
              },
              {
                id: 'contains:features:subconscious',
                source: '22222222-2222-4222-8222-222222222222',
                target: 'subconscious-scope',
                type: 'contains',
              },
            ],
            records: [],
          },
        });
      }
      return route.fulfill({ json: graph });
    }
    if (url.pathname.endsWith('/knowledge/activity')) {
      return route.fulfill({
        json: {
          events: [
            {
              id: 'activity-1',
              action: 'knowledge-appended',
              recordType: 'record',
              scope: ['org:proof', `resource:${projectId}`],
              createdAt: '2026-08-28T10:00:00.000Z',
            },
          ],
        },
      });
    }
    if (url.pathname.includes('/knowledge/nodes/')) {
      return route.fulfill({
        json: {
          node: { ...graph.nodes[0], content: 'Handles charging flows through [[Deploy Runbook]].' },
          records: [
            {
              id: 'record-1',
              node: 'payments',
              relation: 'owned',
              text: 'Payments uses [[Deploy Runbook]].',
              scope: ['org:proof', `resource:${projectId}`],
              rung: 'resource',
              capturedAt: '2026-08-28T10:00:00.000Z',
              pinned: true,
            },
          ],
        },
      });
    }
    return route.continue();
  });

  await page.goto(`/factories/${projectId}/knowledge`);
  await expect(page.getByRole('heading', { name: 'Knowledge' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Knowledge scopes' })).toBeVisible();
  await expect(page.getByText('Select a scope to explore its knowledge.')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${projectId} · your project`) }).click();
  await expect(page.getByText('Payments Service')).toBeVisible();

  // The graph pane must actually have height — a broken flex chain renders
  // nodes at zero height while visibility checks on their text still pass.
  const container = page.locator('[data-testid="knowledge-graph-container"]');
  await expect.poll(async () => (await container.boundingBox())?.height ?? 0).toBeGreaterThan(100);

  await page.locator('.react-flow__node[data-id="payments"]').dispatchEvent('click');
  await expect(page.getByText(/Payments uses/)).toBeVisible();

  await page.getByRole('tab', { name: 'activity' }).click();
  await expect(page.getByText('knowledge-appended')).toBeVisible();

  // The sidebar is ONE unified tree built from the scope nodes that exist:
  // merged identity entries (structural name + marker) with declared structure
  // nested via membership edges — no "Your access" / "Knowledge structure" split.
  await page.getByRole('tab', { name: 'explore' }).click();
  const scopeTree = page.getByRole('complementary', { name: 'Knowledge scopes' });
  await expect(scopeTree.getByText('Your access')).toBeHidden();
  await expect(scopeTree.getByText('Knowledge structure')).toBeHidden();
  await expect(scopeTree.getByRole('button', { name: /mastra · your org/ })).toBeVisible();
  await expect(scopeTree.getByRole('button', { name: new RegExp(`${projectId} · your project`) })).toBeVisible();
  await expect(scopeTree.getByRole('button', { name: /Organization/ })).toBeHidden();
  await expect(scopeTree.getByRole('button', { name: 'mastra', exact: true })).toBeHidden();

  // The merged entry opens the structural lens for the matched scope node.
  await scopeTree.getByRole('button', { name: /mastra · your org/ }).click();
  await expect(page).toHaveURL(/scope=11111111-1111-4111-8111-111111111111/);

  // Declared structure nests under the merged org entry via membership edges.
  await scopeTree.getByRole('button', { name: 'features' }).click();
  await expect(page).toHaveURL(/scope=22222222-2222-4222-8222-222222222222/);
  await expect(page.getByText('subconscious')).toBeVisible();
  // The clicked scope node renders as its own graph root inside the lens.
  await expect(page.locator('[data-testid="knowledge-graph-container"]').getByText('features')).toBeVisible();

  // Clicking a member scope drills down into it instead of opening a flyout.
  await page.locator('.react-flow__node[data-id="subconscious-scope"]').dispatchEvent('click');
  await expect(page).toHaveURL(/scope=subconscious-scope/);

  if (output) {
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'explore.png'), fullPage: true });
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify({ tests: [{ title: 'explores scoped knowledge and activity', status: 'passed' }] }, null, 2),
    );
  }
});
