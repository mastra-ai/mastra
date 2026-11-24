import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ModelPack } from '../model-packs.js';
import { createSourceControlSessionLookup } from '../session/factory-session.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { ConfigRoutes } from './config.js';
import type { ModelCatalog } from './config.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ownerPack: ModelPack = {
  id: 'owner-pack',
  name: 'Owner',
  models: [
    { modelId: 'anthropic/claude-opus-4-6', thinkingLevel: 'high' },
    { modelId: 'openai/gpt-5.5', thinkingLevel: 'low' },
  ],
};
const viewerPack: ModelPack = {
  id: 'viewer-pack',
  name: 'Viewer',
  models: [
    { modelId: 'openai/gpt-5.5', thinkingLevel: 'low' },
    { modelId: 'deepseek/deepseek-flash', thinkingLevel: 'low' },
  ],
};
const factoryPack: ModelPack = {
  id: 'factory-pack',
  name: 'Factory',
  models: [
    { modelId: 'deepseek/deepseek-flash', thinkingLevel: 'medium' },
    { modelId: 'anthropic/claude-opus-4-6', thinkingLevel: 'medium' },
  ],
};

async function setup(
  modelScope: 'hybrid' | 'user' | 'factory' = 'hybrid',
  visibility: 'org' | 'private' = 'org',
  getSession?: ModelCatalog['getSession'],
) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({
    orgId: 'org-1',
    userId: 'owner',
    input: { name: 'Billing', modelScope, defaultModelId: 'deepseek/deepseek-flash' },
  });
  const sourceControl = seed.sourceControl.forIntegration('github');
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'owner',
    externalId: '123',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '456', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'owner',
  });
  const projectRepository = await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
  });
  const sourceSession = await sourceControl.sessions.create({
    orgId: 'org-1',
    userId: 'owner',
    factoryProjectId: project.id,
    projectRepositoryId: projectRepository.id,
    sessionId: 'session-1',
    branch: 'test',
    baseBranch: 'main',
    visibility,
  });
  for (const [userId, provider] of [
    ['owner', 'anthropic'],
    ['viewer', 'openai-codex'],
  ] as const) {
    await seed.credentials.setCredential({ orgId: 'org-1', userId }, provider, {
      type: 'api_key',
      key: `${userId}-secret`,
    });
  }
  await seed.credentials.setCredential({ orgId: 'org-1' }, 'deepseek', { type: 'api_key', key: 'org-secret' });
  for (const [userId, pack] of [
    ['owner', ownerPack],
    ['viewer', viewerPack],
  ] as const) {
    await seed.modelDefaults.setModelPacks({ orgId: 'org-1', userId, modelPacks: [pack], defaultModelPackId: pack.id });
  }
  await seed.projects.update({
    orgId: 'org-1',
    id: project.id,
    input: { modelPackSet: { modelPacks: [factoryPack], defaultModelPackId: factoryPack.id } },
  });
  let orgId = 'org-1';
  const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser', { workosId: 'viewer', organizationId: orgId });
    await next();
  });
  mountApiRoutes(
    app,
    new ConfigRoutes({
      auth: fakeRouteAuth(),
      controller: {
        listAvailableModels: async () => [
          { id: 'anthropic/claude-opus-4-6', provider: 'anthropic', modelName: 'Owner', hasApiKey: false },
          { id: 'openai/gpt-5.5', provider: 'openai', modelName: 'Viewer', hasApiKey: false },
          { id: 'deepseek/deepseek-flash', provider: 'deepseek', modelName: 'Factory', hasApiKey: false },
        ],
        getSession,
      },
      modelCredentials: seed.credentials,
      modelDefaults: seed.modelDefaults,
      factoryProjects: seed.projects,
      sourceControlSessions: createSourceControlSessionLookup([sourceControl]),
      workItems: seed.workItems,
    }).routes(),
  );
  const bind = () =>
    seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'owner',
      factoryProjectId: project.id,
      workItem: {
        input: {
          title: 'Task',
          stages: ['intake'],
          sessions: {},
          metadata: {},
          externalSource: { integrationId: 'github', type: 'issue', externalId: '1' },
        },
      },
      role: 'work',
      session: { sessionId: sourceSession.sessionId, branch: sourceSession.branch, threadId: 'run-thread' },
      resourceId: sourceSession.sessionId,
      kickoffKey: 'run-1',
      kickoffMessage: null,
    });
  return {
    app,
    seed,
    project,
    bind,
    setOrgId: (value: string) => {
      orgId = value;
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('session-owner model catalog', () => {
  it.each(['user', 'hybrid'] as const)(
    'uses the owner catalog and default for a collaborator in %s scope',
    async scope => {
      const { app, project } = await setup(scope);
      // The session runs under its Factory's resource; it is found by its session id.
      const response = await app.request(
        `/web/config/models?sessionId=session-1&resourceId=${project.id}&threadId=chat-thread&scope=org&userId=viewer`,
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.modelScope).toBe('user');
      expect(body.defaultModelId).toBe('anthropic/claude-opus-4-6');
      expect(body.personalThinkingLevel).toBe('high');
      expect(body).toMatchObject({ modelPacks: [ownerPack], defaultModelPackId: 'owner-pack', modelPackId: null });
      expect(body).not.toHaveProperty('fallbackModelId');
      expect(body.models).toEqual([
        expect.objectContaining({ id: 'anthropic/claude-opus-4-6', credentialLabel: 'Anthropic API key' }),
      ]);
      expect(JSON.stringify(body)).not.toContain('secret');
    },
  );

  it.each(['active', 'revoked'] as const)(
    'uses only the Factory catalog and default for a hybrid %s work-item thread',
    async status => {
      const { app, seed, project, bind } = await setup();
      await bind();
      if (status === 'revoked')
        await seed.workItems.revokeRunBindingsForWorkItem({
          orgId: 'org-1',
          factoryProjectId: project.id,
          workItemId: (await seed.workItems.findActiveRunBindingByThread({
            orgId: 'org-1',
            resourceId: 'session-1',
            sessionId: 'session-1',
            threadId: 'run-thread',
          }))!.workItemId,
          revokedAt: new Date(),
        });
      const response = await app.request('/web/config/models?resourceId=session-1&threadId=run-thread&scope=user');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.modelScope).toBe('factory');
      expect(body.defaultModelId).toBe('deepseek/deepseek-flash');
      expect(body.personalThinkingLevel).toBeNull();
      expect(body).toMatchObject({ modelPacks: [factoryPack], defaultModelPackId: 'factory-pack' });
      expect(body.models).toEqual([
        expect.objectContaining({ id: 'deepseek/deepseek-flash', credentialLabel: 'Deepseek API key' }),
      ]);
    },
  );

  it('keeps user-scoped work items on the owner catalog', async () => {
    const { app, bind } = await setup('user');
    await bind();
    const response = await app.request('/web/config/models?resourceId=session-1&threadId=run-thread');
    const body = await response.json();
    expect(body.modelScope).toBe('user');
    expect(body.defaultModelId).toBe('anthropic/claude-opus-4-6');
    expect(body.personalThinkingLevel).toBe('high');
    expect(body).toMatchObject({ modelPacks: [ownerPack], defaultModelPackId: 'owner-pack' });
    expect(body.models.map((m: { id: string }) => m.id)).toEqual(['anthropic/claude-opus-4-6']);
  });

  it('denies collaborators on private sessions and foreign organizations', async () => {
    const privateSession = await setup('hybrid', 'private');
    expect(
      (await privateSession.app.request('/web/config/models?resourceId=session-1&threadId=chat-thread')).status,
    ).toBe(403);
    const foreign = await setup();
    foreign.setOrgId('other-org');
    expect((await foreign.app.request('/web/config/models?resourceId=session-1&threadId=chat-thread')).status).toBe(
      403,
    );
  });

  it('rejects incomplete or unavailable session context instead of returning the viewer catalog', async () => {
    const { app } = await setup();
    expect((await app.request('/web/config/models?resourceId=session-1')).status).toBe(400);
    expect((await app.request('/web/config/models?threadId=chat-thread')).status).toBe(400);
    expect((await app.request('/web/config/models?resourceId=missing&threadId=chat-thread')).status).toBe(403);
  });

  it('switches a live session onto one of its owner packs and reports that pack in the catalog', async () => {
    const settings = new Map<string, unknown>();
    const events: unknown[] = [];
    const liveSession = {
      model: {
        get: () => '',
        switch: async (modelId: string, options?: { thinkingLevel?: string }) =>
          void events.push({ switched: modelId, thinkingLevel: options?.thinkingLevel }),
      },
      thread: {
        getId: () => 'chat-thread',
        getById: async ({ threadId }: { threadId: string }) =>
          threadId === 'chat-thread' ? { metadata: Object.fromEntries(settings) } : null,
        setSettingOn: async ({ key, value }: { threadId: string; key: string; value: unknown }) => {
          settings.set(key, value);
          events.push({ setting: key, value });
        },
      },
    };
    const { app } = await setup('user', 'org', async sessionId =>
      sessionId === 'session-1' ? liveSession : undefined,
    );
    const choosePack = (modelPackId: string) =>
      app.request('/web/config/session-model-pack', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'session-1', threadId: 'chat-thread', modelPackId }),
      });

    for (const notTheOwners of ['missing', 'viewer-pack']) {
      const rejected = await choosePack(notTheOwners);
      expect(rejected.status).toBe(404);
      expect(await rejected.json()).toEqual({ error: 'model_pack_not_found' });
    }
    expect(events).toEqual([]);

    const chosen = await choosePack('owner-pack');
    expect(chosen.status).toBe(200);
    expect(await chosen.json()).toEqual({
      ok: true,
      modelPackId: 'owner-pack',
      modelId: 'anthropic/claude-opus-4-6',
      thinkingLevel: 'high',
    });
    expect(events).toEqual([
      { setting: 'factoryModelPackId', value: 'owner-pack' },
      { switched: 'anthropic/claude-opus-4-6', thinkingLevel: 'high' },
    ]);

    const catalog = await (await app.request('/web/config/models?resourceId=session-1&threadId=chat-thread')).json();
    expect(catalog).toMatchObject({
      modelPacks: [ownerPack],
      defaultModelPackId: 'owner-pack',
      modelPackId: 'owner-pack',
    });
  });

  it('does not choose a pack for a session that is not running', async () => {
    const { app } = await setup('user');
    const response = await app.request('/web/config/session-model-pack', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resourceId: 'session-1', threadId: 'chat-thread', modelPackId: 'owner-pack' }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'session_not_running' });
  });
});
