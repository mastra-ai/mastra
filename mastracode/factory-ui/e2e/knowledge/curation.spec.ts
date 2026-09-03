import { Knowledge } from '@mastra/core/knowledge';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { KnowledgeRoutes } from '../../../factory/src/routes/knowledge.js';
import { createRouteTestApp, fakeRouteAuth } from '../../../factory/src/routes/test-utils.js';
import { createFactoryStorageForTests, LibSQLStore } from '../../../factory/src/storage/test-utils.js';

const orgId = 'curation-proof-org';
const output = process.env.KNOWLEDGE_PROOF_OUTPUT ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT) : undefined;
const results = new Map<string, string>();

type Authority = 'owner' | 'suggest';

async function createCurationHarness(authority: Authority) {
  const factory = await createFactoryStorageForTests({ autoClose: false });
  const project = await factory.projects.create({ orgId, userId: 'proof-user', input: { name: 'Curation proof' } });
  const databasePath = path.join(tmpdir(), `knowledge-curation-${authority}-${randomUUID()}.db`);
  const storage = new LibSQLStore({ id: `curation-${authority}`, url: `file:${databasePath}` });
  const knowledge = new Knowledge({ id: 'mastra', storage });
  const store = await knowledge.getStorageInternal();
  await store.init();

  const orgAddress = `org:${orgId}`;
  const resourceAddress = `resource:${project.id}`;
  const companionAddress = `${resourceAddress}:uncurated`;
  const org = await knowledge.materializeScope({ address: orgAddress, contextualScopeAddress: orgAddress });
  const resource = await knowledge.materializeScope({
    address: resourceAddress,
    parentAddresses: [orgAddress],
    contextualScopeAddress: orgAddress,
  });
  const companion = await knowledge.materializeScope({
    address: companionAddress,
    parentAddresses: [resourceAddress],
    contextualScopeAddress: resourceAddress,
  });
  const orgScopeId = org.scopes[orgAddress]!;
  const resourceScopeId = resource.scopes[resourceAddress]!;
  const companionScopeId = companion.scopes[companionAddress]!;
  await store.upsertScopeGrant({
    scopeNodeId: resourceScopeId,
    scopeRefId: orgScopeId,
    role: authority === 'owner' ? 'owner' : 'readonly',
    canSuggest: authority === 'suggest' ? true : undefined,
  });
  await store.upsertScopeGrant({
    scopeNodeId: companionScopeId,
    scopeRefId: orgScopeId,
    role: authority === 'owner' ? 'owner' : 'readonly',
    canSuggest: authority === 'suggest' ? true : undefined,
  });

  const profileId = `curator:${authority}`;
  await knowledge.registerCuratorProfile({
    id: profileId,
    identityScope: { address: `${profileId}:${project.id}`, contextualScopeAddress: `${profileId}:${project.id}` },
    grants: [
      {
        scopeAddress: companionAddress,
        role: authority === 'owner' ? 'owner' : 'readonly',
        canSuggest: authority === 'suggest' ? true : undefined,
      },
      {
        scopeAddress: resourceAddress,
        role: authority === 'owner' ? 'owner' : 'readonly',
        canSuggest: authority === 'suggest' ? true : undefined,
      },
    ],
  });

  const names =
    authority === 'owner'
      ? ['Refine draft', 'Merge draft', 'Retain draft', 'Discard draft', 'Promote draft']
      : ['Suggest promotion draft'];
  for (const name of names) {
    const node = await store.createNode({ name, kind: 'document', scopeIds: [companionScopeId] });
    await store.createRecord({
      node,
      text: `${name} evidence`,
      source: 'proof:capture',
      scopeIds: [companionScopeId],
      metadata: { provenance: 'subconscious:capture' },
    });
  }
  await store.createNode({ name: 'Canonical target', kind: 'document', scopeIds: [resourceScopeId] });

  const routes = new KnowledgeRoutes({
    auth: fakeRouteAuth(),
    projects: factory.projects,
    knowledge: async () => knowledge,
    accessProfile: async ({ builtInScopes }) => ({
      id: authority,
      rootScopeAddress: builtInScopes.resource.address,
      baselineScopes: [builtInScopes.org, builtInScopes.resource],
      intakeScopes: [
        {
          address: companionAddress,
          parentAddresses: [builtInScopes.resource.address],
          contextualScopeAddress: builtInScopes.resource.address,
        },
      ],
      vouchedScopeAddresses: [builtInScopes.org.address],
      curationScopeAddresses: [companionAddress],
      curatorProfileId: profileId,
    }),
  }).routes();
  const app = createRouteTestApp(routes, { workosId: 'proof-user', organizationId: orgId });

  return {
    app,
    projectId: project.id,
    close: async () => {
      await storage.close();
      fs.rmSync(databasePath, { force: true });
      await factory.storage.close();
    },
  };
}

async function installRoutes(context: BrowserContext, authority: Authority) {
  const harness = await createCurationHarness(authority);
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
      return route.fulfill({ json: { projects: [{ id: harness.projectId, name: 'Curation proof' }] } });
    }
    if (url.pathname.endsWith(`/web/factory/projects/${harness.projectId}`)) {
      return route.fulfill({ json: { project: { id: harness.projectId, name: 'Curation proof' } } });
    }
    if (url.pathname.endsWith('/source-control-connections')) return route.fulfill({ json: { connections: [] } });
    if (url.pathname.includes('/permissions')) return route.fulfill({ json: {} });
    if (url.pathname.endsWith('/work-items')) return route.fulfill({ json: { workItems: [] } });
    if (url.pathname.endsWith('/attention')) return route.fulfill({ json: { items: [] } });
    if (url.pathname.endsWith('/work-records')) return route.fulfill({ json: { workRecords: [] } });
    if (url.pathname.endsWith('/web/github/subscriptions')) return route.fulfill({ json: { subscriptions: [] } });
    return route.continue();
  });
  return harness.projectId;
}

function item(page: Page, name: string) {
  return page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
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

test.describe('Knowledge curation workflow', () => {
  test.describe('when an owner curates independent provisional items', () => {
    test('applies refine, merge, retain, discard, and promote through real routes and LibSQL', async ({
      context,
      page,
    }) => {
      const projectId = await installRoutes(context, 'owner');
      await page.goto(`/factories/${projectId}/knowledge`);
      await page.getByRole('button', { name: /uncurated/ }).click();
      await expect(page.getByRole('heading', { name: 'Needs curation' })).toBeVisible();

      const refine = item(page, 'Refine draft');
      await refine.getByRole('textbox', { name: 'Refined description for Refine draft' }).fill('Verified description');
      await refine.getByRole('button', { name: 'Refine' }).click();

      const merge = item(page, 'Merge draft');
      await merge.getByRole('textbox', { name: 'Find merge target for Merge draft' }).fill('Canonical');
      await merge.getByRole('button', { name: /Canonical target/ }).click();
      await merge.getByRole('button', { name: 'Merge' }).click();
      await expect(page.getByRole('heading', { name: 'Merge draft' })).toHaveCount(0);

      const retain = item(page, 'Retain draft');
      await retain.getByRole('button', { name: 'Retain' }).click();
      await expect(retain.getByText('retained · unintegrated')).toBeVisible();

      await item(page, 'Discard draft').getByRole('button', { name: 'Discard' }).click();
      await expect(page.getByRole('heading', { name: 'Discard draft' })).toHaveCount(0);
      await item(page, 'Promote draft').getByRole('button', { name: 'Promote' }).click();
      await expect(page.getByRole('heading', { name: 'Promote draft' })).toHaveCount(0);

      await recordResult(page, 'owner curation lifecycle', 'curation-owner.png');
    });
  });

  test.describe('when a suggest-only curator requests promotion', () => {
    test('creates a review proposal and opens it in Approvals', async ({ context, page }) => {
      const projectId = await installRoutes(context, 'suggest');
      await page.goto(`/factories/${projectId}/knowledge`);
      await page.getByRole('button', { name: /uncurated/ }).click();
      const suggestion = item(page, 'Suggest promotion draft');
      await suggestion.getByRole('button', { name: 'Promote' }).click();
      await expect(suggestion.getByText('Sent to Approvals for review.')).toBeVisible();
      await suggestion.getByRole('button', { name: 'Open proposal' }).click();
      await expect(page.getByRole('tab', { name: 'approvals' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'promote-node' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Suggest promotion draft' })).toBeVisible();

      await recordResult(page, 'suggest promotion to approvals', 'curation-suggest.png');
    });
  });
});
