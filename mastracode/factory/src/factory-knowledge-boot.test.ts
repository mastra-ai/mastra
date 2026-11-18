import { Mastra } from '@mastra/core';
import { encodeKnowledgeScopeId, Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { Hono } from 'hono';
import { expect, it, onTestFinished, vi } from 'vitest';

import { MastraFactory } from './factory.js';
import { mountApiRoutes } from './routes/test-utils.js';
import { createFactorySecretEncryption } from './secret-encryption.js';

vi.setConfig({ testTimeout: 30_000 });

it("boots with a bare Knowledge instance and serves the Knowledge page from that instance's storage", async () => {
  vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  const storage = new LibSQLFactoryStorage({ id: 'knowledge-boot', url: ':memory:' });
  const knowledgeStorage = new InMemoryStore();
  const knowledge = new Knowledge({
    id: 'shared',
    storage: knowledgeStorage,
    scopes: {
      'org:$orgId': { access: [{ principal: 'self', role: 'editor' }] },
      'project:$projectId': { access: [{ principal: 'self', role: 'editor' }], belongsTo: 'org:$orgId' },
    },
  });
  const factory = new MastraFactory({
    storage,
    auth: null,
    mcp: false,
    knowledge,
    secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
  });
  onTestFinished(async () => {
    await factory.shutdown();
    await storage.close();
  });
  const mastra = new Mastra(await factory.prepare());
  expect(mastra.getKnowledge('shared')).toBe(knowledge);
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
    await next();
  });
  for (const m of [mastra.getServer()?.middleware ?? []].flat()) {
    const entry = typeof m === 'function' ? { path: '*', handler: m } : m;
    app.use(entry.path, entry.handler as never);
  }
  mountApiRoutes(app as never, mastra.getServer()?.apiRoutes ?? []);
  const created = await app.request('/web/factory/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'P' }),
  });
  expect(created.status).toBe(201);
  const { project } = (await created.json()) as { project: { id: string } };

  // Seeded straight into the configured storage: the page can only show it by reading that store.
  const store = (await knowledgeStorage.getStore('knowledge'))!;
  const provenance = { author: 'host' };
  const org = (
    await store.materializeScope({
      address: `org:${encodeKnowledgeScopeId('org-1')}`,
      declaration: 'org:$orgId',
      name: 'Org',
      provenance,
    })
  ).scope;
  await store.createPage({ parentId: org.id, name: 'Handbook', provenance });

  const tree = await app.request(`/web/factory/projects/${project.id}/knowledge/tree?parentId=${org.id}`);
  expect(tree.status).toBe(200);
  expect(((await tree.json()) as { pages: { name: string }[] }).pages.map(page => page.name)).toEqual(['Handbook']);
});

it("acts with the host's org scope alone in sessions and on the Knowledge page, against an instance that declares only that org", async () => {
  vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  const storage = new LibSQLFactoryStorage({ id: 'knowledge-org-scope', url: ':memory:' });
  const knowledgeStorage = new InMemoryStore();
  const knowledge = new Knowledge({
    id: 'org-only',
    storage: knowledgeStorage,
    scopes: { ...knowledgeMemoryScopes(), 'org:$orgId': { access: [{ principal: 'self', role: 'editor' }] } },
  });
  const factory = new MastraFactory({
    storage,
    auth: null,
    mcp: false,
    knowledge,
    scopes: ['org:plat'],
    secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
  });
  onTestFinished(async () => {
    await factory.shutdown();
    await storage.close();
  });
  const mastra = new Mastra(await factory.prepare());

  // A session's run scopes, from the code agent the Factory mounted.
  const controller = Object.values(mastra.listAgentControllers())[0]!;
  const session = await controller.createSession({ resourceId: 'user-1', createInitialThread: false });
  const requestContext = new RequestContext();
  requestContext.set('controller', { state: { factoryOrgId: 'org-1', factoryProjectId: 'p1' } });
  const runScopes = await controller.getCurrentAgent(session).getScopes({ requestContext });
  expect(runScopes).toEqual(['org:plat']);
  await expect(knowledge.readScopeFor(runScopes)).resolves.toBeDefined();

  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
    await next();
  });
  for (const m of [mastra.getServer()?.middleware ?? []].flat()) {
    const entry = typeof m === 'function' ? { path: '*', handler: m } : m;
    app.use(entry.path, entry.handler as never);
  }
  mountApiRoutes(app as never, mastra.getServer()?.apiRoutes ?? []);
  const created = await app.request('/web/factory/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'P' }),
  });
  const { project } = (await created.json()) as { project: { id: string } };

  const store = (await knowledgeStorage.getStore('knowledge'))!;
  const provenance = { author: 'host' };
  const org = (
    await store.materializeScope({ address: 'org:plat', declaration: 'org:$orgId', name: 'Org', provenance })
  ).scope;
  await store.createPage({ parentId: org.id, name: 'Handbook', provenance });

  const tree = await app.request(`/web/factory/projects/${project.id}/knowledge/tree?parentId=${org.id}`);
  expect(tree.status).toBe(200);
  expect(((await tree.json()) as { pages: { name: string }[] }).pages.map(page => page.name)).toEqual(['Handbook']);
});

it.each(['project:p1', 'resource:u1', 'thread:t1'])('refuses %s beside an org: in scopes', scope => {
  expect(
    () =>
      new MastraFactory({
        storage: new LibSQLFactoryStorage({ id: 'knowledge-org-scope-bad', url: ':memory:' }),
        auth: null,
        mcp: false,
        scopes: ['org:plat', scope],
        secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
      }),
  ).toThrow(`MastraFactory: 'scopes': Scope ${scope} can't be held with the host's org:plat.`);
});
