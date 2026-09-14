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
    { id: 'record-3', nodeIds: ['payments'], pinned: false, text: 'See [[Observational memory]].' },
  ],
  truncated: false,
  outOfWindow: [
    {
      id: 'observational-memory',
      name: 'Observational memory',
      scope: ['org:proof', `resource:${projectId}`],
      rung: 'resource',
    },
  ],
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
    if (url.pathname.endsWith('/knowledge/search')) {
      return route.fulfill({
        json: {
          results: [
            {
              id: 'payments',
              name: 'Payments Service',
              kind: 'service',
              type: 'node',
              rung: 'resource',
            },
          ],
          truncated: false,
        },
      });
    }
    if (url.pathname.endsWith('/knowledge/scopes')) {
      return route.fulfill({
        json: {
          roots: [
            // The org rung's address is owned by a reconciled scope node —
            // server attaches the structural match so the UI renders one
            // name + kind entry instead of two labels for the same scope.
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
              memberCount: 2,
              memberCountTruncated: false,
              contentNodeCount: 0,
              childScopeCount: 2,
            },
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              address: `resource:${projectId}`,
              name: projectId,
              parentIds: ['11111111-1111-4111-8111-111111111111'],
              memberCount: 2,
              memberCountTruncated: false,
              contentNodeCount: 2,
              childScopeCount: 0,
            },
            {
              id: '22222222-2222-4222-8222-222222222222',
              address: 'features',
              name: 'features',
              kind: 'feature',
              description: 'Shipped Mastra features',
              parentIds: ['11111111-1111-4111-8111-111111111111'],
              memberCount: 3,
              memberCountTruncated: false,
              contentNodeCount: 1,
              childScopeCount: 2,
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
                memberCount: 3,
                memberCountTruncated: false,
                contentNodeCount: 1,
                childScopeCount: 2,
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
                memberCount: 1,
                memberCountTruncated: false,
                contentNodeCount: 1,
                childScopeCount: 0,
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
                memberCount: 0,
                memberCountTruncated: false,
                contentNodeCount: 0,
                childScopeCount: 0,
                createdAt: '2026-08-28T10:00:00.000Z',
                updatedAt: '2026-08-28T10:00:00.000Z',
              },
              graph.nodes[0],
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
              {
                id: 'contains:features:payments',
                source: '22222222-2222-4222-8222-222222222222',
                target: 'payments',
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
              action: 'record-created',
              recordType: 'record',
              recordId: 'rec-1',
              scope: ['org:proof', `resource:${projectId}`],
              node: { id: 'payments', name: 'Payments Service', rung: 'resource' },
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
  await page.getByRole('button', { name: new RegExp(`${projectId} project`) }).click();
  await expect(page.getByText('Payments Service')).toBeVisible();
  await expect(page.getByTestId('knowledge-scope-flyout')).toContainText(`project:${projectId}`);
  await expect(page.getByTestId('knowledge-scope-flyout')).not.toContainText(`resource:${projectId}`);

  // Search results remain above the open details flyout after returning search
  // to the page header.
  const headerSearch = page.getByRole('combobox', { name: 'Search knowledge' });
  await headerSearch.fill('payments');
  const searchResults = page.getByRole('listbox', { name: 'Knowledge search results' });
  await expect(searchResults).toBeVisible();
  const resultsAreTopmost = await searchResults.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const topmost = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return topmost === element || (topmost !== null && element.contains(topmost));
  });
  expect(resultsAreTopmost).toBe(true);
  await headerSearch.press('ArrowDown');
  await headerSearch.press('Enter');
  await expect(page).toHaveURL(/node=payments/);
  await expect(page.getByText(/Payments uses/)).toBeVisible();

  // The graph pane must actually have height — a broken flex chain renders
  // nodes at zero height while visibility checks on their text still pass.
  const container = page.locator('[data-testid="knowledge-graph-container"]');
  await expect.poll(async () => (await container.boundingBox())?.height ?? 0).toBeGreaterThan(100);

  const boundaryNode = page.locator('[data-node-id="observational-memory"][data-node-type="boundary"]');
  await expect(boundaryNode).toContainText('Observational memory');
  await expect(boundaryNode).toContainText('↗ Project');
  await expect(boundaryNode.locator(':scope > div').first()).toHaveCSS('border-style', 'dashed');
  await expect(page.locator('.react-flow__edge[data-id="record:record-3"]')).toBeVisible();
  await expect(page.getByTestId('knowledge-truncation-banner')).toHaveCount(0);
  const lensUrl = page.url();
  await boundaryNode.dispatchEvent('click');
  await expect.poll(() => page.url()).toBe(lensUrl);

  await page.locator('.react-flow__node[data-id="payments"]').dispatchEvent('click');
  await expect(page.getByText(/Payments uses/)).toBeVisible();

  await page.getByRole('tab', { name: 'activity' }).click();
  await expect(page.getByText('new record')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Knowledge activity' })).not.toContainText('· record ·');

  // The sidebar is ONE unified tree built from the scope nodes that exist:
  // identity scopes and declared structure use one name + kind-chip treatment.
  await page.getByRole('tab', { name: 'explore' }).click();
  const scopeTree = page.getByRole('complementary', { name: 'Knowledge scopes' });
  const search = page.getByRole('combobox', { name: 'Search knowledge' });
  await expect(search).toBeVisible();
  await expect(search).toHaveAttribute('placeholder', 'Search');
  await expect(scopeTree.getByRole('combobox', { name: 'Search knowledge' })).toHaveCount(0);
  await expect(scopeTree.getByText('Your access')).toBeHidden();
  await expect(scopeTree.getByText('Knowledge structure')).toBeHidden();
  await expect(scopeTree.getByRole('button', { name: /mastra org 2/ })).toBeVisible();
  await expect(scopeTree.getByRole('button', { name: new RegExp(`${projectId} project 2`) })).toBeVisible();
  await expect(scopeTree.getByRole('button', { name: /features feature 3/ })).toBeVisible();
  await expect(scopeTree.getByText(/your org|your project|inside/)).toBeHidden();

  // A tree selection changes the structural lens and opens its detail.
  await scopeTree.getByRole('button', { name: /features feature/ }).click();
  await expect(page).toHaveURL(/scope=22222222-2222-4222-8222-222222222222/);
  await expect(page).toHaveURL(/node=22222222-2222-4222-8222-222222222222/);
  await expect(page.getByTestId('knowledge-scope-flyout')).toContainText('features');
  await expect(page.getByTestId('knowledge-scope-flyout')).toContainText('scope');
  await expect(page.getByTestId('knowledge-scope-flyout')).not.toContainText('Structural scope');
  await expect(page.getByText('subconscious')).toBeVisible();
  const featureScopeNode = page.locator(
    '[data-testid="knowledge-node"][data-node-id="22222222-2222-4222-8222-222222222222"]',
  );
  await expect(featureScopeNode.getByLabel('3 direct members')).toHaveCount(0);
  const memoryScopeNode = page.locator('[data-testid="knowledge-node"][data-node-id="memory-scope"]');
  await expect(memoryScopeNode).toHaveCSS('cursor', 'pointer');
  const memoryBadge = memoryScopeNode.getByLabel('1 direct members');
  await expect(memoryBadge).toBeVisible();
  const badgeContrast = await memoryBadge.evaluate(element => {
    const html = document.documentElement;
    const originalClassName = html.className;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Expected a canvas rendering context');

    const luminance = (cssColor: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = cssColor;
      context.fillRect(0, 0, 1, 1);
      const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
      const [linearRed = 0, linearGreen = 0, linearBlue = 0] = [red, green, blue].map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
    };
    const measure = () => {
      const style = getComputedStyle(element);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    };

    html.classList.remove('light');
    html.classList.add('dark');
    const dark = measure();
    html.classList.remove('dark');
    html.classList.add('light');
    const light = measure();
    html.className = originalClassName;
    return { dark, light };
  });
  expect(badgeContrast.dark).toBeGreaterThanOrEqual(4.5);
  expect(badgeContrast.light).toBeGreaterThanOrEqual(4.5);
  await featureScopeNode.hover();
  const scopeHover = page.getByTestId('knowledge-hover-card');
  await expect(scopeHover).toContainText('Content nodes1');
  await expect(scopeHover).toContainText('Child scopes2');
  await expect(scopeHover).toContainText('Direct members3');
  await expect(scopeHover).not.toContainText('Connections');
  await page.locator('.react-flow__edge[data-id="contains:features:memory"]').dispatchEvent('mouseover', {
    clientX: 140,
    clientY: 100,
  });
  await expect(page.getByTestId('knowledge-hover-card')).toContainText('Direct member of this scope');

  // Scope nodes have a distinct border and background from content nodes.
  const scopeInner = page.locator('[data-testid="knowledge-node"][data-node-type="scope"] > div').first();
  const contentInner = page.locator('[data-testid="knowledge-node"][data-node-type="content"] > div').first();
  await expect(scopeInner).toBeVisible();
  await expect(contentInner).toBeVisible();
  const [scopeStyle, contentStyle] = await Promise.all([
    scopeInner.evaluate(element => {
      const style = getComputedStyle(element);
      return { borderColor: style.borderColor, backgroundImage: style.backgroundImage };
    }),
    contentInner.evaluate(element => {
      const style = getComputedStyle(element);
      return { borderColor: style.borderColor, backgroundImage: style.backgroundImage };
    }),
  ]);
  expect(scopeStyle.borderColor).not.toBe(contentStyle.borderColor);
  expect(scopeStyle.backgroundImage).not.toBe(contentStyle.backgroundImage);

  // Clicking that same scope on the canvas applies the same selection model.
  await page.getByRole('button', { name: 'Close scope details' }).click();
  await page.locator('.react-flow__node[data-id="22222222-2222-4222-8222-222222222222"]').dispatchEvent('click');
  await expect(page.getByTestId('knowledge-scope-flyout')).toContainText('features');

  if (output) {
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'explore.png'), fullPage: true });
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify({ tests: [{ title: 'explores scoped knowledge and activity', status: 'passed' }] }, null, 2),
    );
  }
});
