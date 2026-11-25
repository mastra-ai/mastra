import { Hono } from 'hono';
import type { Context } from 'hono';

import type { ModelPack } from '../../model-packs.js';
import { createSourceControlSessionLookup } from '../../session/factory-session.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { ConfigRoutes } from '../config.js';
import type { ModelCatalog } from '../config.js';
import type { RouteAuth } from '../route.js';
import { fakeRouteAuth, mountApiRoutes } from '../test-utils.js';

export const ownerPack: ModelPack = {
  id: 'owner-pack',
  name: 'Owner',
  models: [
    { modelId: 'anthropic/claude-opus-4-6', thinkingLevel: 'high' },
    { modelId: 'openai/gpt-5.5', thinkingLevel: 'low' },
  ],
};
export const viewerPack: ModelPack = {
  id: 'viewer-pack',
  name: 'Viewer',
  models: [
    { modelId: 'openai/gpt-5.5', thinkingLevel: 'low' },
    { modelId: 'deepseek/deepseek-flash', thinkingLevel: 'low' },
  ],
};
export const factoryPack: ModelPack = {
  id: 'factory-pack',
  name: 'Factory',
  models: [
    { modelId: 'deepseek/deepseek-flash', thinkingLevel: 'medium' },
    { modelId: 'anthropic/claude-opus-4-6', thinkingLevel: 'medium' },
  ],
};

export type SessionModelApp = Hono<{
  Variables: { factoryAuthUser: { workosId: string; organizationId: string } };
}>;

export const SESSION_ID = '00000000-0000-4000-8000-0000000000a1';

function handlerContextAuth(auth: RouteAuth): RouteAuth {
  const ensured = new WeakSet<Context>();
  return {
    ...auth,
    ensureUser: c => {
      ensured.add(c);
      return auth.ensureUser(c);
    },
    tenant: c => (ensured.has(c) ? auth.tenant(c) : undefined),
  };
}

export async function setupSessionModelRoutes(
  modelScope: 'hybrid' | 'user' | 'factory' = 'hybrid',
  visibility: 'org' | 'private' = 'org',
  getSession?: ModelCatalog['getSession'],
  authEnabled = true,
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
    sessionId: SESSION_ID,
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
  const app: SessionModelApp = new Hono();
  app.use('*', async (c, next) => {
    if (authEnabled) c.set('factoryAuthUser', { workosId: 'viewer', organizationId: orgId });
    await next();
  });
  mountApiRoutes(
    app,
    new ConfigRoutes({
      auth: handlerContextAuth(fakeRouteAuth({ enabled: authEnabled })),
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
