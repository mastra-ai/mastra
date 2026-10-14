import type { PermissionRules } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import { resolveFactoryCredentialTenant } from '../session/credential-policy.js';
import { createSourceControlSessionLookup } from '../session/factory-session.js';
import { FACTORY_OPEN_RUNS_SETTING } from '../session/run-audit.js';
import type { SourceControlSessionVisibility } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FACTORY_TOOLS_WITHOUT_APPROVAL, applyFactoryToolPermissions } from './permissions.js';
import { FACTORY_INTERACTIVE_KEY, resolveFactoryToolScope } from './scope.js';
import type { FactoryToolScope } from './scope.js';
import { createFactorySessionTools } from './session-tools.js';
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
  return { seed, project, sessions, scope };
}

function fakeController(calls: string[]) {
  const created: Array<{ options: Record<string, unknown>; session: ReturnType<typeof fakeSession> }> = [];
  function fakeSession(id: string) {
    let state: Record<string, unknown> = {};
    return {
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
        setSetting: vi.fn(async () => undefined),
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
  };
  return { controller, created };
}

async function setup(parentVisibility: SourceControlSessionVisibility = 'org') {
  const seeded = await seedFactory(parentVisibility);
  const calls: string[] = [];
  prime.mockImplementation(async () => void calls.push('prime'));
  const { controller, created } = fakeController(calls);
  const deps = {
    sessions: seeded.sessions,
    sessionModel: { projects: seeded.seed.projects, modelDefaults: seeded.seed.modelDefaults },
    messaging: async () => ({ controller, notifications: {} }) as never,
  };
  const tool = createFactorySessionTools(seeded.scope, deps).factory_start_session!;
  const start = (input: Record<string, unknown>) =>
    (tool as unknown as { execute: (input: unknown, context: unknown) => Promise<unknown> }).execute(input, {});
  return { ...seeded, calls, controller, created, start, tool };
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
