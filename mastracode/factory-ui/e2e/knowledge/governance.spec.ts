import { Knowledge } from '@mastra/core/knowledge';
import { expect, test, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { KnowledgeRoutes } from '../../../factory/src/routes/knowledge.js';
import { createRouteTestApp, fakeRouteAuth } from '../../../factory/src/routes/test-utils.js';
import { createFactoryStorageForTests, LibSQLStore } from '../../../factory/src/storage/test-utils.js';

const orgId = 'governance-proof-org';
const output = process.env.KNOWLEDGE_PROOF_OUTPUT ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT) : undefined;
const proofResults = new Map<string, string>();
const expectedProofTests = 3;

type Perspective = 'reader' | 'suggester' | 'reviewer';

async function createGovernanceHarness(perspective: Perspective) {
  const factory = await createFactoryStorageForTests({ autoClose: false });
  const project = await factory.projects.create({
    orgId,
    userId: 'user-1',
    input: { name: 'Governance proof' },
  });
  const knowledgeDbPath = path.join(tmpdir(), `knowledge-governance-${perspective}-${randomUUID()}.db`);
  const knowledgeStorage = new LibSQLStore({ id: `knowledge-${perspective}`, url: `file:${knowledgeDbPath}` });
  const knowledge = new Knowledge({ id: 'mastra', storage: knowledgeStorage });
  const store = await knowledge.getStorageInternal();
  await store.init();
  const orgAddress = `org:${orgId}`;
  const resourceAddress = `resource:${project.id}`;
  const org = await knowledge.materializeScope({ address: orgAddress, contextualScopeAddress: orgAddress });
  const orgScopeId = org.scopes[orgAddress]!;
  const resource = await knowledge.materializeScope({
    address: resourceAddress,
    parentAddresses: [orgAddress],
    contextualScopeAddress: orgAddress,
  });
  const resourceScopeId = resource.scopes[resourceAddress]!;
  await store.upsertScopeGrant({
    scopeNodeId: resourceScopeId,
    scopeRefId: orgScopeId,
    role: 'owner',
    canSuggest: true,
  });

  const proposerContext = await store.createNode({ name: 'Private proposer', isScope: true, scopeIds: [] });
  const pendingNode = await store.createNode({
    name: 'Deployment guide',
    kind: 'document',
    scopeIds: [resourceScopeId],
  });
  await knowledge.proposeNodeUpdate({
    mutation: { id: pendingNode.id, version: pendingNode.version, name: 'Deployment handbook' },
    proposerContextScopeId: proposerContext.id,
    vouchedScopeIds: [orgScopeId, proposerContext.id],
    reason: 'Rename the deployment guide',
  });

  const conflictedNode = await store.createNode({
    name: 'Incident guide',
    kind: 'document',
    scopeIds: [resourceScopeId],
  });
  const conflicted = await knowledge.proposeNodeUpdate({
    mutation: { id: conflictedNode.id, version: conflictedNode.version, name: 'Incident handbook' },
    proposerContextScopeId: proposerContext.id,
    vouchedScopeIds: [orgScopeId, proposerContext.id],
    reason: 'Refresh the incident guide',
  });
  await knowledge.updateNode({
    id: conflictedNode.id,
    version: conflictedNode.version,
    name: 'Concurrent incident guide',
    vouchedScopeIds: [orgScopeId, proposerContext.id],
  });
  await knowledge
    .approveProposal({
      id: conflicted.id,
      reviewerContextScopeId: orgScopeId,
      vouchedScopeIds: [orgScopeId, proposerContext.id],
    })
    .catch(() => undefined);
  await store.removeScopeGrant({
    scopeNodeId: resourceScopeId,
    scopeRefId: orgScopeId,
    expectedAccessEpoch: await store.getAccessEpoch(),
  });

  const intakeAddress = `thread:${perspective}`;
  const intake = await knowledge.materializeScope({
    address: intakeAddress,
    parentAddresses: [resourceAddress],
    contextualScopeAddress: resourceAddress,
  });
  await store.upsertScopeGrant({
    scopeNodeId: resourceScopeId,
    scopeRefId: intake.scopes[intakeAddress]!,
    role: perspective === 'reviewer' ? 'owner' : 'readonly',
    canSuggest: perspective !== 'reader',
  });
  const routes = new KnowledgeRoutes({
    auth: fakeRouteAuth({ isOrganizationAdmin: async () => perspective === 'reviewer' }),
    projects: factory.projects,
    knowledge: async () => knowledge,
    accessProfile: async ({ builtInScopes }) => ({
      id: perspective,
      rootScopeAddress: builtInScopes.resource.address,
      baselineScopes: [builtInScopes.org, builtInScopes.resource],
      intakeScopes: [
        {
          address: `thread:${perspective}`,
          parentAddresses: [builtInScopes.resource.address],
          contextualScopeAddress: builtInScopes.resource.address,
        },
      ],
    }),
  }).routes();
  const app = createRouteTestApp(routes, {
    workosId: `${perspective}-user`,
    organizationId: orgId,
  });

  return {
    app,
    projectId: project.id,
    close: async () => {
      await knowledgeStorage.close();
      fs.rmSync(knowledgeDbPath, { force: true });
      await factory.storage.close();
    },
  };
}

async function installRoutes(context: BrowserContext, perspective: Perspective) {
  const harness = await createGovernanceHarness(perspective);
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
      return route.fulfill({
        json: { authenticated: true, authEnabled: true, user: { userId: `${perspective}-user` } },
      });
    }
    if (url.pathname.endsWith('/web/config/features')) return route.fulfill({ json: { knowledge: true } });
    if (url.pathname.endsWith('/web/factory/projects')) {
      return route.fulfill({ json: { projects: [{ id: harness.projectId, name: 'Governance proof' }] } });
    }
    if (url.pathname.endsWith(`/web/factory/projects/${harness.projectId}`)) {
      return route.fulfill({ json: { project: { id: harness.projectId, name: 'Governance proof' } } });
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

async function openApprovals(context: BrowserContext, perspective: Perspective) {
  const projectId = await installRoutes(context, perspective);
  const page = await context.newPage();
  await page.goto(`/factories/${projectId}/knowledge?view=approvals`);
  return page;
}

async function capture(page: Awaited<ReturnType<typeof openApprovals>>, perspective: Perspective) {
  if (!output) return;
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, `${perspective}.png`), fullPage: true });
}

test.describe('Knowledge governance perspectives', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('when the host vouches only readonly access', () => {
    test('shows proposals without mutation actions', async ({ context }) => {
      const page = await openApprovals(context, 'reader');
      await expect(page.getByText('Rename the deployment guide')).toBeVisible();
      await expect(page.getByText('Proposer: private')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
      await capture(page, 'reader');
    });
  });

  test.describe('when the host vouches suggest access without edit authority', () => {
    test('keeps review actions unavailable', async ({ context }) => {
      const page = await openApprovals(context, 'suggester');
      await expect(page.getByText('Rename the deployment guide')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
      await capture(page, 'suggester');
    });
  });

  test.describe('when the host vouches owner authority', () => {
    test('persists rejection and conflict re-review through Factory routes', async ({ context }) => {
      const page = await openApprovals(context, 'reviewer');
      await page.getByRole('button', { name: 'Reject' }).click();
      await expect(page.getByText('No pending proposals.')).toBeVisible();

      await page.getByLabel('Proposal status').click();
      await page.getByRole('option', { name: 'Conflicted' }).click();
      await expect(page.getByText('Refresh the incident guide')).toBeVisible();
      await page.getByRole('button', { name: 'Create replacement for re-review' }).click();
      await page.getByLabel('Proposal status').click();
      await page.getByRole('option', { name: 'Pending' }).click();
      await expect(page.getByText('Refresh the incident guide')).toBeVisible();
      await capture(page, 'reviewer');
    });
  });

  test.afterEach(({}, testInfo) => {
    proofResults.set(testInfo.titlePath.join(' > '), testInfo.status);
  });

  test.afterAll(() => {
    if (!output) return;
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify(
        {
          expectedTests: expectedProofTests,
          observedTests: proofResults.size,
          complete: proofResults.size === expectedProofTests,
          tests: Array.from(proofResults, ([title, status]) => ({ title, status })),
        },
        null,
        2,
      ),
    );
  });
});
