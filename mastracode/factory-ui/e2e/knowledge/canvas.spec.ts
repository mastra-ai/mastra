import { Knowledge } from '@mastra/core/knowledge';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { KnowledgeRoutes } from '../../../factory/src/routes/knowledge.js';
import { createRouteTestApp, fakeRouteAuth } from '../../../factory/src/routes/test-utils.js';
import { createFactoryStorageForTests, LibSQLStore } from '../../../factory/src/storage/test-utils.js';

const orgId = 'canvas-proof-org';
const output = process.env.KNOWLEDGE_PROOF_OUTPUT ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT) : undefined;
const results = new Map<string, string>();

async function createCanvasHarness() {
  const factory = await createFactoryStorageForTests({ autoClose: false });
  const project = await factory.projects.create({ orgId, userId: 'proof-user', input: { name: 'Canvas proof' } });
  const databasePath = path.join(tmpdir(), `knowledge-canvas-${randomUUID()}.db`);
  const storage = new LibSQLStore({ id: 'canvas-proof', url: `file:${databasePath}` });
  const knowledge = new Knowledge({ id: 'mastra', storage });
  const store = await knowledge.getStorageInternal();
  await store.init();

  const orgAddress = `org:${orgId}`;
  const resourceAddress = `resource:${project.id}`;
  const adjacentAddress = `${resourceAddress}:platform`;
  const org = await knowledge.materializeScope({ address: orgAddress, contextualScopeAddress: orgAddress });
  const resource = await knowledge.materializeScope({
    address: resourceAddress,
    parentAddresses: [orgAddress],
    contextualScopeAddress: orgAddress,
  });
  const adjacent = await knowledge.materializeScope({
    address: adjacentAddress,
    parentAddresses: [resourceAddress],
    contextualScopeAddress: resourceAddress,
  });
  const orgScopeId = org.scopes[orgAddress]!;
  const resourceScopeId = resource.scopes[resourceAddress]!;
  const adjacentScopeId = adjacent.scopes[adjacentAddress]!;
  await store.upsertScopeGrant({ scopeNodeId: resourceScopeId, scopeRefId: orgScopeId, role: 'owner' });

  await Promise.all(
    Array.from({ length: 260 }, (_, index) =>
      store.createNode({
        name: `Scale node ${String(index).padStart(3, '0')}`,
        kind: 'benchmark',
        scopeIds: [resourceScopeId],
      }),
    ),
  );

  const source = await store.createNode({ name: 'Boundary source', kind: 'service', scopeIds: [resourceScopeId] });
  const boundary = await store.createNode({ name: 'Platform boundary', kind: 'service', scopeIds: [adjacentScopeId] });
  const cycleA = await store.createNode({ name: 'Cycle A', kind: 'concept', scopeIds: [resourceScopeId] });
  const cycleB = await store.createNode({ name: 'Cycle B', kind: 'concept', scopeIds: [resourceScopeId] });
  await store.createRecord({
    node: source,
    text: 'Uses [[Platform boundary]].',
    source: 'proof:canvas',
    scopeIds: [resourceScopeId],
    resolutionScopeIds: [resourceScopeId, adjacentScopeId],
  });
  await store.createRecord({
    node: cycleA,
    text: 'Links [[Cycle B]].',
    source: 'proof:canvas',
    scopeIds: [resourceScopeId],
    resolutionScopeIds: [resourceScopeId],
  });
  await store.createRecord({
    node: cycleB,
    text: 'Links [[Cycle A]].',
    source: 'proof:canvas',
    scopeIds: [resourceScopeId],
    resolutionScopeIds: [resourceScopeId],
  });

  const hiddenScope = await store.createNode({ name: 'Hidden scope', isScope: true, scopeIds: [] });
  await store.createNode({ name: 'Hidden target', kind: 'secret', scopeIds: [hiddenScope.id] });
  await store.createRecord({
    node: source,
    text: 'Must not reveal [[Hidden target]].',
    source: 'proof:canvas',
    scopeIds: [resourceScopeId],
    resolutionScopeIds: [hiddenScope.id],
  });

  const routes = new KnowledgeRoutes({
    auth: fakeRouteAuth(),
    projects: factory.projects,
    knowledge: async () => knowledge,
    accessProfile: async ({ builtInScopes }) => ({
      id: 'canvas-proof',
      rootScopeAddress: builtInScopes.resource.address,
      baselineScopes: [builtInScopes.org, builtInScopes.resource],
      intakeScopes: [
        {
          address: adjacentAddress,
          parentAddresses: [builtInScopes.resource.address],
          contextualScopeAddress: builtInScopes.resource.address,
        },
      ],
      vouchedScopeAddresses: [builtInScopes.org.address],
    }),
  }).routes();
  const app = createRouteTestApp(routes, { workosId: 'proof-user', organizationId: orgId });

  return {
    app,
    projectId: project.id,
    resourceScopeName: project.id,
    close: async () => {
      await storage.close();
      fs.rmSync(databasePath, { force: true });
      await factory.storage.close();
    },
  };
}

async function installRoutes(context: BrowserContext) {
  const harness = await createCanvasHarness();
  context.on('close', () => void harness.close());
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.includes(`/web/factory/projects/${harness.projectId}/knowledge`)) {
      const response = await harness.app.request(`${url.pathname}${url.search}`, {
        method: request.method(),
        headers: request.headers(),
        body: request.postData() ?? undefined,
      });
      return route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
      });
    }
    if (url.pathname.endsWith('/auth/me')) {
      return route.fulfill({ json: { authenticated: true, authEnabled: true, user: { userId: 'proof-user' } } });
    }
    if (url.pathname.endsWith('/web/config/features')) return route.fulfill({ json: { knowledge: true } });
    if (url.pathname.endsWith('/web/factory/projects')) {
      return route.fulfill({ json: { projects: [{ id: harness.projectId, name: 'Canvas proof' }] } });
    }
    if (url.pathname.endsWith(`/web/factory/projects/${harness.projectId}`)) {
      return route.fulfill({ json: { project: { id: harness.projectId, name: 'Canvas proof' } } });
    }
    if (url.pathname.endsWith('/source-control-connections')) return route.fulfill({ json: { connections: [] } });
    if (url.pathname.includes('/permissions')) return route.fulfill({ json: {} });
    if (url.pathname.endsWith('/work-items')) return route.fulfill({ json: { workItems: [] } });
    if (url.pathname.endsWith('/attention')) return route.fulfill({ json: { items: [] } });
    if (url.pathname.endsWith('/work-records')) return route.fulfill({ json: { workRecords: [] } });
    if (url.pathname.endsWith('/web/github/subscriptions')) return route.fulfill({ json: { subscriptions: [] } });
    return route.continue();
  });
  return harness;
}

async function recordResult(page: Page, title: string, screenshot: string) {
  results.set(title, 'passed');
  if (!output) return;
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
  fs.writeFileSync(
    path.join(output, 'results.json'),
    JSON.stringify({ tests: [...results].map(([testTitle, status]) => ({ title: testTitle, status })) }, null, 2),
  );
}

test.describe('Knowledge graph canvas', () => {
  test.describe('when an authorized user explores a large scope lens', () => {
    test('selects a bounded lens, preserves cycles and privacy, and navigates an adjacent scope', async ({
      context,
      page,
    }) => {
      const harness = await installRoutes(context);
      await page.goto(`/factories/${harness.projectId}/knowledge`);
      await expect(page.getByText('Select a scope to open its bounded knowledge lens.')).toBeVisible();

      await page.getByRole('button', { name: harness.resourceScopeName }).click();
      await expect(page.getByTestId('knowledge-truncation-banner')).toContainText('Bounded lens');
      await expect(page.getByTestId('knowledge-node')).toHaveCount(251);
      await expect(page.getByText('Cycle A')).toBeVisible();
      await expect(page.getByText('Cycle B')).toBeVisible();
      await expect(page.getByText('Hidden target')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Open .*platform/ })).toBeVisible();

      const resourceLensUrl = page.url();
      await page.getByRole('button', { name: /Open .*platform/ }).click();
      await expect.poll(() => page.url()).not.toBe(resourceLensUrl);
      await page.getByRole('button', { name: 'Scope map' }).click();
      await expect(page.getByLabel('Scope map')).toContainText('platform');
      await expect(page.getByLabel('Scope map')).toContainText('1 scope omitted by canvas bounds');
      await recordResult(page, 'bounded canvas lifecycle', 'canvas-boundary.png');
    });
  });
});
