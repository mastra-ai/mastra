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
import { FACTORY_TOOLS_WITHOUT_APPROVAL, applyFactoryToolPermissions } from './permissions.js';
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

function fakeController(calls: string[]) {
  const created: Array<{ options: Record<string, unknown>; session: ReturnType<typeof fakeSession> }> = [];
  function fakeSession(id: string) {
    let state: Record<string, unknown> = {};
    const settings = new Map<string, unknown>();
    const listeners = new Set<(event: AgentControllerEvent) => void>();
    return {
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
      model: { switch: vi.fn(async () => undefined) },
      subagents: { model: { set: vi.fn(async () => undefined) } },
      thread: {
        requireId: () => id,
        rename: vi.fn(async () => undefined),
        getSetting: async ({ key }: { key: string }) => settings.get(key),
        setSetting: vi.fn(async ({ key, value }: { key: string; value: unknown }) => void settings.set(key, value)),
      },
      sendSignal: vi.fn((_input: unknown, _options: { requestContext: RequestContext }) => {
        calls.push('kickoff');
        return { accepted: Promise.resolve({ accepted: true as const, runId: 'run-1' }) };
      }),
    };
  }
  const controller = {
    createSession: vi.fn(async (options: Record<string, unknown>) => {
      const session = fakeSession(options.threadId as string);
      created.push({ options, session });
      return session;
    }),
    getSessionByResource: vi.fn(
      async (resourceId: string) => created.find(entry => entry.options.resourceId === resourceId)?.session ?? null,
    ),
  };
  return { controller, created };
}

type Prepare = FactoryStartCoordinator['prepare'];

async function setup(
  parentVisibility: SourceControlSessionVisibility = 'org',
  {
    coordinator: coordinatorOption = 'real',
    wrapPrepare,
  }: { coordinator?: 'real' | 'none'; wrapPrepare?: (prepare: Prepare) => Prepare } = {},
) {
  const seeded = await seedFactory(parentVisibility);
  const calls: string[] = [];
  prime.mockImplementation(async () => void calls.push('prime'));
  const { controller, created } = fakeController(calls);
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
    queryThreadById: async ({ threadId }: { threadId: string }) => ({
      id: threadId,
      resourceId: threadOwner(threadId),
    }),
    queryThreads: async () => [],
    // Sessions this test created are themselves; anything else (the parent) is a live stub.
    getSessionByResource: async (resourceId: string) =>
      (await controller.getSessionByResource(resourceId)) ?? {
        thread: { getId: () => (resourceId === seeded.scope.sessionId ? seeded.scope.threadId : resourceId) },
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
  const deps = {
    sessions: seeded.sessions,
    sessionModel: { projects: seeded.seed.projects, modelDefaults: seeded.seed.modelDefaults },
    messaging: async () => ({ controller: deliveryController, notifications }) as never,
    workItems: seeded.seed.workItems,
    boards: createBoardRegistry(),
    auditRecorder: audit,
    startCoordinator: () => (coordinatorOption === 'none' ? undefined : { prepare }),
  };
  const tool = createFactorySessionTools(seeded.scope, deps).factory_start_session!;
  const start = (input: Record<string, unknown>) =>
    (tool as unknown as { execute: (input: unknown, context: unknown) => Promise<unknown> }).execute(input, {});
  return { ...seeded, calls, controller, created, start, tool, prepare, transition, notifications, reports };
}

beforeEach(() => {
  prime.mockReset();
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
      resourceId: result.sessionId,
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

  it("bills the side session to the caller's credential tenant", async () => {
    const { start, seed, sessions } = await setup();
    const result = (await start({ prompt: 'Go.' })) as { sessionId: string };

    const tenantFor = (resourceId: string, threadId: string) => {
      const requestContext = new RequestContext();
      requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      requestContext.set('controller', { resourceId, threadId });
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
    expect(session.listenerCount()).toBe(0);
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
    await vi.waitFor(() => expect(session.listenerCount()).toBe(0));
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
    await vi.waitFor(() => expect(session.listenerCount()).toBe(0));
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
    await vi.waitFor(() => expect(session.listenerCount()).toBe(0));
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
      await vi.waitFor(() => expect(session.listenerCount()).toBe(0));
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

  it('stops watching when the kickoff fails', async () => {
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
    expect(env.created[0]!.session.listenerCount()).toBe(0);
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
    requestContext.set('controller', { resourceId: childId, threadId: childId });

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
      identity: { getResourceId: () => childId },
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
    const session = created.find(entry => entry.options.resourceId === result.sessionId)!.session;
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

  it("bills the work-item session to the caller's credential tenant", async () => {
    const { start, item, seed, sessions } = await withItem();
    const result = (await start({ prompt: 'Go.', workItem: item.id, role: 'work' })) as Started;

    const tenantFor = (resourceId: string, threadId: string) => {
      const requestContext = new RequestContext();
      requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      requestContext.set('controller', { resourceId, threadId });
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
      const session = created.find(entry => entry.options.resourceId === result.sessionId)!.session;

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
      // A parked run waits for an answer: the watch carries on, the heartbeat does not.
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
    const session = created.find(entry => entry.options.resourceId === result.sessionId)!.session;

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
    const session = env.created.find(entry => entry.options.resourceId === result.sessionId)!.session;

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
        identity: { getResourceId: () => result.sessionId },
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
