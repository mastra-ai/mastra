import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const projectId = 'factory-proof';
const output = process.env.KNOWLEDGE_PROOF_OUTPUT ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT) : undefined;

const graph = {
  view: 'project',
  scopeId: 'kh_scope_project',
  nodes: [
    {
      id: 'kh_node_payments',
      reference: 'kr_node_payments',
      name: 'Payments Service',
      kind: 'service',
      description: 'Handles charging flows through [[Deploy Runbook]].',
      pinned: true,
      recordCount: 1,
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:00.000Z',
    },
    {
      id: 'kh_node_runbook',
      reference: 'kr_node_runbook',
      name: 'Deploy Runbook',
      kind: 'doc',
      pinned: false,
      recordCount: 1,
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:00.000Z',
    },
  ],
  edges: [
    {
      id: 'kh_edge_one',
      source: 'kh_node_payments',
      target: 'kh_node_runbook',
      type: 'wikilink',
      recordId: 'kh_record_one',
    },
    {
      id: 'kh_edge_two',
      source: 'kh_node_runbook',
      target: 'kh_node_payments',
      type: 'wikilink',
      recordId: 'kh_record_two',
    },
  ],
  records: [
    {
      id: 'kh_record_one',
      nodeIds: ['kh_node_payments', 'kh_node_runbook'],
      pinned: true,
      text: 'Payments uses the runbook.',
    },
    {
      id: 'kh_record_two',
      nodeIds: ['kh_node_runbook', 'kh_node_payments'],
      pinned: false,
      text: 'Runbook covers payments.',
    },
  ],
  truncated: false,
  outOfWindow: [],
  unresolvedCapped: { count: 0, names: [] },
  pinCensus: { resource: 1, thread: null },
  version: 'proof-version',
};

test('renders scoped knowledge and activity from sanitized network fixtures', async ({ context, page }) => {
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
    if (url.pathname.endsWith('/attention')) return route.fulfill({ json: { items: [] } });
    if (url.pathname.endsWith('/work-records')) return route.fulfill({ json: { workRecords: [] } });
    if (url.pathname.endsWith('/web/github/subscriptions')) return route.fulfill({ json: { subscriptions: [] } });
    if (url.pathname.endsWith('/knowledge/scopes')) {
      return route.fulfill({
        json: {
          scope: { id: 'kh_scope_project', reference: 'kr_scope_project', name: 'Proof Factory', kind: 'project' },
          children: [],
        },
      });
    }
    if (url.pathname.endsWith('/knowledge/subgraph')) return route.fulfill({ json: graph });
    if (url.pathname.endsWith('/knowledge/activity')) {
      return route.fulfill({
        json: {
          events: [
            {
              action: 'create',
              targetType: 'record',
              sourceType: 'system',
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
              id: 'kh_record_one',
              nodeId: 'kh_node_payments',
              relation: 'owned',
              text: 'Payments uses [[Deploy Runbook]].',
              createdAt: '2026-08-28T10:00:00.000Z',
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

  await page.locator('.react-flow__node[data-id="kh_node_payments"]').dispatchEvent('click');
  await expect(page.getByText(/Payments uses/)).toBeVisible();

  await page.getByRole('tab', { name: 'activity' }).click();
  await expect(page.getByText('create', { exact: true })).toBeVisible();

  if (output) {
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'explore.png'), fullPage: true });
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify(
        {
          tests: [{ title: 'renders scoped knowledge and activity from sanitized network fixtures', status: 'passed' }],
        },
        null,
        2,
      ),
    );
  }
});
