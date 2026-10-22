import type { AgentControllerEvent, PermissionRules } from '@mastra/core/agent-controller';
import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import type { SendNotificationSignalInput } from '@mastra/core/notifications';
import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import { fakeRouteAuth } from '../routes/test-utils.js';
import { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import { resolveFactoryCredentialTenant } from '../session/credential-policy.js';
import { createSourceControlSessionLookup } from '../session/factory-session.js';
import {
  FACTORY_OPEN_RUN_STALE_MS,
  FACTORY_OPEN_RUNS_SETTING,
  isOpenRunLiveElsewhere,
  listSessionOpenRuns,
} from '../session/run-audit.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import type { SourceControlSessionVisibility } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { deliverFactorySessionNotification } from './deliver.js';
import { FACTORY_TOOLS_WITHOUT_APPROVAL, applyFactoryToolPermissions } from './permissions.js';
import { createSessionRunEndReporter } from './reports.js';
import { observeSessionRunReports } from './run-watch.js';
import { FACTORY_INTERACTIVE_KEY, resolveFactoryToolScope } from './scope.js';
import type { FactoryToolScope } from './scope.js';
import { FACTORY_TOOLS_OWNER_ID, createFactorySessionTools } from './session-tools.js';
import { createFactoryTools } from './index.js';
import type { FactoryToolDependencies } from './index.js';

vi.mock('../routes/tenant-credentials.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../routes/tenant-credentials.js')>()),
  primeTenantCredentialsForTenant: vi.fn(async () => undefined),
}));

const prime = vi.mocked(primeTenantCredentialsForTenant);

async function seedFactory(parentVisibility: SourceControlSessionVisibility = 'org') {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const created = await seed.projects.create({ orgId: 'org-1', userId: 'owner', input: { name: 'Mastra' } });
  // Personal credentials, so billing the wrong person would show up as a different tenant.
  const project = (await seed.projects.update({ orgId: 'org-1', id: created.id, input: { modelScope: 'user' } }))!;
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'owner',
    externalId: '1',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '2', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
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
    createdByUserId: 'owner',
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox/mastra',
  });
  await sourceControl.sessions.create({
    sessionId: 'parent-session',
    projectRepositoryId: projectRepository.id,
    factoryProjectId: project.id,
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'user/session-parent-session',
    baseBranch: 'main',
    visibility: parentVisibility,
  });
  const sessions = createSourceControlSessionLookup([sourceControl]);
  const scope: FactoryToolScope = {
    orgId: 'org-1',
    factoryProjectId: project.id,
    userId: 'user-1',
    sessionId: 'parent-session',
    resourceId: 'parent-session',
    threadId: 'parent-thread',
    kind: 'user',
    interactive: true,
  };
  return { seed, project, sessions, scope, sourceControl, connection, projectRepository, installation };
}

function fakeController(calls: string[], onSessionCreated: (session: FakeSession) => void = () => {}) {
  const created: Array<{ options: Record<string, unknown>; session: ReturnType<typeof fakeSession> }> = [];
  const storedThreads = new Map<string, { resourceId: string; metadata: Record<string, unknown>; updatedAt: Date }>();
  const liveModels = new Map<string, string>();
  function fakeSession(id: string) {
    let state: Record<string, unknown> = {};
    const settings = new Map<string, unknown>();
    const listeners = new Set<(event: AgentControllerEvent) => void>();
    return {
      identity: { getId: () => id, getResourceId: () => id },
      emit: (event: AgentControllerEvent) => listeners.forEach(listener => listener(event)),
      listenerCount: () => listeners.size,
      subscribe: (listener: (event: AgentControllerEvent) => void) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
      permissions: { setForTool: vi.fn(async () => undefined) },
      state: {
        get: () => state,
        set: vi.fn(async (patch: Record<string, unknown>) => {
          state = { ...state, ...patch };
        }),
      },
      mode: { resolve: () => ({ defaultModelId: 'openai/gpt-5.5' }) },
      model: {
        get: () => liveModels.get(id),
        switch: vi.fn(async (modelId: string) => {
          liveModels.set(id, modelId);
        }),
      },
      stream: { isActive: vi.fn(() => true) },
      subagents: { model: { set: vi.fn(async () => undefined) } },
      thread: {
        requireId: () => id,
        getId: () => id,
        rename: vi.fn(async () => undefined),
        getSetting: async ({ key }: { key: string }) => settings.get(key),
        setSetting: vi.fn(async ({ key, value }: { key: string; value: unknown }) => void settings.set(key, value)),
        setSettingOn: vi.fn(async ({ threadId, key, value }: { threadId: string; key: string; value: unknown }) => {
          if (threadId !== id) throw new Error('Wrong thread');
          settings.set(key, value);
        }),
      },
      sendSignal: vi.fn((_input: unknown, _options: { requestContext: RequestContext }) => {
        calls.push('kickoff');
        return { accepted: Promise.resolve({ accepted: true as const, runId: 'run-1' }) };
      }),
    };
  }
  const controller = {
    queryThreadById: vi.fn(async ({ threadId }: { threadId: string }) => {
      const thread = storedThreads.get(threadId);
      return thread ? { id: threadId, ...thread } : null;
    }),
    createSession: vi.fn(async (options: Record<string, unknown>) => {
      const session = fakeSession(options.threadId as string);
      created.push({ options, session });
      storedThreads.set(options.threadId as string, {
        resourceId: options.resourceId as string,
        metadata: {},
        updatedAt: new Date(),
      });
      onSessionCreated(session);
      return session;
    }),
    getSession: vi.fn(async (resourceId: string) => {
      if (resourceId === 'parent-session') {
        return {
          model: { get: () => liveModels.get('parent-session') },
          thread: { getId: () => 'parent-thread' },
          stream: { isActive: () => false },
        };
      }
      return created.find(entry => (entry.options.id ?? entry.options.resourceId) === resourceId)?.session ?? null;
    }),
    queryThreads: vi.fn(async ({ resourceId }: { resourceId: string }) =>
      [...storedThreads.entries()]
        .filter(([, thread]) => thread.resourceId === resourceId)
        .map(([id, thread]) => ({ id, ...thread })),
    ),
    listAvailableModels: vi.fn(async () => [
      { id: 'openai/gpt-5.6', provider: 'openai', modelName: 'gpt-5.6', hasApiKey: true },
      { id: 'openai/gpt-6.1-sol', provider: 'openai', modelName: 'gpt-6.1-sol', hasApiKey: true },
      { id: 'anthropic/claude-opus-4-1', provider: 'anthropic', modelName: 'claude-opus-4-1', hasApiKey: false },
    ]),
    setThreadModel: vi.fn(
      async ({ resourceId, threadId, modelId }: { resourceId: string; threadId: string; modelId: string }) => {
        const thread = storedThreads.get(threadId);
        if (!thread || thread.resourceId !== resourceId) throw new Error('Thread not found for session.');
        // Like the controller: the live session on this resource that has this thread open.
        const entry = created.find(
          candidate => candidate.options.resourceId === resourceId && candidate.session.thread.getId() === threadId,
        );
        const live = entry ? ((await controller.getSession(entry.options.id as string)) as FakeSession | null) : null;
        if (live) {
          await live.model.switch(modelId);
          return { live: true };
        }
        thread.metadata.currentModelId = modelId;
        return { live: false };
      },
    ),
  };
  return { controller, created, liveModels };
}

type FakeSession = Awaited<ReturnType<ReturnType<typeof fakeController>['controller']['createSession']>>;
type Prepare = FactoryStartCoordinator['prepare'];

async function setup(
  parentVisibility: SourceControlSessionVisibility = 'org',
  {
    coordinator: coordinatorOption = 'real',
    wrapPrepare,
    deploymentProviders,
    tenantCredentials = false,
    interactive = true,
  }: {
    /** False for a turn nobody signed in started: a notification wake, webhook, or rule notice. */
    interactive?: boolean;
    coordinator?: 'real' | 'none';
    wrapPrepare?: (prepare: Prepare) => Prepare;
    /** Deployed mode: model switches check the target session's stored credentials. */
    tenantCredentials?: boolean;
    deploymentProviders?: ReadonlySet<string>;
  } = {},
) {
  const seeded = await seedFactory(parentVisibility);
  const calls: string[] = [];
  prime.mockImplementation(async () => void calls.push('prime'));
  // Every session gets the run-report listener, as the Factory's session-created hook attaches it.
  const { controller, created, liveModels } = fakeController(calls, session =>
    observeSessionRunReports(session, (outcome, since) =>
      reportSessionRunEnd({
        sessionId: session.identity.getResourceId(),
        threadId: session.thread.getId(),
        outcome,
        since,
      }),
    ),
  );
  const transition = vi.fn(async () => {
    throw new Error('a work-item start must not commit a transition');
  });
  const realCoordinator = new FactoryStartCoordinator(
    controller as never,
    seeded.seed.workItems,
    { transition },
    seeded.sourceControl,
    undefined,
    { projects: seeded.seed.projects, modelDefaults: seeded.seed.modelDefaults },
  );
  const realPrepare: Prepare = request => realCoordinator.prepare(request);
  const prepare = vi.fn<Prepare>(wrapPrepare ? wrapPrepare(realPrepare) : realPrepare);
  const audit = new AuditDomain({ auth: fakeRouteAuth(), audit: seeded.seed.audit, projects: seeded.seed.projects });
  // Reports land through the real delivery helper into a real notifications store; every session is live.
  const notifications = new InMemoryNotificationsStorage();
  const reports: Array<{ input: SendNotificationSignalInput; target: { resourceId: string; threadId: string } }> = [];
  const threadOwner = (threadId: string) => (threadId === seeded.scope.threadId ? seeded.scope.sessionId : threadId);
  const deliveryController = {
    ...controller,
    queryThreadById: async ({ threadId }: { threadId: string }) =>
      (await controller.queryThreadById({ threadId })) ?? { id: threadId, resourceId: threadOwner(threadId) },
    // Sessions this test created are themselves; anything else (the parent) is a live stub.
    // The stub still reports the parent model the test set, so inheritance can see it.
    getSession: async (resourceId: string) =>
      (await controller.getSession(resourceId)) ?? {
        model: { get: () => liveModels.get(resourceId) },
        thread: { getId: () => (resourceId === seeded.scope.sessionId ? seeded.scope.threadId : resourceId) },
        stream: { isActive: () => false },
      },
    getCurrentAgent: () => ({
      sendNotificationSignal: async (
        input: SendNotificationSignalInput,
        target: { resourceId: string; threadId: string },
      ) => {
        reports.push({ input, target });
        const record = await notifications.createNotification({ ...input, ...target });
        return { record, decision: { action: 'deliver' }, persisted: Promise.resolve() };
      },
    }),
  };
  const reportSessionRunEnd = createSessionRunEndReporter({
    sessions: seeded.sessions,
    workItems: seeded.seed.workItems,
    reporting: async () => ({
      notifications,
      deliver: (target, notification, options) =>
        deliverFactorySessionNotification({
          controller: deliveryController as never,
          sessions: seeded.sessions,
          runs: seeded.seed.workItems,
          target,
          notification,
          ...options,
        }),
    }),
  });
  const deps = {
    sessions: seeded.sessions,
    sessionModel: {
      projects: seeded.seed.projects,
      modelDefaults: seeded.seed.modelDefaults,
      ...(tenantCredentials
        ? {
            tenantCatalog: {
              credentials: seeded.seed.credentials,
              customProviders: seeded.seed.customProviders,
              deploymentProviders,
            },
          }
        : {}),
    },
    messaging: async () => ({ controller: deliveryController, notifications }) as never,
    workItems: seeded.seed.workItems,
    boards: createBoardRegistry(),
    auditRecorder: audit,
    startCoordinator: () => (coordinatorOption === 'none' ? undefined : { prepare }),
  };
  const toolsFor = (scope: FactoryToolScope) => {
    const tools = createFactorySessionTools(scope, deps);
    const run = (name: string) => (input: Record<string, unknown>) =>
      (tools[name] as unknown as { execute: (input: unknown, context: unknown) => Promise<unknown> }).execute(
        input,
        {},
      );
    return {
      tool: tools.factory_start_session!,
      start: run('factory_start_session'),
      switchModel: run('factory_switch_session_model'),
    };
  };
  const scope = { ...seeded.scope, interactive };
  const { tool, start, switchModel } = toolsFor(scope);
  return {
    ...seeded,
    scope,
    deps,
    toolsFor,
    calls,
    controller,
    created,
    liveModels,
    start,
    switchModel,
    tool,
    prepare,
    transition,
    notifications,
    reports,
  };
}

beforeEach(() => {
  prime.mockReset();
});

describe('factory_switch_session_model', () => {
  it('lets an agent inspect the available models before choosing an exact ID from the user’s intent', async () => {
    const env = await setup();
    const started = (await env.start({ prompt: 'Investigate the build.' })) as { sessionId: string };

    await expect(env.switchModel({ sessionId: started.sessionId })).resolves.toEqual({
      sessionId: started.sessionId,
      models: ['openai/gpt-5.6', 'openai/gpt-6.1-sol'],
    });
    expect(env.controller.setThreadModel).not.toHaveBeenCalled();

    await expect(
      env.switchModel({ sessionId: started.sessionId, modelId: 'openai/gpt-6.1-sol' }),
    ).resolves.toMatchObject({
      modelId: 'openai/gpt-6.1-sol',
      live: true,
    });
  });

  it('switches a running session immediately, a stopped one for its next run, and rejects unavailable models or other users', async () => {
    const env = await setup();
    const started = (await env.start({ prompt: 'Investigate the build.' })) as { sessionId: string };
    const live = env.created[0]!.session;
    vi.mocked(live.model.switch).mockClear();

    await expect(env.switchModel({ sessionId: started.sessionId, modelId: 'openai/gpt-5.6' })).resolves.toEqual({
      sessionId: started.sessionId,
      threadId: started.sessionId,
      modelId: 'openai/gpt-5.6',
      live: true,
    });
    expect(live.model.switch).toHaveBeenCalledWith('openai/gpt-5.6');
    expect(env.created).toHaveLength(1);

    env.controller.getSession.mockResolvedValue(null);
    await expect(env.switchModel({ sessionId: started.sessionId, modelId: 'openai/gpt-6.1-sol' })).resolves.toEqual({
      sessionId: started.sessionId,
      threadId: started.sessionId,
      modelId: 'openai/gpt-6.1-sol',
      live: false,
    });
    expect(live.model.switch).toHaveBeenCalledTimes(1);
    expect(env.created).toHaveLength(1);

    await expect(
      env.switchModel({ sessionId: started.sessionId, modelId: 'anthropic/claude-opus-4-1' }),
    ).rejects.toThrow(
      "Model anthropic/claude-opus-4-1 exists, but this session's credential scope (server) has no credential for its provider. Models available to it: openai/gpt-5.6, openai/gpt-6.1-sol.",
    );
    await expect(env.switchModel({ sessionId: started.sessionId, modelId: 'made-up/model' })).rejects.toThrow(
      'Unknown model made-up/model. Models available to it: openai/gpt-5.6, openai/gpt-6.1-sol.',
    );
    expect(env.controller.setThreadModel).toHaveBeenCalledTimes(2);

    await env.sourceControl.sessions.create({
      sessionId: 'other-user-session',
      projectRepositoryId: env.projectRepository.id,
      factoryProjectId: env.scope.factoryProjectId,
      orgId: env.scope.orgId,
      userId: 'someone-else',
      branch: 'user/session-other-user-session',
      baseBranch: 'main',
      visibility: 'org',
    });
    env.controller.listAvailableModels.mockClear();
    await expect(env.switchModel({ sessionId: 'other-user-session' })).rejects.toThrow('not owned by you');
    await expect(env.switchModel({ sessionId: 'missing' })).rejects.toThrow('not found');
    expect(env.controller.listAvailableModels).not.toHaveBeenCalled();
    expect(env.controller.setThreadModel).toHaveBeenCalledTimes(2);
  });
});

describe('factory_switch_session_model with stored credentials', () => {
  // The server holds only Bedrock credentials; Anthropic and DeepSeek access comes from stored rows.
  const serverModels = [
    { id: 'anthropic/claude-opus-5-5', provider: 'anthropic', modelName: 'claude-opus-5-5', hasApiKey: false },
    { id: 'deepseek/deepseek-flash', provider: 'deepseek', modelName: 'deepseek-flash', hasApiKey: false },
    { id: 'amazon-bedrock/claude-sonnet', provider: 'amazon-bedrock', modelName: 'claude-sonnet', hasApiKey: true },
  ];

  async function tenantSetup(modelScope: 'user' | 'factory' | 'hybrid', deploymentProviders?: ReadonlySet<string>) {
    const env = await setup('org', { tenantCredentials: true, deploymentProviders });
    env.controller.listAvailableModels.mockResolvedValue(serverModels);
    await env.seed.projects.update({ orgId: 'org-1', id: env.project.id, input: { modelScope } });
    // The session owner's personal Anthropic key, the Factory's DeepSeek key, and someone else's personal key.
    await env.seed.credentials.setCredential({ orgId: 'org-1', userId: 'user-1' }, 'anthropic', {
      type: 'api_key',
      key: 'user-secret',
    });
    await env.seed.credentials.setCredential({ orgId: 'org-1' }, 'deepseek', { type: 'api_key', key: 'org-secret' });
    const started = (await env.start({ prompt: 'Investigate the build.' })) as { sessionId: string };
    return { ...env, sessionId: started.sessionId };
  }

  it('lets a user-scoped session switch to a model its owner holds a credential for, and nothing else', async () => {
    const env = await tenantSetup('user');

    await expect(env.switchModel({ sessionId: env.sessionId })).resolves.toEqual({
      sessionId: env.sessionId,
      models: ['anthropic/claude-opus-5-5'],
    });
    expect(env.controller.setThreadModel).not.toHaveBeenCalled();

    await expect(env.switchModel({ sessionId: env.sessionId, modelId: 'anthropic/claude-opus-5-5' })).resolves.toEqual({
      sessionId: env.sessionId,
      threadId: env.sessionId,
      modelId: 'anthropic/claude-opus-5-5',
      live: true,
    });
    expect(env.created[0]!.session.model.switch).toHaveBeenCalledWith('anthropic/claude-opus-5-5');

    // The Factory's org credential belongs to the other scope.
    await expect(env.switchModel({ sessionId: env.sessionId, modelId: 'deepseek/deepseek-flash' })).rejects.toThrow(
      "Model deepseek/deepseek-flash exists, but this session's credential scope (session owner) has no credential for its provider. Models available to it: anthropic/claude-opus-5-5.",
    );
    // A server key alone does not open a deployment provider the operator never opted in to.
    await expect(
      env.switchModel({ sessionId: env.sessionId, modelId: 'amazon-bedrock/claude-sonnet' }),
    ).rejects.toThrow('exists, but');
    await expect(env.switchModel({ sessionId: env.sessionId, modelId: 'anthropic/claude-made-up' })).rejects.toThrow(
      'Unknown model anthropic/claude-made-up. Models available to it: anthropic/claude-opus-5-5.',
    );
    expect(env.controller.setThreadModel).toHaveBeenCalledTimes(1);
  });

  it('lets a Factory-scoped session use the Factory credentials and its custom providers, not the owner credentials', async () => {
    const env = await tenantSetup('factory');
    await env.seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'owner',
      input: { providerId: 'acme', name: 'Acme', url: 'https://llm.acme.test/v1', apiKey: 'acme', models: ['acme-1'] },
    });
    env.controller.getSession.mockResolvedValue(null);

    await expect(env.switchModel({ sessionId: env.sessionId })).resolves.toEqual({
      sessionId: env.sessionId,
      models: ['acme/acme-1', 'deepseek/deepseek-flash'],
    });
    expect(env.controller.setThreadModel).not.toHaveBeenCalled();

    await expect(
      env.switchModel({ sessionId: env.sessionId, modelId: 'deepseek/deepseek-flash' }),
    ).resolves.toMatchObject({ modelId: 'deepseek/deepseek-flash', live: false });
    await expect(env.switchModel({ sessionId: env.sessionId, modelId: 'acme/acme-1' })).resolves.toMatchObject({
      modelId: 'acme/acme-1',
    });
    await expect(env.switchModel({ sessionId: env.sessionId, modelId: 'anthropic/claude-opus-5-5' })).rejects.toThrow(
      "Model anthropic/claude-opus-5-5 exists, but this session's credential scope (Factory) has no credential for its provider. Models available to it: acme/acme-1, deepseek/deepseek-flash.",
    );
  });

  it('resolves the credential scope from the target session, not from a calling work-item run', async () => {
    const env = await tenantSetup('hybrid');
    // The caller is a work-item run, which a hybrid Factory bills to the Factory credentials.
    await env.seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: env.project.id,
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
      session: { sessionId: env.scope.sessionId, branch: 'user/session-parent-session', threadId: env.scope.threadId },
      resourceId: env.scope.sessionId,
      kickoffKey: 'run-1',
      kickoffMessage: null,
    });

    // The target is an unbound side session, so it runs on its owner credentials.
    await expect(
      env.switchModel({ sessionId: env.sessionId, modelId: 'anthropic/claude-opus-5-5' }),
    ).resolves.toMatchObject({
      modelId: 'anthropic/claude-opus-5-5',
    });
    await expect(env.switchModel({ sessionId: env.sessionId, modelId: 'deepseek/deepseek-flash' })).rejects.toThrow(
      "this session's credential scope (session owner) has no credential for its provider",
    );
  });

  it('opens a deployment provider only when the operator opted in and the server holds its credentials', async () => {
    const env = await tenantSetup('user', new Set(['amazon-bedrock']));

    await expect(
      env.switchModel({ sessionId: env.sessionId, modelId: 'amazon-bedrock/claude-sonnet' }),
    ).resolves.toMatchObject({ modelId: 'amazon-bedrock/claude-sonnet' });
  });
});

describe('factory_start_session in side mode', () => {
  it('files a session for the caller with the origin set, and kicks it off with the prompt', async () => {
    const { start, sessions, created, scope } = await setup();

    const result = (await start({ prompt: 'Find why the nightly build is slow.\nCheck the cache.' })) as {
      mode: string;
      sessionId: string;
      threadId: string;
      title: string;
    };

    expect(result).toMatchObject({ mode: 'side', title: 'Find why the nightly build is slow.' });
    await expect(sessions.getBySessionId(result.sessionId)).resolves.toMatchObject({
      userId: 'user-1',
      visibility: 'org',
      originSessionId: 'parent-session',
      originThreadId: 'parent-thread',
      branch: `user/session-${result.sessionId}`,
      factoryProjectId: scope.factoryProjectId,
    });
    expect(created).toHaveLength(1);
    expect(created[0]!.options).toMatchObject({
      id: result.sessionId,
      ownerId: 'user-1',
      // A side session shares its Factory's memory resource.
      resourceId: scope.factoryProjectId,
      threadId: result.sessionId,
    });
    const session = created[0]!.session;
    expect(session.thread.rename).toHaveBeenCalledWith({ title: 'Find why the nightly build is slow.', pin: false });
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
    expect(session.sendSignal.mock.calls[0]![0]).toMatchObject({
      type: 'user',
      tagName: 'user',
      contents: 'Find why the nightly build is slow.\nCheck the cache.',
    });
    expect(session.sendSignal.mock.calls[0]![1]).toMatchObject({ requireDelivery: true });
  });

  it("copies a private parent's visibility to the side session", async () => {
    const { start, sessions } = await setup('private');
    const result = (await start({ prompt: 'Look into it.', title: 'Investigation' })) as {
      sessionId: string;
      title: string;
    };
    expect(result.title).toBe('Investigation');
    await expect(sessions.getBySessionId(result.sessionId)).resolves.toMatchObject({ visibility: 'private' });
  });

  it("runs a private side session on its owner's memory resource, not the Factory's", async () => {
    const { start, created, scope } = await setup('private');
    await start({ prompt: 'Look into it.' });
    expect(created[0]!.options).toMatchObject({ resourceId: scope.userId });
    expect(created[0]!.options.resourceId).not.toBe(scope.factoryProjectId);
  });

  it("gives the kickoff a fresh request context carrying only the caller, so the child's first turn is not interactive", async () => {
    const { start, created } = await setup();
    await start({ prompt: 'Go.' });

    const kickoff = created[0]!.session.sendSignal.mock.calls[0]![1].requestContext;
    expect(kickoff.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(kickoff.get(FACTORY_INTERACTIVE_KEY)).toBeUndefined();
    expect(kickoff.get('controller')).toBeUndefined();
    expect([...kickoff.keys()]).toEqual(['user']);
  });

  it("primes the caller's tenant credentials with the project's model scope before the kickoff", async () => {
    const { start, calls } = await setup();
    await start({ prompt: 'Go.' });

    expect(prime).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1', credentialScope: 'user' });
    expect(calls).toEqual(['prime', 'kickoff']);
  });

  it('bills a side session in a hybrid Factory as an interactive session, on the caller', async () => {
    const env = await setup();
    await env.seed.projects.update({ orgId: 'org-1', id: env.scope.factoryProjectId, input: { modelScope: 'hybrid' } });
    await env.start({ prompt: 'Go.' });

    expect(prime).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1', credentialScope: 'user' });
  });

  it("bills the side session to the caller's credential tenant", async () => {
    const { start, seed, sessions } = await setup();
    const result = (await start({ prompt: 'Go.' })) as { sessionId: string };

    const tenantFor = (resourceId: string, threadId: string) => {
      const requestContext = new RequestContext();
      requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      requestContext.set('controller', { sessionId: resourceId, resourceId, threadId });
      return resolveFactoryCredentialTenant(requestContext, {
        projects: seed.projects,
        sourceControl: sessions,
        workItems: seed.workItems,
      });
    };
    const parent = await tenantFor('parent-session', 'parent-thread');
    expect(parent).toEqual({ orgId: 'org-1', userId: 'user-1', credentialScope: 'user' });
    await expect(tenantFor(result.sessionId, result.sessionId)).resolves.toEqual(parent);
  });

  it('writes no open-run entry and no start audit', async () => {
    const { start, created, seed, scope } = await setup();
    await start({ prompt: 'Go.' });

    const keys = created[0]!.session.thread.setSetting.mock.calls.map(([setting]) => setting.key);
    expect(keys).not.toContain(FACTORY_OPEN_RUNS_SETTING);
    const page = await seed.audit.list({ orgId: 'org-1', factoryProjectId: scope.factoryProjectId });
    expect(page.events).toEqual([]);
  });

  it('rejects a role without a work item', async () => {
    const { tool } = await setup();
    const schema = (tool as unknown as { inputSchema: { safeParse: (input: unknown) => { success: boolean } } })
      .inputSchema;
    expect(schema.safeParse({ prompt: 'Go.', role: 'work' }).success).toBe(false);
    expect(schema.safeParse({ prompt: 'Go.' }).success).toBe(true);
  });

  it('runs without approval', async () => {
    const { tool } = await setup();
    expect((tool as { requireApproval?: boolean }).requireApproval).toBeFalsy();
    expect(FACTORY_TOOLS_WITHOUT_APPROVAL).toContain('factory_start_session');
  });

  it('starts a side session on the model it was given', async () => {
    const { start, created } = await setup();

    await start({ prompt: 'Go.', model: 'openai/gpt-6.1-sol' });

    expect(created[0]!.session.model.switch).toHaveBeenCalledWith('openai/gpt-6.1-sol');
  });

  it('inherits the model of the session that started it when none is given', async () => {
    const { start, created, liveModels } = await setup();
    liveModels.set('parent-session', 'openai/gpt-6.1-sol');

    await start({ prompt: 'Go.' });

    expect(created[0]!.session.model.switch).toHaveBeenCalledWith('openai/gpt-6.1-sol');
  });

  it('keeps the scoped default when the parent has no model set', async () => {
    const { start, created } = await setup();

    await start({ prompt: 'Go.' });

    expect(created[0]!.session.model.switch).toHaveBeenCalledWith('openai/gpt-5.5');
  });

  it('rejects an unrunnable model before creating the session', async () => {
    const { start, sourceControl, projectRepository } = await setup();

    await expect(start({ prompt: 'Go.', model: 'anthropic/claude-opus-4-1' })).rejects.toThrow(
      "this session's credential scope (server) has no credential for its provider",
    );
    await expect(start({ prompt: 'Go.', model: 'no-such/model' })).rejects.toThrow('Unknown model no-such/model');
    await expect(
      sourceControl.sessions.list({ projectRepositoryId: projectRepository.id, viewerUserId: 'user-1' }),
    ).resolves.toHaveLength(1);
  });
});

describe('the side session run-end backstop', () => {
  async function started() {
    const env = await setup();
    const result = (await env.start({ prompt: 'Find why the nightly build is slow.' })) as { sessionId: string };
    const session = env.created[0]!.session;
    return { ...env, result, session };
  }

  it('tells the session that started it when the run finishes without a report', async () => {
    const { session, reports, result, scope } = await started();

    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);

    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]!.target).toEqual({ resourceId: scope.sessionId, threadId: scope.threadId });
    expect(reports[0]!.input).toMatchObject({
      source: 'factory-session',
      kind: 'done',
      priority: 'high',
      summary: 'The side session "Find why the nightly build is slow." finished.',
      attributes: { backstop: 'true', 'from-session': result.sessionId, 'from-user': 'user-1' },
    });

    // A later run nobody started from here (a typed message, a wake) reports too.
    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    await vi.waitFor(() => expect(reports).toHaveLength(2));
    expect(reports[1]!.target).toEqual({ resourceId: scope.sessionId, threadId: scope.threadId });
  });

  it('stays quiet when the agent already sent its own final report', async () => {
    const { session, reports, notifications, result, scope } = await started();
    await notifications.createNotification({
      source: 'factory-session',
      kind: 'done',
      priority: 'high',
      summary: 'done by the agent',
      threadId: scope.threadId,
      resourceId: scope.sessionId,
      attributes: { 'from-session': result.sessionId },
    });

    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(reports).toHaveLength(0);
  });

  it('reports a run that ends in error as failed', async () => {
    const { session, reports } = await started();
    session.emit({ type: 'agent_end', reason: 'error' } as AgentControllerEvent);
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]!.input).toMatchObject({ kind: 'failed', priority: 'urgent' });
  });

  it('says nothing for an aborted run and reports the run that follows it', async () => {
    const { session, reports } = await started();
    session.emit({ type: 'agent_end', reason: 'aborted' } as AgentControllerEvent);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(reports).toHaveLength(0);
    expect(session.listenerCount()).toBe(1);

    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]!.input).toMatchObject({ kind: 'done' });
    // The session's report listener stays for its later runs.
    expect(session.listenerCount()).toBe(1);
  });

  it('does not report done when the agent reported blocked and ended its turn to wait', async () => {
    const { session, reports, notifications, result, scope } = await started();
    await notifications.createNotification({
      source: 'factory-session',
      kind: 'blocked',
      priority: 'urgent',
      summary: 'Which branch?',
      threadId: scope.threadId,
      resourceId: scope.sessionId,
      attributes: { 'from-session': result.sessionId },
    });
    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(reports).toHaveLength(0);
    expect(session.listenerCount()).toBe(1);

    // Answered, the next run finishes without its own report: the backstop covers it.
    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]!.input).toMatchObject({ kind: 'done', attributes: { backstop: 'true' } });
    // The session's report listener stays for its later runs.
    expect(session.listenerCount()).toBe(1);
  });

  it('stays quiet after a waiting run when the next run sends its own done', async () => {
    const { session, reports, notifications, result, scope } = await started();
    const agentReport = (kind: string) =>
      notifications.createNotification({
        source: 'factory-session',
        kind,
        priority: 'high',
        summary: kind,
        threadId: scope.threadId,
        resourceId: scope.sessionId,
        attributes: { 'from-session': result.sessionId },
      });
    await agentReport('blocked');
    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    await new Promise(resolve => setTimeout(resolve, 10));
    await agentReport('done');
    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    // The session's report listener stays for its later runs.
    expect(session.listenerCount()).toBe(1);
    expect(reports).toHaveLength(0);
  });

  it('reports done once when a parked run is answered and the resumed run completes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
      const { session, reports } = await started();
      session.emit({ type: 'tool_suspended', toolName: 'ask_user', toolCallId: 'call-1' } as AgentControllerEvent);
      session.emit({ type: 'agent_end', reason: 'suspended' } as AgentControllerEvent);
      // The backstop's own `blocked` lands after the run ended, inside the next run's window.
      vi.setSystemTime(new Date('2026-10-14T12:00:05Z'));
      await vi.waitFor(() => expect(reports).toHaveLength(1));
      expect(reports[0]!.input).toMatchObject({ kind: 'blocked' });

      vi.setSystemTime(new Date('2026-10-14T12:01:00Z'));
      session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
      await vi.waitFor(() => expect(reports).toHaveLength(2));
      expect(reports[1]!.input).toMatchObject({ kind: 'done', attributes: { backstop: 'true' } });
      // The session's report listener stays for its later runs.
      expect(session.listenerCount()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts the side session on the parent session’s repository', async () => {
    const env = await setup();
    const result = (await env.start({ prompt: 'Go.' })) as { sessionId: string };
    const parent = await env.sessions.getBySessionId(env.scope.sessionId);
    const child = await env.sessions.getBySessionId(result.sessionId);
    expect(child!.projectRepositoryId).toBe(parent!.projectRepositoryId);
  });

  it('reports blocked, naming the tool, when the run ends parked', async () => {
    const { session, reports } = await started();
    session.emit({ type: 'tool_suspended', toolName: 'ask_user', toolCallId: 'call-1' } as AgentControllerEvent);
    session.emit({ type: 'agent_end', reason: 'suspended' } as AgentControllerEvent);
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]!.input).toMatchObject({
      kind: 'blocked',
      priority: 'urgent',
      attributes: { 'parked-tool': 'ask_user' },
    });
  });

  it('leaves nothing but the session’s own report listener when the kickoff fails', async () => {
    const env = await setup();
    const original = env.controller.createSession.getMockImplementation()!;
    env.controller.createSession.mockImplementationOnce(async (options: Record<string, unknown>) => {
      const session = await original(options);
      session.sendSignal.mockImplementationOnce(
        () => ({ accepted: Promise.reject(new Error('wake failed')) }) as never,
      );
      return session;
    });

    await expect(env.start({ prompt: 'Go.' })).rejects.toThrow('wake failed');
    expect(env.created[0]!.session.listenerCount()).toBe(1);
  });
});

describe('the side session it starts', () => {
  async function started() {
    const env = await setup();
    const result = (await env.start({ prompt: 'Go.' })) as { sessionId: string };
    return { ...env, childId: result.sessionId };
  }

  it('resolves as a worker with its origin, acting as the caller, and gets only the reply tool', async () => {
    const { childId, sessions, seed, scope } = await started();
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    requestContext.set('controller', { sessionId: childId, resourceId: childId, threadId: childId });

    const childScope = await resolveFactoryToolScope({
      requestContext,
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems: seed.workItems,
    });
    expect(childScope).toMatchObject({
      kind: 'worker',
      userId: 'user-1',
      factoryProjectId: scope.factoryProjectId,
      origin: { sessionId: 'parent-session', threadId: 'parent-thread' },
      interactive: false,
    });

    const tools = createFactoryTools({ scope: childScope!, deps: {} as unknown as FactoryToolDependencies });
    expect(Object.keys(tools)).toEqual(['factory_message_origin']);
    expect((tools.factory_message_origin as { requireApproval?: boolean }).requireApproval).toBeFalsy();
  });

  it("is allowed to report with factory_message_origin by the session-created listener's persisted rules", async () => {
    const { childId, sessions } = await started();
    let rules: PermissionRules = { categories: {}, tools: {} };
    const childSession = {
      identity: { getId: () => childId, getResourceId: () => childId },
      permissions: {
        getRules: () => structuredClone(rules),
        setForTool: async ({ toolName, policy }: { toolName: string; policy: 'allow' | 'ask' | 'deny' }) => {
          rules = { ...rules, tools: { ...rules.tools, [toolName]: policy } };
        },
      },
    };

    await applyFactoryToolPermissions(childSession, { sessions });
    expect(rules.tools.factory_message_origin).toBe('allow');
  });
});

describe('factory_start_session in work-item mode', () => {
  type Started = {
    mode: string;
    workItem: { id: string; number?: number };
    role: string;
    sessionId: string;
    threadId: string;
    bindingId: string;
    replacedSessionId?: string;
  };

  async function withItem(...args: Parameters<typeof setup>) {
    const env = await setup(...args);
    const { item } = await env.seed.workItems.upsert({
      orgId: 'org-1',
      userId: 'someone-else',
      factoryProjectId: env.scope.factoryProjectId,
      input: { title: 'Speed up the nightly build', stages: ['intake'], metadata: {} },
    });
    const subscriptions = () =>
      env.seed.workItems.listSessionSubscriptions({
        orgId: 'org-1',
        factoryProjectId: env.scope.factoryProjectId,
        sessionId: env.scope.sessionId,
      });
    const sessionRows = () =>
      env.sourceControl.sessions.list({ projectRepositoryId: env.projectRepository.id, viewerUserId: 'user-1' });
    const bindings = () => env.seed.workItems.listRunBindings('org-1', env.scope.factoryProjectId, item.id);
    const bindOther = (sessionId: string) =>
      env.seed.workItems.prepareRunStart({
        orgId: 'org-1',
        userId: 'someone-else',
        factoryProjectId: env.scope.factoryProjectId,
        workItem: { id: item.id, input: { title: item.title, stages: item.stages } },
        role: 'work',
        session: { sessionId, branch: `factory/${sessionId}`, threadId: `${sessionId}-thread` },
        resourceId: sessionId,
        kickoffKey: `kickoff-${sessionId}`,
        kickoffMessage: null,
      });
    return { ...env, item, subscriptions, sessionRows, bindings, bindOther };
  }

  it("binds the role to a new session owned by the caller, kicks it off with the prompt, and doesn't move the card", async () => {
    const { start, item, seed, sessions, created, transition, bindings, scope } = await withItem();

    const result = (await start({ prompt: 'Profile the build.', workItem: item.id, role: 'work' })) as Started;

    expect(result).toMatchObject({ mode: 'work-item', workItem: { id: item.id }, role: 'work' });
    await expect(sessions.getBySessionId(result.sessionId)).resolves.toMatchObject({
      userId: 'user-1',
      visibility: 'org',
      originSessionId: null,
      factoryProjectId: scope.factoryProjectId,
    });
    const session = created.find(entry => entry.options.id === result.sessionId)!.session;
    expect(session.state.get()).toMatchObject({ factoryOwnerUserId: 'user-1' });
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
    expect(session.sendSignal.mock.calls[0]![0]).toMatchObject({ type: 'user', contents: 'Profile the build.' });
    const kickoff = session.sendSignal.mock.calls[0]![1].requestContext;
    expect([...kickoff.keys()]).toEqual(['user']);
    expect(kickoff.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });

    expect(await bindings()).toEqual([
      expect.objectContaining({ id: result.bindingId, role: 'work', sessionId: result.sessionId, status: 'active' }),
    ]);
    expect(transition).not.toHaveBeenCalled();
    const after = (await seed.workItems.get({ orgId: 'org-1', id: item.id }))!;
    expect(after.stages).toEqual(item.stages);
    expect(after.autonomyArmedAt).toEqual(item.autonomyArmedAt);
    expect(after.sessions.work).toMatchObject({ sessionId: result.sessionId });
  });

  it('starts a work-item run shared with the org even from a private session', async () => {
    const { start, item, sessions, sourceControl } = await withItem('private');

    const result = (await start({ prompt: 'Profile the build.', workItem: item.id, role: 'work' })) as Started;

    await expect(sessions.getBySessionId(result.sessionId)).resolves.toMatchObject({ visibility: 'org' });
    const teammateSees = await sourceControl.sessions.list({
      projectRepositoryId: (await sessions.getBySessionId(result.sessionId))!.projectRepositoryId,
      viewerUserId: 'user-2',
    });
    expect(teammateSees.map(row => row.sessionId)).toContain(result.sessionId);
  });

  it("calls the coordinator with no destination stage and the project's model scope", async () => {
    const { start, item, prepare, scope } = await withItem();
    const result = (await start({ prompt: 'Go.', workItem: item.id, role: 'work' })) as Started;

    expect(prepare).toHaveBeenCalledTimes(1);
    const request = prepare.mock.calls[0]![0];
    expect(request).toMatchObject({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: scope.factoryProjectId,
      sessionId: result.sessionId,
      threadTitle: '"Speed up the nightly build" work',
      modelScope: 'user',
      workItem: { id: item.id, role: 'work', input: { title: item.title } },
    });
    expect(request).not.toHaveProperty('destinationStage');
    expect(request.requestContext).toBeUndefined();
  });

  it("starts a work-item role in a hybrid Factory on the Factory's scope, like the Start route", async () => {
    const env = await withItem();
    await env.seed.projects.update({ orgId: 'org-1', id: env.scope.factoryProjectId, input: { modelScope: 'hybrid' } });
    await env.start({ prompt: 'Go.', workItem: env.item.id, role: 'work' });

    expect(env.prepare.mock.calls[0]![0]).toMatchObject({ modelScope: 'factory' });
  });

  it("bills the work-item session to the caller's credential tenant", async () => {
    const { start, item, seed, sessions } = await withItem();
    const result = (await start({ prompt: 'Go.', workItem: item.id, role: 'work' })) as Started;

    const tenantFor = (resourceId: string, threadId: string) => {
      const requestContext = new RequestContext();
      requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      requestContext.set('controller', { sessionId: resourceId, resourceId, threadId });
      return resolveFactoryCredentialTenant(requestContext, {
        projects: seed.projects,
        sourceControl: sessions,
        workItems: seed.workItems,
      });
    };
    const parent = await tenantFor('parent-session', 'parent-thread');
    expect(parent).toEqual({ orgId: 'org-1', userId: 'user-1', credentialScope: 'user' });
    await expect(tenantFor(result.sessionId, result.threadId)).resolves.toEqual(parent);
  });

  it('follows the item with reason "started" before the coordinator runs', async () => {
    const { start, item, subscriptions, wrapped } = await (async () => {
      let seenAtPrepare: unknown[] = [];
      const env = await withItem('org', {
        wrapPrepare: prepare => async request => {
          seenAtPrepare = await env_.subscriptions();
          return prepare(request);
        },
      });
      const env_ = env;
      return { ...env, wrapped: () => seenAtPrepare };
    })();

    await start({ prompt: 'Go.', workItem: item.id, role: 'work' });
    expect(wrapped()).toEqual([expect.objectContaining({ workItemId: item.id, reason: 'started' })]);
    expect(await subscriptions()).toEqual([expect.objectContaining({ workItemId: item.id, reason: 'started' })]);
  });

  it('records the run start as the person, with an open-run entry this process heartbeats until the run ends', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    try {
      vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
      const { start, item, seed, created, scope } = await withItem();
      const result = (await start({ prompt: 'Go.', workItem: item.id, role: 'work' })) as Started;
      const session = created.find(entry => entry.options.id === result.sessionId)!.session;

      const page = await seed.audit.list({ orgId: 'org-1', factoryProjectId: scope.factoryProjectId });
      const started = page.events.filter(event => event.action === 'factory.run.started');
      expect(started).toEqual([expect.objectContaining({ actorType: 'human', actorId: 'user-1' })]);

      const [entry] = await listSessionOpenRuns(session);
      expect(entry).toMatchObject({
        bindingId: result.bindingId,
        role: 'work',
        workItemId: item.id,
        startedBy: 'user-1',
        ownerId: FACTORY_TOOLS_OWNER_ID,
        heartbeatAt: Date.parse('2026-10-14T12:00:00Z'),
      });
      expect(FACTORY_TOOLS_OWNER_ID).toMatch(/^factory-tools:/);
      expect(isOpenRunLiveElsewhere(entry!, 'factory-rule-dispatcher:other')).toBe(true);

      await vi.advanceTimersByTimeAsync(FACTORY_OPEN_RUN_STALE_MS);
      const renewed = (await listSessionOpenRuns(session))[0]!;
      expect(renewed.heartbeatAt).toBeGreaterThan(entry!.heartbeatAt!);
      expect(isOpenRunLiveElsewhere(renewed, 'factory-rule-dispatcher:other')).toBe(true);

      session.emit({ type: 'agent_end', reason: 'suspended' } as AgentControllerEvent);
      // A parked run waits for an answer: the heartbeat stops; only the session's report listener remains.
      expect(session.listenerCount()).toBe(1);
      const parked = (await listSessionOpenRuns(session))[0]!;
      await vi.advanceTimersByTimeAsync(FACTORY_OPEN_RUN_STALE_MS * 2);
      expect((await listSessionOpenRuns(session))[0]!.heartbeatAt).toBe(parked.heartbeatAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a binding for the role that a racing start replaced', async () => {
    let env: Awaited<ReturnType<typeof withItem>>;
    env = await withItem('org', {
      wrapPrepare: prepare => async request => {
        // A dispatcher bind lands between the pre-check and the coordinator.
        await env.bindOther('raced-session');
        return prepare(request);
      },
    });
    const result = (await env.start({ prompt: 'Go.', workItem: env.item.id, role: 'work' })) as Started;
    expect(result.replacedSessionId).toBe('raced-session');
  });

  it('refuses a role that already has a session, active or revoked, naming it and creating nothing', async () => {
    for (const revoke of [false, true]) {
      const env = await withItem();
      const { binding } = await env.bindOther('existing-session');
      if (revoke) {
        await env.seed.workItems.revokeRunBinding({
          orgId: 'org-1',
          factoryProjectId: env.scope.factoryProjectId,
          bindingId: binding.id,
          revokedAt: new Date(),
        });
      }
      const rowsBefore = await env.sessionRows();
      const bindingsBefore = await env.bindings();

      await expect(env.start({ prompt: 'Go.', workItem: env.item.id, role: 'work' })).rejects.toThrow(
        '"Speed up the nightly build" already has a work session existing-session; message it with factory_signal_session.',
      );
      expect(env.prepare).not.toHaveBeenCalled();
      expect(await env.sessionRows()).toEqual(rowsBefore);
      expect(await env.bindings()).toEqual(bindingsBefore);
      expect((await env.seed.workItems.get({ orgId: 'org-1', id: env.item.id }))!.sessions.work).toMatchObject({
        sessionId: 'existing-session',
      });
      expect(await env.subscriptions()).toEqual([]);
    }
  });

  it("refuses a role the item's board doesn't seat", async () => {
    const { start, item, prepare } = await withItem();
    await expect(start({ prompt: 'Go.', workItem: item.id, role: 'deploy' })).rejects.toThrow(
      `"Speed up the nightly build"'s board has no deploy role.`,
    );
    expect(prepare).not.toHaveBeenCalled();
  });

  it('refuses an item from another Factory', async () => {
    const env = await withItem();
    const other = await env.seed.projects.create({ orgId: 'org-1', userId: 'owner', input: { name: 'Other' } });
    const { item: foreign } = await env.seed.workItems.upsert({
      orgId: 'org-1',
      userId: 'owner',
      factoryProjectId: other.id,
      input: { title: 'Elsewhere', stages: ['intake'], metadata: {} },
    });
    await expect(env.start({ prompt: 'Go.', workItem: foreign.id, role: 'work' })).rejects.toThrow(
      `No work item ${foreign.id} was found in this Factory.`,
    );
    expect(env.prepare).not.toHaveBeenCalled();
  });

  it('refuses an item with several repositories, listing them and creating nothing', async () => {
    const env = await withItem();
    const second = await env.sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: env.installation.id, externalId: '3', slug: 'mastra-ai/docs', defaultBranch: 'main' },
    });
    await env.sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: env.connection.id,
      repositoryId: second.id,
      createdByUserId: 'owner',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/docs',
    });
    const rowsBefore = await env.sessionRows();

    await expect(env.start({ prompt: 'Go.', workItem: env.item.id, role: 'work' })).rejects.toThrow(
      /several repositories \(.*mastra-ai\/mastra.*\); v1 can't choose one/,
    );
    await expect(env.start({ prompt: 'Go.', workItem: env.item.id, role: 'work' })).rejects.toThrow(/mastra-ai\/docs/);
    expect(env.prepare).not.toHaveBeenCalled();
    expect(await env.sessionRows()).toEqual(rowsBefore);
    expect(await env.bindings()).toEqual([]);
  });

  it("refuses while the Factory runtime's coordinator isn't ready", async () => {
    const { start, item, sessionRows } = await withItem('org', { coordinator: 'none' });
    const before = await sessionRows();
    await expect(start({ prompt: 'Go.', workItem: item.id, role: 'work' })).rejects.toThrow(
      "Factory sessions can't be started yet; try again shortly.",
    );
    expect(await sessionRows()).toEqual(before);
  });

  it('removes the subscription it added when prepare fails, but keeps one that already existed', async () => {
    const failing = () =>
      withItem('org', {
        wrapPrepare: () => async () => {
          throw new Error('sandbox unavailable');
        },
      });

    const fresh = await failing();
    await expect(fresh.start({ prompt: 'Go.', workItem: fresh.item.id, role: 'work' })).rejects.toThrow(
      'sandbox unavailable',
    );
    expect(await fresh.subscriptions()).toEqual([]);

    const following = await failing();
    await following.seed.workItems.subscribeToWorkItem({
      orgId: 'org-1',
      factoryProjectId: following.scope.factoryProjectId,
      workItemId: following.item.id,
      sessionId: following.scope.sessionId,
      threadId: following.scope.threadId,
      resourceId: following.scope.resourceId,
      userId: 'user-1',
      reason: 'subscribed',
    });
    await expect(following.start({ prompt: 'Go.', workItem: following.item.id, role: 'work' })).rejects.toThrow(
      'sandbox unavailable',
    );
    expect(await following.subscriptions()).toEqual([
      expect.objectContaining({ workItemId: following.item.id, reason: 'subscribed' }),
    ]);
  });

  it('tells everyone following the item when the run finishes without a report', async () => {
    const { start, item, created, reports, scope } = await withItem();
    const result = (await start({ prompt: 'Go.', workItem: item.id, role: 'work' })) as Started;
    const session = created.find(entry => entry.options.id === result.sessionId)!.session;

    session.emit({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);

    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]!.target).toEqual({ resourceId: scope.sessionId, threadId: scope.threadId });
    expect(reports[0]!.input).toMatchObject({
      kind: 'done',
      summary: 'The work session for "Speed up the nightly build" finished.',
      attributes: { backstop: 'true', role: 'work', 'work-item': item.id, 'from-session': result.sessionId },
    });
  });

  it('reports a failed run to every follower and skips one that already has the agent’s report', async () => {
    const env = await withItem();
    const result = (await env.start({ prompt: 'Go.', workItem: env.item.id, role: 'work' })) as Started;
    const follow = (sessionId: string) =>
      env.seed.workItems.subscribeToWorkItem({
        orgId: 'org-1',
        factoryProjectId: env.scope.factoryProjectId,
        workItemId: env.item.id,
        sessionId,
        threadId: sessionId,
        resourceId: sessionId,
        userId: 'user-2',
        reason: 'subscribed',
      });
    await follow('teammate');
    await follow('reviewer');
    await env.notifications.createNotification({
      source: 'factory-session',
      kind: 'failed',
      priority: 'urgent',
      summary: 'gave up',
      threadId: 'reviewer',
      resourceId: 'reviewer',
      attributes: { 'from-session': result.sessionId },
    });
    const session = env.created.find(entry => entry.options.id === result.sessionId)!.session;

    session.emit({ type: 'agent_end', reason: 'error' } as AgentControllerEvent);

    await vi.waitFor(() => expect(env.reports).toHaveLength(2));
    expect(env.reports.map(report => report.target.threadId).sort()).toEqual([env.scope.threadId, 'teammate'].sort());
    for (const report of env.reports) {
      expect(report.input).toMatchObject({ kind: 'failed', priority: 'urgent', attributes: { backstop: 'true' } });
    }
  });

  it('lets the spawned session report with factory_message_origin without approval', async () => {
    const { start, item, sessions } = await withItem();
    const result = (await start({ prompt: 'Go.', workItem: item.id, role: 'work' })) as Started;
    let rules: PermissionRules = { categories: {}, tools: {} };
    await applyFactoryToolPermissions(
      {
        identity: { getId: () => result.sessionId, getResourceId: () => result.sessionId },
        permissions: {
          getRules: () => structuredClone(rules),
          setForTool: async ({ toolName, policy }: { toolName: string; policy: 'allow' | 'ask' | 'deny' }) => {
            rules = { ...rules, tools: { ...rules.tools, [toolName]: policy } };
          },
        },
      },
      { sessions },
    );
    expect(rules.tools.factory_message_origin).toBe('allow');
    expect(FACTORY_TOOLS_WITHOUT_APPROVAL).toContain('factory_message_origin');
  });
});

describe('session tools on a turn nobody signed in started', () => {
  // A notification wake runs as the session owner but carries other people's text.
  const wake = { interactive: false };

  it('switches the model of a side session it started', async () => {
    const env = await setup('org', wake);
    const started = (await env.start({ prompt: 'Review PR 1.' })) as { sessionId: string };

    await expect(env.switchModel({ sessionId: started.sessionId, modelId: 'openai/gpt-5.6' })).resolves.toMatchObject({
      sessionId: started.sessionId,
      modelId: 'openai/gpt-5.6',
      live: true,
    });
    expect(env.created[0]!.session.model.switch).toHaveBeenCalledWith('openai/gpt-5.6');
  });

  it("refuses the owner's sessions it did not start, which a person's turn could switch", async () => {
    const env = await setup('org', wake);
    const started = (await env.start({ prompt: 'Review PR 1.' })) as { sessionId: string };
    // Another of user-1's sessions, woken by a notification, reaching for this side session.
    await env.sourceControl.sessions.create({
      sessionId: 'other-session',
      projectRepositoryId: env.projectRepository.id,
      factoryProjectId: env.project.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-other-session',
      baseBranch: 'main',
    });
    const other = { ...env.scope, sessionId: 'other-session', resourceId: 'other-session', threadId: 'other-thread' };

    env.controller.listAvailableModels.mockClear();
    await expect(env.toolsFor(other).switchModel({ sessionId: started.sessionId })).rejects.toThrow(
      'only this session and the side sessions it started can switch models',
    );
    expect(env.controller.listAvailableModels).not.toHaveBeenCalled();
    expect(env.controller.setThreadModel).not.toHaveBeenCalled();

    await expect(
      env
        .toolsFor({ ...other, interactive: true })
        .switchModel({ sessionId: started.sessionId, modelId: 'openai/gpt-5.6' }),
    ).resolves.toMatchObject({ modelId: 'openai/gpt-5.6' });
  });

  it('switches its own model', async () => {
    const env = await setup('org', wake);
    const started = (await env.start({ prompt: 'Review PR 1.' })) as { sessionId: string; threadId: string };
    // The side session, on a woken turn of its own, switching its own model.
    const self = {
      ...env.scope,
      sessionId: started.sessionId,
      resourceId: started.sessionId,
      threadId: started.threadId,
    };

    await expect(
      env.toolsFor(self).switchModel({ sessionId: started.sessionId, modelId: 'openai/gpt-5.6' }),
    ).resolves.toMatchObject({ sessionId: started.sessionId, modelId: 'openai/gpt-5.6' });
    expect(env.created[0]!.session.model.switch).toHaveBeenCalledWith('openai/gpt-5.6');
  });

  it('refuses to seat a role on a work item, which records a run as the person', async () => {
    const env = await setup('org', wake);
    await expect(env.start({ prompt: 'Plan it.', workItem: '#1', role: 'plan' })).rejects.toThrow(
      'Starting a role on a work item needs a person in this turn',
    );
    expect(env.prepare).not.toHaveBeenCalled();
    expect(env.created).toHaveLength(0);
  });

  it('mounts every user tool but refuses to answer an approval', async () => {
    const env = await setup('org', wake);
    const deps = { ...env.deps, comments: {} } as unknown as FactoryToolDependencies;
    const answer = (scope: FactoryToolScope) =>
      (
        createFactoryTools({ scope, deps }).factory_answer_approval as unknown as {
          execute: (input: unknown, context: unknown) => Promise<unknown>;
        }
      ).execute({ sessionId: crypto.randomUUID(), toolCallId: 'call-1', decision: 'approve' }, {});

    const woken = createFactoryTools({ scope: env.scope, deps });
    for (const name of ['factory_answer_approval', 'factory_start_session', 'factory_switch_session_model'])
      expect(woken).toHaveProperty(name);
    await expect(answer(env.scope)).rejects.toThrow('Only a person can answer an approval');
    // A person's turn gets past the gate and fails on the lookup instead.
    await expect(answer({ ...env.scope, interactive: true })).rejects.toThrow('was not found in this Factory');
  });
});
