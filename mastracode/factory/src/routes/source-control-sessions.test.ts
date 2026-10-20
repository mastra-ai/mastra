import { stateSchema } from '@mastra/code-sdk/schema';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { getFactorySessionAddress, resolveFactorySessionAddress } from '../rules/binding-context.js';
import type { SessionRetirementCoordinator } from '../sandbox/session-retirement.js';
import { waitForPendingFilesystemCapture } from '../session/filesystem-capture.js';
import {
  FACTORY_OPEN_RUNS_SETTING,
  listSessionOpenRuns,
  observeSessionRunEnd,
  recordSessionRunStart,
  waitForSessionRunAudit,
} from '../session/run-audit.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { buildSourceControlSessionRoutes } from './source-control-sessions.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

vi.mock('../session/filesystem-capture.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../session/filesystem-capture.js')>();
  return { ...actual, waitForPendingFilesystemCapture: vi.fn(actual.waitForPendingFilesystemCapture) };
});

const user = { workosId: 'user-1', organizationId: 'org-1' };

type RouteOptions = Parameters<typeof buildSourceControlSessionRoutes>[0];

function buildApp(
  sourceControls: readonly SourceControlStorageHandle[],
  { memorySettings, projects, users }: Pick<RouteOptions, 'memorySettings' | 'projects' | 'users'>,
  controller?: RouteOptions['controller'],
  workItems?: RouteOptions['workItems'],
) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    buildSourceControlSessionRoutes({
      auth: fakeRouteAuth(),
      sourceControls,
      projects,
      memorySettings,
      controller,
      users,
      ...(workItems ? { workItems } : {}),
    }),
  );
  return app;
}

async function seedGitLabRepository() {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('gitlab');
  const project = await seed.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'GitLab project' },
  });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: 'gitlab.com',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: {
      installationId: installation.id,
      externalId: '86555418',
      slug: 'rhys-group1/factory-gitlab-primary',
      defaultBranch: 'main',
    },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const projectRepository = await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/factory-gitlab-primary',
  });
  return { seed, sourceControl, projectRepository, project };
}

describe('source-control session routes', () => {
  it('resolves binding, run audit, and title flows when the hosted thread differs from the Factory session', async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    const sessionId = 'factory-session-1';
    const threadId = 'conversation-1';
    const row = await sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/review-1',
      baseBranch: 'main',
      visibility: 'org',
    });
    const storage = new InMemoryStore({ id: 'factory-single-thread-host' });
    const controller = new AgentController<MastraCodeState>({
      id: 'code',
      stateSchema,
      storage,
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({
            id: 'test-agent',
            name: 'Test agent',
            instructions: 'Test Factory session addressing.',
            model: { id: 'openai/gpt-5.5' },
          }),
        },
      ],
    });
    await controller.init();
    const session = await controller.createSession({
      id: sessionId,
      resourceId: sessionId,
      ownerId: 'user-1',
      threadId,
    });
    onTestFinished(async () => {
      await controller.deleteSession({ sessionId });
    });
    expect(session.identity.getId()).toBe(sessionId);
    expect(session.thread.getId()).toBe(threadId);
    const prepared = await seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      workItem: {
        input: {
          title: 'Review change',
          stages: ['reviewing'],
          externalSource: { integrationId: 'gitlab', type: 'pull-request', externalId: 'pr-1' },
        },
      },
      role: 'review',
      session: { sessionId, threadId, branch: row.branch },
      resourceId: sessionId,
      kickoffKey: 'review-kickoff',
      kickoffMessage: null,
    });
    const caller = new RequestContext();
    caller.set('user', user);
    const requestContext = await session.machinery.buildRequestContext(caller);
    const getBySessionId = vi.spyOn(sourceControl.sessions, 'getBySessionId');
    const recovered = await resolveFactorySessionAddress({
      requestContext,
      storage: seed.workItems,
      sessions: sourceControl.sessions,
    });
    const address = {
      orgId: 'org-1',
      factoryProjectId: project.id,
      resourceId: sessionId,
      sessionId,
      threadId,
    };
    expect(recovered).toMatchObject({ address, binding: { id: prepared.binding.id } });
    expect(getBySessionId).toHaveBeenCalledWith(sessionId);
    expect(session.state.get()).toMatchObject({
      factoryProjectId: project.id,
      factoryOrgId: 'org-1',
      projectRepositoryId: projectRepository.id,
      untrustedCheckout: true,
      baseRef: 'main',
    });
    expect(getFactorySessionAddress(requestContext)).toEqual(address);
    await session.state.set({ untrustedCheckout: false, baseRef: '' });
    await expect(
      resolveFactorySessionAddress({
        requestContext,
        storage: seed.workItems,
        sessions: sourceControl.sessions,
        forceBindingLookup: true,
      }),
    ).resolves.toMatchObject({ address, binding: { id: prepared.binding.id } });
    expect(session.state.get()).toMatchObject({ untrustedCheckout: true, baseRef: 'main' });

    const unsubscribe = observeSessionRunEnd(session, { audit: seed.audit });
    onTestFinished(unsubscribe);
    await recordSessionRunStart(session, {
      audit: seed.audit,
      actorType: 'human',
      observedEnd: () => undefined,
      run: {
        kickoffId: 'review-kickoff',
        bindingId: prepared.binding.id,
        role: 'review',
        startedBy: 'user-1',
        orgId: 'org-1',
        factoryProjectId: project.id,
        workItemId: prepared.item.id,
        sessionId,
        threadId,
        branch: row.branch,
      },
    });
    await expect(listSessionOpenRuns(session)).resolves.toEqual([
      expect.objectContaining({ sessionId, threadId, kickoffId: 'review-kickoff' }),
    ]);
    const memory = await storage.getStore('memory');
    const persistedThread = await memory!.getThreadById({ threadId });
    expect(persistedThread?.metadata?.[FACTORY_OPEN_RUNS_SETTING]).toEqual([
      expect.objectContaining({ sessionId, threadId }),
    ]);
    await expect(memory!.getThreadById({ threadId: sessionId })).resolves.toBeNull();
    session.emit({ type: 'agent_end', reason: 'complete' });
    await waitForSessionRunAudit(session);
    await expect(listSessionOpenRuns(session)).resolves.toEqual([]);
    const endedThread = await memory!.getThreadById({ threadId });
    expect(endedThread?.metadata?.[FACTORY_OPEN_RUNS_SETTING]).toEqual([]);
    const { events } = await seed.audit.list({ orgId: 'org-1' });
    expect(events.filter(event => event.action === 'factory.run.started')).toHaveLength(1);
    expect(events.filter(event => event.action === 'factory.run.ended')).toHaveLength(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'factory.run.started',
          metadata: expect.objectContaining({ sessionId, threadId }),
        }),
        expect.objectContaining({
          action: 'factory.run.ended',
          actorId: `agent:${threadId}`,
          metadata: expect.objectContaining({ sessionId, threadId, reason: 'complete' }),
        }),
      ]),
    );

    const queryThreads = vi.spyOn(controller, 'queryThreads');
    const generateTitle = vi.spyOn(controller, 'generateThreadTitle').mockResolvedValue('  Review   change  ');
    const app = buildApp([sourceControl], seed, controller);
    const response = await app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ title: 'Review change' });
    expect(queryThreads).toHaveBeenCalledWith({ resourceId: sessionId });
    expect(generateTitle).toHaveBeenCalledWith({
      threadId,
      sessionId,
      requestContext: expect.any(RequestContext),
    });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      id: row.id,
      title: 'Review change',
    });
    await expect(sourceControl.sessions.getBySessionId(threadId)).resolves.toBeNull();
  });

  it('lists and opens a session stored in the GitLab partition', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const session = await sourceControl.sessions.create({
      sessionId: 'gitlab-session-1',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/issue-1',
      baseBranch: 'main',
      visibility: 'org',
    });
    const app = buildApp([sourceControl], seed);

    const listed = await app.request(`/web/source-control/projects/${projectRepository.id}/sessions`);
    expect(listed.status).toBe(200);
    expect(listed.headers.get('content-type')).toContain('application/json');
    await expect(listed.json()).resolves.toMatchObject({
      sessions: [expect.objectContaining({ sessionId: session.sessionId })],
    });

    const opened = await app.request(`/web/user-sessions/${session.sessionId}`);
    expect(opened.status).toBe(200);
    expect(opened.headers.get('content-type')).toContain('application/json');
    await expect(opened.json()).resolves.toMatchObject({
      session: { sessionId: session.sessionId, projectRepositoryId: projectRepository.id },
    });
  });

  it('reports the memory resource a session runs under when it is opened', async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    const create = (sessionId: string) =>
      sourceControl.sessions.create({
        sessionId,
        projectRepositoryId: projectRepository.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: `user/session-${sessionId}`,
        baseBranch: 'main',
        visibility: 'org',
      });
    await create('session-new');
    await create('session-run');
    const threads: Record<string, { id: string; resourceId: string }> = {
      'session-run': { id: 'session-run', resourceId: project.id },
    };
    const controller = {
      queryThreadById: async ({ threadId }: { threadId: string }) => threads[threadId] ?? null,
    } as unknown as RouteOptions['controller'];
    // Only a run binding lets a session run under its Factory.
    const workItems = {
      clearSessionReferences: async () => {},
      hasRunBindingForSession: async ({ sessionId }: { sessionId: string }) => sessionId === 'session-run',
    };
    const app = buildApp([sourceControl], seed, controller, workItems);

    // A session with no thread yet is a new user session: it starts under its owner.
    const fresh = await app.request('/web/user-sessions/session-new');
    await expect(fresh.json()).resolves.toMatchObject({ session: { sessionId: 'session-new', resourceId: 'user-1' } });
    // A run's thread already names its Factory.
    const run = await app.request('/web/user-sessions/session-run');
    await expect(run.json()).resolves.toMatchObject({ session: { sessionId: 'session-run', resourceId: project.id } });
  });

  it("names the owner when a teammate opens someone else's session", async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const session = await sourceControl.sessions.create({
      sessionId: 'gitlab-session-teammate',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-2',
      branch: 'user/session-teammate',
      baseBranch: 'main',
      visibility: 'org',
    });
    const users = {
      getUser: async (id: string) =>
        id === 'user-2' ? { id, name: 'Ward Peeters', avatarUrl: 'https://x/w.png' } : null,
    };
    const app = buildApp([sourceControl], { ...seed, users });

    const opened = await app.request(`/web/user-sessions/${session.sessionId}`);

    expect(opened.status).toBe(200);
    await expect(opened.json()).resolves.toMatchObject({
      session: { userId: 'user-2', owner: { id: 'user-2', name: 'Ward Peeters', avatarUrl: 'https://x/w.png' } },
    });
  });

  it('creates a session through the provider-neutral project route', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const app = buildApp([sourceControl], seed);
    const sessionId = '11111111-1111-4111-8111-111111111111';

    const response = await app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, title: 'Build GitLab issue' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: {
        sessionId,
        projectRepositoryId: projectRepository.id,
        branch: `user/session-${sessionId}`,
        baseBranch: 'main',
        title: 'Build GitLab issue',
      },
    });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      projectRepositoryId: projectRepository.id,
    });
  });

  it('starts the conversation on the session thread so the first prompt can be sent right away', async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    const controller = new AgentController<MastraCodeState>({
      id: 'code',
      stateSchema,
      storage: new InMemoryStore({ id: 'factory-user-session-start' }),
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({
            id: 'test-agent',
            name: 'Test agent',
            instructions: 'Test.',
            model: { id: 'openai/gpt-5.5' },
          }),
        },
      ],
    });
    await controller.init();
    const app = buildApp([sourceControl], seed, controller);
    const sessionId = '22222222-2222-4222-8222-222222222222';
    const create = () =>
      app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, title: 'First prompt' }),
      });

    expect((await create()).status).toBe(200);
    // A retried create (the draft resubmitting the same id) must not start a second conversation.
    expect((await create()).status).toBe(200);

    const live = await controller.getSession(sessionId);
    expect(live?.thread.getId()).toBe(sessionId);
    expect(live?.state.get()).toMatchObject({
      factoryOrgId: 'org-1',
      factoryProjectId: project.id,
      projectRepositoryId: projectRepository.id,
    });
    // A user session runs under its owner's resource.
    const threads = await controller.queryThreads({ resourceId: 'user-1' });
    expect(threads.map(thread => thread.id)).toEqual([sessionId]);
  });

  it('stamps the factory of the link on the session it creates', async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    const app = buildApp([sourceControl], seed);
    const response = await app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    const { session } = (await response.json()) as { session: { sessionId: string } };
    await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
      factoryProjectId: project.id,
    });
  });

  it.each(['-feature', 'topic..fix', 'topic/', 'topic//fix', 'topic.lock'])(
    'rejects invalid ref %s before creating a session',
    async branch => {
      const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
      const app = buildApp([sourceControl], seed);
      const sessionId = '22222222-2222-4222-8222-222222222222';

      const response = await app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, branch }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid branch' });
      await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toBeNull();
    },
  );

  it('keeps the legacy GitHub project URL as a compatibility alias', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    await sourceControl.sessions.create({
      sessionId: 'gitlab-session-legacy-alias',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/issue-2',
      baseBranch: 'main',
      visibility: 'org',
    });
    const app = buildApp([sourceControl], seed);

    const response = await app.request(`/web/github/projects/${projectRepository.id}/sessions`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sessions: [expect.objectContaining({ sessionId: 'gitlab-session-legacy-alias' })],
    });
  });

  it("lists a Factory's sessions across every link and provider partition", async () => {
    const { seed, sourceControl: gitlab, projectRepository: gitlabLink, project } = await seedGitLabRepository();
    const github = seed.sourceControl.forIntegration('github');
    const installation = await github.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'install-1',
    });
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '1', slug: 'octocat/hello', defaultBranch: 'main' },
    });
    const connection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const githubLink = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/hello',
    });
    const other = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Other' } });
    const otherConnection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: other.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const otherLink = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: otherConnection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/other',
    });
    const session = (sessionId: string, projectRepositoryId: string, userId: string, visibility: 'org' | 'private') =>
      ({
        sessionId,
        projectRepositoryId,
        orgId: 'org-1',
        userId,
        branch: `user/${sessionId}`,
        baseBranch: 'main',
        visibility,
      }) as const;
    await gitlab.sessions.create(session('on-gitlab', gitlabLink.id, 'user-2', 'org'));
    await github.sessions.create(session('on-github', githubLink.id, 'user-1', 'org'));
    await github.sessions.create(session('mine-private', githubLink.id, 'user-1', 'private'));
    await github.sessions.create(session('their-private', githubLink.id, 'user-2', 'private'));
    await github.sessions.create(session('other-factory', otherLink.id, 'user-1', 'org'));
    const app = buildApp([github, gitlab], seed);

    const listed = await app.request(`/web/factory/projects/${project.id}/sessions`);

    expect(listed.status).toBe(200);
    const { sessions } = (await listed.json()) as { sessions: Array<{ sessionId: string }> };
    expect(sessions.map(row => row.sessionId).sort()).toEqual(['mine-private', 'on-github', 'on-gitlab']);
  });

  it("does not list sessions of a Factory outside the caller's organization", async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    await sourceControl.sessions.create({
      sessionId: 'gitlab-session-org-1',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/issue-3',
      baseBranch: 'main',
      visibility: 'org',
    });
    const foreign = await seed.projects.create({ orgId: 'org-2', userId: 'user-9', input: { name: 'Foreign' } });
    const app = buildApp([sourceControl], seed);

    const response = await app.request(`/web/factory/projects/${foreign.id}/sessions`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Factory not found' });
  });
});

describe('session sandbox recreate', () => {
  type Coordinator = { recreateSessionSandbox: ReturnType<typeof vi.fn> };

  function fakeCoordinator(
    impl: () => Promise<'recreated' | 'not-found'> = async () => 'recreated',
  ): Coordinator & SessionRetirementCoordinator {
    return { recreateSessionSandbox: vi.fn(impl) } as unknown as Coordinator & SessionRetirementCoordinator;
  }

  function fakeLiveRun(active: () => boolean) {
    const live = { stream: { isActive: vi.fn(active) }, abort: vi.fn() };
    const controller = {
      getSession: vi.fn(async () => live),
    } as unknown as NonNullable<RouteOptions['controller']>;
    return { live, controller };
  }

  function buildRecreateApp(
    seed: Pick<RouteOptions, 'memorySettings' | 'projects'>,
    sourceControl: SourceControlStorageHandle,
    options: {
      sessionRetirement?: SessionRetirementCoordinator;
      sandboxRecreateSupported?: boolean;
      isOrganizationAdmin?: (orgId: string, userId: string) => Promise<boolean>;
      controller?: RouteOptions['controller'];
      abortSettleTimeoutMs?: number;
      caller?: { workosId: string; organizationId: string };
      filesystem?: RouteOptions['filesystem'];
    } = {},
  ) {
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, (options.caller ?? user) as never);
      await next();
    });
    mountApiRoutes(
      app as never,
      buildSourceControlSessionRoutes({
        auth: fakeRouteAuth({ isOrganizationAdmin: options.isOrganizationAdmin ?? (async () => false) }),
        sourceControls: [sourceControl],
        projects: seed.projects,
        memorySettings: seed.memorySettings,
        ...(options.controller ? { controller: options.controller } : {}),
        ...(options.sessionRetirement ? { sessionRetirement: options.sessionRetirement } : {}),
        sandboxRecreateSupported: options.sandboxRecreateSupported ?? true,
        ...(options.abortSettleTimeoutMs !== undefined ? { abortSettleTimeoutMs: options.abortSettleTimeoutMs } : {}),
        ...(options.filesystem ? { filesystem: options.filesystem } : {}),
      }),
    );
    return app;
  }

  async function seedRecreateSession(owner = 'user-1', visibility: 'org' | 'private' = 'org') {
    const repo = await seedGitLabRepository();
    const session = await repo.sourceControl.sessions.create({
      sessionId: `recreate-${owner}-${visibility}`,
      projectRepositoryId: repo.projectRepository.id,
      orgId: 'org-1',
      userId: owner,
      branch: 'user/session-recreate',
      baseBranch: 'main',
      visibility,
    });
    return { ...repo, session };
  }

  const recreatePath = (sessionId: string) => `/web/user-sessions/${sessionId}/sandbox/recreate`;

  it('recreates the owner session with the public session id, without an admin check', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const sessionRetirement = fakeCoordinator();
    const isOrganizationAdmin = vi.fn(async () => true);
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, isOrganizationAdmin });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recreated: true, aborted: false });
    expect(sessionRetirement.recreateSessionSandbox).toHaveBeenCalledWith({
      sourceControl,
      orgId: 'org-1',
      sessionId: session.sessionId,
    });
    expect(isOrganizationAdmin).not.toHaveBeenCalled();
  });

  it('aborts an active run and recreates only after it stops', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    let active = true;
    const { live, controller } = fakeLiveRun(() => active);
    live.abort.mockImplementation(() => {
      setTimeout(() => {
        active = false;
      }, 120);
    });
    const sessionRetirement = fakeCoordinator(async () => {
      expect(active).toBe(false);
      return 'recreated';
    });
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, controller });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recreated: true, aborted: true });
    expect(controller.getSession).toHaveBeenCalledWith(session.sessionId);
    expect(live.abort).toHaveBeenCalledTimes(1);
    expect(sessionRetirement.recreateSessionSandbox).toHaveBeenCalledTimes(1);
  });

  it('still recreates when the aborted run never settles within the bound', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const { live, controller } = fakeLiveRun(() => true);
    const sessionRetirement = fakeCoordinator();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, controller, abortSettleTimeoutMs: 120 });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recreated: true, aborted: true });
    expect(live.abort).toHaveBeenCalledTimes(1);
    expect(sessionRetirement.recreateSessionSandbox).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[Factory Sessions] Aborted run did not settle before sandbox recreate', {
      sessionId: session.sessionId,
    });
  });

  it('still recreates when aborting the run throws', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const controller = {
      getSession: vi.fn(async () => {
        throw new Error('controller unavailable');
      }),
    } as unknown as NonNullable<RouteOptions['controller']>;
    const sessionRetirement = fakeCoordinator();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, controller });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recreated: true, aborted: false });
    expect(sessionRetirement.recreateSessionSandbox).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[Factory Sessions] Failed to abort the active run before sandbox recreate',
      expect.anything(),
    );
  });

  it('drains a pending filesystem capture before recreating', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const order: string[] = [];
    vi.mocked(waitForPendingFilesystemCapture).mockImplementationOnce(async resourceId => {
      await new Promise(resolve => setTimeout(resolve, 20));
      order.push(`drained:${resourceId}`);
    });
    const sessionRetirement = fakeCoordinator(async () => {
      order.push('recreate');
      return 'recreated';
    });
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    expect(order).toEqual([`drained:${session.sessionId}`, 'recreate']);
  });

  it('lets an org admin recreate a teammate org-visible session', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession('user-2');
    const sessionRetirement = fakeCoordinator();
    const isOrganizationAdmin = vi.fn(async () => true);
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, isOrganizationAdmin });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    expect(isOrganizationAdmin).toHaveBeenCalledWith('org-1', 'user-1');
    expect(sessionRetirement.recreateSessionSandbox).toHaveBeenCalledTimes(1);
  });

  it('forbids a non-owner who is not an org admin', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession('user-2');
    const sessionRetirement = fakeCoordinator();
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(403);
    expect(sessionRetirement.recreateSessionSandbox).not.toHaveBeenCalled();
  });

  it("hides another user's private session from an org admin", async () => {
    const { seed, sourceControl, session } = await seedRecreateSession('user-2', 'private');
    const sessionRetirement = fakeCoordinator();
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, isOrganizationAdmin: async () => true });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(404);
    expect(sessionRetirement.recreateSessionSandbox).not.toHaveBeenCalled();
  });

  it('returns 404 for a session in another organization', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const sessionRetirement = fakeCoordinator();
    const app = buildRecreateApp(seed, sourceControl, {
      sessionRetirement,
      isOrganizationAdmin: async () => true,
      caller: { workosId: 'user-1', organizationId: 'org-2' },
    });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(404);
    expect(sessionRetirement.recreateSessionSandbox).not.toHaveBeenCalled();
  });

  it('returns 503 and hides the capability on a local sandbox host', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const sessionRetirement = fakeCoordinator();
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, sandboxRecreateSupported: false });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Recreating sandboxes is not available on this server.' });
    expect(sessionRetirement.recreateSessionSandbox).not.toHaveBeenCalled();

    const opened = await app.request(`/web/user-sessions/${session.sessionId}`);
    const body = (await opened.json()) as { session: { capabilities: { recreateSandbox: boolean } } };
    expect(body.session.capabilities).toEqual({ recreateSandbox: false });
  });

  it('returns 503 when the server has no retirement coordinator', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const app = buildRecreateApp(seed, sourceControl);

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(503);
  });

  it('returns 500 with the message when the recreate fails', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const sessionRetirement = fakeCoordinator(async () => {
      throw new Error('provider unavailable');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => error.mockRestore());
    const filesystem = { deleteResourceFiles: vi.fn(async () => 0) };
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, filesystem });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'provider unavailable' });
    expect(filesystem.deleteResourceFiles).not.toHaveBeenCalled();
  });

  it('clears the captured file listings once the sandbox is recreated', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const order: string[] = [];
    const sessionRetirement = fakeCoordinator(async () => {
      order.push('recreate');
      return 'recreated';
    });
    const filesystem = {
      deleteResourceFiles: vi.fn(async ({ resourceId }: { resourceId: string }) => {
        order.push(`clear:${resourceId}`);
        return 2;
      }),
    };
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, filesystem });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    expect(order).toEqual(['recreate', `clear:${session.sessionId}`]);
  });

  it('still reports the recreate when clearing the file listings fails', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const sessionRetirement = fakeCoordinator();
    const filesystem = {
      deleteResourceFiles: vi.fn(async () => {
        throw new Error('db down');
      }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement, filesystem });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recreated: true, aborted: false });
    expect(warn).toHaveBeenCalledWith(
      '[Factory Sessions] Failed to clear file listings after sandbox recreate',
      expect.objectContaining({ sessionId: session.sessionId }),
    );
  });

  it('returns 404 when the coordinator no longer finds the session', async () => {
    const { seed, sourceControl, session } = await seedRecreateSession();
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement: fakeCoordinator(async () => 'not-found') });

    const response = await app.request(recreatePath(session.sessionId), { method: 'POST' });

    expect(response.status).toBe(404);
  });

  it.each([
    ['the owner', 'user-1', async () => false, true, true],
    ['an admin on an org session', 'user-2', async () => true, true, true],
    ['a non-owner non-admin', 'user-2', async () => false, true, false],
    ['anyone when there is no coordinator', 'user-1', async () => true, false, false],
  ] as const)(
    'reports session.capabilities.recreateSandbox on the session GET for %s',
    async (_label, owner, isOrganizationAdmin, withCoordinator, expected) => {
      const { seed, sourceControl, session } = await seedRecreateSession(owner);
      const app = buildRecreateApp(seed, sourceControl, {
        isOrganizationAdmin,
        ...(withCoordinator ? { sessionRetirement: fakeCoordinator() } : {}),
      });

      const opened = await app.request(`/web/user-sessions/${session.sessionId}`);

      expect(opened.status).toBe(200);
      const body = (await opened.json()) as Record<string, unknown> & {
        session: { sessionId: string; capabilities: { recreateSandbox: boolean } };
      };
      expect(body).not.toHaveProperty('capabilities');
      expect(body.session.sessionId).toBe(session.sessionId);
      expect(body.session.capabilities).toEqual({ recreateSandbox: expected });
    },
  );

  it('reports the capability on fresh and repeated session creates', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const app = buildRecreateApp(seed, sourceControl, { sessionRetirement: fakeCoordinator() });
    const sessionId = '33333333-3333-4333-8333-333333333333';
    const create = () =>
      app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

    for (const response of [await create(), await create()]) {
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        session: { sessionId, capabilities: { recreateSandbox: true } },
      });
    }
  });
});
