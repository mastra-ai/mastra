import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { attentionKindSummaries } from '../ui/attention';

const projectId = 'factory-proof';
const output = process.env.KNOWLEDGE_PROOF_OUTPUT ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT) : undefined;

const scopeId = '8cf828b5-48a2-47eb-81f6-36f716fa1464';
const graph = {
  view: 'project',
  scopeId,
  nodes: [
    {
      id: 'payments',
      name: 'Payments Service',
      kind: 'service',
      description: 'Handles charging flows through [[Deploy Runbook]].',
      scopeIds: [scopeId],
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
      scopeIds: [scopeId],
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

test.describe('Knowledge Explore', () => {
  test.describe('when a project has scoped records and activity', () => {
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
        if (url.pathname.endsWith('/attention'))
          return route.fulfill({ json: { items: [], kinds: attentionKindSummaries([]), hasMore: false } });
        if (url.pathname.endsWith('/feed-events')) return route.fulfill({ json: { events: [], hasMore: false } });
        if (url.pathname.endsWith('/active-runs')) return route.fulfill({ json: { runs: [] } });
        if (url.pathname.endsWith('/decisions')) return route.fulfill({ json: { decisions: [] } });
        if (url.pathname.endsWith('/work-records')) return route.fulfill({ json: { workRecords: [] } });
        if (url.pathname.endsWith('/web/github/subscriptions')) return route.fulfill({ json: { subscriptions: [] } });
        if (url.pathname.endsWith('/knowledge/scopes')) {
          return route.fulfill({
            json: { scope: { id: scopeId, name: 'Proof Factory', kind: 'project', parentScopeIds: [] }, children: [] },
          });
        }
        if (url.pathname.endsWith('/knowledge/subgraph')) return route.fulfill({ json: graph });
        if (url.pathname.endsWith('/knowledge/activity')) {
          return route.fulfill({
            json: {
              events: [
                {
                  id: 'activity-1',
                  action: 'knowledge-appended',
                  recordType: 'record',
                  scopeIds: [scopeId],
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
                  nodeId: 'payments',
                  relation: 'owned',
                  text: 'Payments uses [[Deploy Runbook]].',
                  scopeIds: [scopeId],
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
      await expect(page.getByText('Payments Service')).toBeVisible();

      // The graph pane must actually have height — a broken flex chain renders
      // nodes at zero height while visibility checks on their text still pass.
      const container = page.locator('[data-testid="knowledge-graph-container"]');
      await expect.poll(async () => (await container.boundingBox())?.height ?? 0).toBeGreaterThan(100);

      await page.locator('.react-flow__node[data-id="payments"]').dispatchEvent('click');
      await expect(page.getByText(/Payments uses/)).toBeVisible();

      await page.getByRole('tab', { name: 'activity' }).click();
      await expect(page.getByText('knowledge-appended')).toBeVisible();

      if (output) {
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'explore.png'), fullPage: true });
        fs.writeFileSync(
          path.join(output, 'results.json'),
          JSON.stringify({ tests: [{ title: 'explores scoped knowledge and activity', status: 'passed' }] }, null, 2),
        );
      }
    });
  });
});
