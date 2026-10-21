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

type Viewer = typeof user;

type RouteOptions = Parameters<typeof buildSourceControlSessionRoutes>[0];

function buildApp(
  sourceControls: readonly SourceControlStorageHandle[],
  { memorySettings, projects, users, audit }: Pick<RouteOptions, 'memorySettings' | 'projects' | 'users' | 'audit'>,
  controller?: RouteOptions['controller'],
  workItems?: RouteOptions['workItems'],
  viewer: Viewer | ((headers: Headers) => Viewer) = user,
  moveThread?: RouteOptions['moveThread'],
) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    const authUser = typeof viewer === 'function' ? viewer(context.req.raw.headers) : viewer;
    context.set('factoryAuthUser' as never, authUser as never);
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
      audit,
      ...(workItems ? { workItems } : {}),
      ...(moveThread ? { moveThread } : {}),
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

async function startOwnershipController(id: string) {
  const controller = new AgentController<MastraCodeState>({
    id,
    stateSchema,
    storage: new InMemoryStore({ id }),
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        agent: new Agent({
          id: 'test-agent',
          name: 'Test agent',
          instructions: 'Test Factory session ownership.',
          model: { id: 'openai/gpt-5.5' },
        }),
      },
    ],
  });
  await controller.init();
  return controller;
}

function takeOwnership(app: Hono, sessionId: string, expectedOwnerId: string, headers: Record<string, string> = {}) {
  return app.request(`/web/user-sessions/${sessionId}/owner`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ expectedOwnerId }),
  });
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

  it('refuses to change owner while the session is running', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const sessionId = 'factory-running-transfer';
    await sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/running-transfer',
      baseBranch: 'main',
      visibility: 'org',
    });
    const controller = await startOwnershipController('factory-running-transfer');
    const liveSession = await controller.createSession({ id: sessionId, resourceId: sessionId, ownerId: 'user-1' });
    const threadId = liveSession.thread.getId()!;
    vi.spyOn(controller, 'listActiveThreadRuns').mockReturnValue([{ runId: 'run-1', resourceId: sessionId, threadId }]);
    const audit = { record: vi.fn().mockResolvedValue(null) };
    const app = buildApp([sourceControl], { ...seed, audit }, controller, undefined, {
      workosId: 'user-2',
      organizationId: 'org-1',
    });

    const response = await takeOwnership(app, sessionId, 'user-1');
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Wait for the session to finish its run before taking ownership',
    });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({ userId: 'user-1' });
    await expect(liveSession.thread.getOwner()).resolves.toBe('user-1');
    expect(await controller.getSession(sessionId)).toBe(liveSession);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('takes org-visible ownership with DB CAS, mirrors the thread, audits, and recycles the live host', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const sessionId = 'factory-session-transfer';
    await sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/owner-transfer',
      baseBranch: 'main',
      visibility: 'org',
    });
    const controller = await startOwnershipController('factory-owner-transfer');
    const liveSession = await controller.createSession({ id: sessionId, resourceId: sessionId, ownerId: 'user-1' });
    const threadId = liveSession.thread.getId()!;
    const audit = { record: vi.fn().mockResolvedValue(null) };
    const app = buildApp([sourceControl], { ...seed, audit }, controller, undefined, {
      workosId: 'user-2',
      organizationId: 'org-1',
    });

    const response = await takeOwnership(app, sessionId, 'user-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { userId: 'user-2', createdByUserId: 'user-1' },
    });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      userId: 'user-2',
      createdByUserId: 'user-1',
    });
    await expect(controller.queryThreadById({ threadId })).resolves.toMatchObject({
      metadata: expect.objectContaining({ ownerId: 'user-2', createdBy: 'user-1' }),
    });
    expect(await controller.getSession(sessionId)).toBeUndefined();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-2',
        action: 'factory.session.owner_transferred',
        metadata: { fromOwnerId: 'user-1', toOwnerId: 'user-2', createdByUserId: 'user-1' },
      }),
    );

    const stale = await takeOwnership(app, sessionId, 'user-1');
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: 'Someone else owns this session now',
      reason: 'stale_owner',
      currentOwnerId: 'user-2',
    });
  });

  it('serializes overlapping transfers so the thread never ends on an older owner', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const sessionId = 'factory-overlapping-transfer';
    await sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/overlapping-transfer',
      baseBranch: 'main',
      visibility: 'org',
    });
    const controller = await startOwnershipController('factory-overlapping-transfer');
    await controller.createSession({ id: sessionId, resourceId: sessionId, ownerId: 'user-1', threadId: sessionId });
    // The first transfer stalls between its row write and its thread mirror, where a second one could overtake it.
    const getSession = controller.getSession.bind(controller);
    vi.spyOn(controller, 'getSession').mockImplementationOnce(async input => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return getSession(input);
    });
    const app = buildApp([sourceControl], seed, controller, undefined, headers => ({
      workosId: headers.get('x-viewer')!,
      organizationId: 'org-1',
    }));

    const [first, second] = await Promise.all([
      takeOwnership(app, sessionId, 'user-1', { 'x-viewer': 'user-2' }),
      takeOwnership(app, sessionId, 'user-2', { 'x-viewer': 'user-3' }),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({ userId: 'user-3' });
    await expect(controller.queryThreadById({ threadId: sessionId })).resolves.toMatchObject({
      metadata: expect.objectContaining({ ownerId: 'user-3', createdBy: 'user-1' }),
    });
    expect(await controller.getSession(sessionId)).toBeUndefined();
  });

  it('treats acquisition by the current owner as a CAS-checked no-op', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const session = await sourceControl.sessions.create({
      sessionId: 'factory-same-owner-session',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/same-owner-session',
      baseBranch: 'main',
      visibility: 'org',
    });
    const controller = await startOwnershipController('factory-same-owner-transfer');
    const liveSession = await controller.createSession({
      id: session.sessionId,
      resourceId: session.sessionId,
      ownerId: 'user-1',
    });
    const initialUpdatedAt = session.updatedAt;
    const transferOwner = vi.spyOn(sourceControl.sessions, 'transferOwner');
    const mirrorOwner = vi.spyOn(liveSession.thread, 'transferOwnership');
    const createSession = vi.spyOn(controller, 'createSession');
    const deleteSession = vi.spyOn(controller, 'deleteSession');
    const audit = { record: vi.fn().mockResolvedValue(null) };
    const app = buildApp([sourceControl], { ...seed, audit }, controller, undefined, {
      workosId: 'user-1',
      organizationId: 'org-1',
    });

    const response = await takeOwnership(app, session.sessionId, 'user-1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ session: { userId: 'user-1' } });
    expect(transferOwner).toHaveBeenCalledWith({
      sessionId: session.sessionId,
      expectedUserId: 'user-1',
      toUserId: 'user-1',
    });
    await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
      userId: 'user-1',
      updatedAt: initialUpdatedAt,
    });
    expect(mirrorOwner).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(await controller.getSession(session.sessionId)).toBe(liveSession);

    await sourceControl.sessions.transferOwner({
      sessionId: session.sessionId,
      expectedUserId: 'user-1',
      toUserId: 'user-2',
    });
    const staleResponse = await takeOwnership(app, session.sessionId, 'user-1');
    expect(staleResponse.status).toBe(409);
    await expect(staleResponse.json()).resolves.toMatchObject({ currentOwnerId: 'user-2', reason: 'stale_owner' });
  });

  it('starts the session as its new owner when nobody is live, stamps the thread, and recycles it', async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    const sessionId = 'factory-cold-transfer';
    await sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/cold-transfer',
      baseBranch: 'main',
      visibility: 'org',
    });
    const controller = await startOwnershipController('factory-cold-transfer');
    const app = buildApp([sourceControl], seed, controller, undefined, { workosId: 'user-2', organizationId: 'org-1' });

    const response = await takeOwnership(app, sessionId, 'user-1');
    expect(response.status).toBe(200);
    await expect(controller.queryThreadById({ threadId: sessionId })).resolves.toMatchObject({
      resourceId: project.id,
      metadata: expect.objectContaining({ ownerId: 'user-2' }),
    });
    expect(await controller.getSession(sessionId)).toBeUndefined();
  });

  it('rejects takeover of an org-visible session from another organization', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const session = await sourceControl.sessions.create({
      sessionId: 'factory-cross-org-session',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/cross-org-session',
      baseBranch: 'main',
      visibility: 'org',
    });
    const app = buildApp([sourceControl], seed, undefined, undefined, { workosId: 'user-2', organizationId: 'org-2' });
    const response = await takeOwnership(app, session.sessionId, 'user-1');
    expect(response.status).toBe(404);
    await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('rejects takeover of a private session by another org member', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const session = await sourceControl.sessions.create({
      sessionId: 'factory-private-session',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/private-session',
      baseBranch: 'main',
      visibility: 'private',
    });
    const app = buildApp([sourceControl], seed, undefined, undefined, { workosId: 'user-2', organizationId: 'org-1' });
    const response = await takeOwnership(app, session.sessionId, 'user-1');
    expect(response.status).toBe(404);
    await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
      userId: 'user-1',
      createdByUserId: 'user-1',
    });
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
    await sourceControl.sessions.create({
      sessionId: 'session-private',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-session-private',
      baseBranch: 'main',
      visibility: 'private',
    });
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

    // A session with no thread yet starts where its visibility puts it: a shared one under its Factory,
    // a private one under its owner.
    const fresh = await app.request('/web/user-sessions/session-new');
    await expect(fresh.json()).resolves.toMatchObject({
      session: { sessionId: 'session-new', resourceId: project.id },
    });
    const personal = await app.request('/web/user-sessions/session-private');
    await expect(personal.json()).resolves.toMatchObject({
      session: { sessionId: 'session-private', resourceId: 'user-1' },
    });
    // A run's thread already names its Factory.
    const run = await app.request('/web/user-sessions/session-run');
    await expect(run.json()).resolves.toMatchObject({ session: { sessionId: 'session-run', resourceId: project.id } });
  });

  it("hides a shared-looking session from teammates while its conversation is on its owner's memory", async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    for (const sessionId of ['legacy-shared', 'moved-shared']) {
      await sourceControl.sessions.create({
        sessionId,
        projectRepositoryId: projectRepository.id,
        factoryProjectId: project.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: `user/session-${sessionId}`,
        baseBranch: 'main',
        visibility: 'org',
      });
    }
    // Created before sharing moved threads: still on its owner's resource.
    const threads: Record<string, { id: string; resourceId: string }> = {
      'legacy-shared': { id: 'legacy-shared', resourceId: 'user-1' },
      'moved-shared': { id: 'moved-shared', resourceId: project.id },
    };
    const controller = {
      queryThreadById: async ({ threadId }: { threadId: string }) => threads[threadId] ?? null,
    } as unknown as RouteOptions['controller'];
    const noRuns = { clearSessionReferences: async () => 0, hasRunBindingForSession: async () => false };
    const owner = buildApp([sourceControl], seed, controller, noRuns);
    const teammate = buildApp([sourceControl], seed, controller, noRuns, {
      workosId: 'user-2',
      organizationId: 'org-1',
    });

    expect((await teammate.request('/web/user-sessions/legacy-shared')).status).toBe(404);
    expect((await owner.request('/web/user-sessions/legacy-shared')).status).toBe(200);
    expect((await teammate.request('/web/user-sessions/moved-shared')).status).toBe(200);
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

  it('creates a private session through the provider-neutral project route when asked', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const app = buildApp([sourceControl], seed);
    const sessionId = '11111111-1111-4111-8111-111111111111';

    const response = await app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, title: 'Build GitLab issue', visibility: 'private' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: {
        sessionId,
        projectRepositoryId: projectRepository.id,
        branch: `user/session-${sessionId}`,
        baseBranch: 'main',
        title: 'Build GitLab issue',
        visibility: 'private',
      },
    });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      projectRepositoryId: projectRepository.id,
      visibility: 'private',
    });
    await expect(
      sourceControl.sessions.list({ projectRepositoryId: projectRepository.id, viewerUserId: 'user-2' }),
    ).resolves.toEqual([]);
  });

  it('creates sessions shared with the org unless asked for private, and rejects unknown visibility', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const app = buildApp([sourceControl], seed);
    const create = (body: Record<string, unknown>) =>
      app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    const shared = await create({ branch: 'factory/card-7' });
    expect(shared.status).toBe(200);
    const { session } = (await shared.json()) as { session: { sessionId: string; visibility: string } };
    expect(session.visibility).toBe('org');
    await expect(
      sourceControl.sessions.list({ projectRepositoryId: projectRepository.id, viewerUserId: 'user-2' }),
    ).resolves.toEqual([expect.objectContaining({ sessionId: session.sessionId })]);

    expect((await create({ branch: 'factory/card-8', visibility: 'public' })).status).toBe(400);
  });

  it('starts a session created shared on its Factory resource, so teammates can reach its memory', async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    const controller = new AgentController<MastraCodeState>({
      id: 'code',
      stateSchema,
      storage: new InMemoryStore({ id: 'factory-shared-session-start' }),
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
    const res = await app.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ branch: 'factory/card-9', visibility: 'org' }),
    });
    const { session } = (await res.json()) as { session: { sessionId: string } };

    await expect(controller.queryThreadById({ threadId: session.sessionId })).resolves.toMatchObject({
      resourceId: project.id,
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
        body: JSON.stringify({ sessionId, title: 'First prompt', visibility: 'private' }),
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

  describe('PUT /web/user-sessions/:sessionId/visibility', () => {
    const teammate = { workosId: 'user-2', organizationId: 'org-1' };
    const noRuns: RouteOptions['workItems'] = {
      clearSessionReferences: async () => 0,
      hasRunBindingForSession: async () => false,
    };
    const putVisibility = (app: Hono, sessionId: string, body: unknown) =>
      app.request(`/web/user-sessions/${sessionId}/visibility`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    async function seedPrivateSession(overrides: { branch?: string; visibility?: 'org' | 'private' } = {}) {
      const seeded = await seedGitLabRepository();
      const session = await seeded.sourceControl.sessions.create({
        sessionId: 'visibility-session',
        projectRepositoryId: seeded.projectRepository.id,
        factoryProjectId: seeded.project.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: overrides.branch ?? 'user/session-visibility',
        baseBranch: 'main',
        visibility: overrides.visibility ?? 'private',
      });
      return { ...seeded, session };
    }

    it('lets the owner share a private session with the org and make it private again', async () => {
      const { seed, sourceControl, projectRepository, session } = await seedPrivateSession();
      const owner = buildApp([sourceControl], seed, undefined, noRuns);
      const viewer = buildApp([sourceControl], seed, undefined, noRuns, teammate);
      expect(session.visibility).toBe('private');
      expect((await viewer.request(`/web/user-sessions/${session.sessionId}`)).status).toBe(404);

      const shared = await putVisibility(owner, session.sessionId, { visibility: 'org' });
      expect(shared.status).toBe(200);
      await expect(shared.json()).resolves.toMatchObject({
        session: { sessionId: session.sessionId, visibility: 'org' },
      });
      expect((await viewer.request(`/web/user-sessions/${session.sessionId}`)).status).toBe(200);
      await expect(
        sourceControl.sessions.list({ projectRepositoryId: projectRepository.id, viewerUserId: 'user-2' }),
      ).resolves.toEqual([expect.objectContaining({ sessionId: session.sessionId })]);

      const unshared = await putVisibility(owner, session.sessionId, { visibility: 'private' });
      expect(unshared.status).toBe(200);
      expect((await viewer.request(`/web/user-sessions/${session.sessionId}`)).status).toBe(404);
    });

    it('404s non-owners, including teammates who can see an org session', async () => {
      const { seed, sourceControl, session } = await seedPrivateSession();
      await sourceControl.sessions.setVisibility({ sessionId: session.sessionId, visibility: 'org' });
      const viewer = buildApp([sourceControl], seed, undefined, noRuns, teammate);

      const res = await putVisibility(viewer, session.sessionId, { visibility: 'private' });
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: 'Session not found' });
      await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
        visibility: 'org',
      });
    });

    it("moves the session's threads onto the Factory when shared and back to the owner when made private", async () => {
      const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
      const storage = new InMemoryStore({ id: 'factory-visibility-move' });
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
              instructions: 'Test.',
              model: { id: 'openai/gpt-5.5' },
            }),
          },
        ],
      });
      await controller.init();
      const memory = (await storage.getStore('memory'))!;
      const owner = buildApp([sourceControl], seed, controller, noRuns, user, input =>
        memory.updateThreadResourceId(input),
      );
      const sessionId = '33333333-3333-4333-8333-333333333333';
      const created = await owner.request(`/web/source-control/projects/${projectRepository.id}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, title: 'Shared later', visibility: 'private' }),
      });
      expect(created.status).toBe(200);
      // A thread the session opened, stamped with its id, moves along with its own thread.
      await memory.saveThread({
        thread: {
          id: 'opened-thread',
          resourceId: 'user-1',
          title: 'Opened',
          metadata: { factorySessionId: sessionId },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      // Another of the owner's threads stays with the owner.
      await memory.saveThread({
        thread: { id: 'unrelated', resourceId: 'user-1', title: 'Other', createdAt: new Date(), updatedAt: new Date() },
      });
      const resources = async () =>
        Object.fromEntries(
          await Promise.all(
            [sessionId, 'opened-thread', 'unrelated'].map(
              async id => [id, (await controller.queryThreadById({ threadId: id }))?.resourceId] as const,
            ),
          ),
        );
      expect(await resources()).toEqual({ [sessionId]: 'user-1', 'opened-thread': 'user-1', unrelated: 'user-1' });

      expect((await putVisibility(owner, sessionId, { visibility: 'org' })).status).toBe(200);
      expect(await resources()).toEqual({ [sessionId]: project.id, 'opened-thread': project.id, unrelated: 'user-1' });
      // The live session started on the owner's resource; it resumes on the Factory's from its thread.
      expect(await controller.getSession(sessionId)).toBeUndefined();

      expect((await putVisibility(owner, sessionId, { visibility: 'private' })).status).toBe(200);
      expect(await resources()).toEqual({ [sessionId]: 'user-1', 'opened-thread': 'user-1', unrelated: 'user-1' });

      // Share again, then fail making it private halfway: the row must not say private while a thread
      // is still on the Factory, and a retry finishes the move.
      expect((await putVisibility(owner, sessionId, { visibility: 'org' })).status).toBe(200);
      let moves = 0;
      const failing = buildApp([sourceControl], seed, controller, noRuns, user, async input => {
        if (++moves === 2) throw new Error('storage unavailable');
        return memory.updateThreadResourceId(input);
      });
      expect((await putVisibility(failing, sessionId, { visibility: 'private' })).status).toBe(500);
      await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({ visibility: 'org' });
      expect(Object.values(await resources()).filter(resource => resource === project.id)).toHaveLength(1);

      expect((await putVisibility(owner, sessionId, { visibility: 'private' })).status).toBe(200);
      await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({ visibility: 'private' });
      expect(await resources()).toEqual({ [sessionId]: 'user-1', 'opened-thread': 'user-1', unrelated: 'user-1' });
    });

    it('refuses to change visibility while the session is running', async () => {
      const { seed, sourceControl, session } = await seedPrivateSession();
      const controller = {
        queryThreadById: async ({ threadId }: { threadId: string }) =>
          threadId === session.sessionId ? { id: threadId, resourceId: 'user-1' } : null,
        queryThreads: async () => [],
        listActiveThreadRuns: () => [{ runId: 'run-1', resourceId: 'user-1', threadId: session.sessionId }],
      } as unknown as RouteOptions['controller'];
      const moveThread = vi.fn(async () => undefined);
      const owner = buildApp([sourceControl], seed, controller, noRuns, user, moveThread);

      const res = await putVisibility(owner, session.sessionId, { visibility: 'org' });
      expect(res.status).toBe(409);
      expect(moveThread).not.toHaveBeenCalled();
      await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
        visibility: 'private',
      });
    });

    it('rejects an unknown visibility value', async () => {
      const { seed, sourceControl, session } = await seedPrivateSession();
      const res = await putVisibility(buildApp([sourceControl], seed, undefined, noRuns), session.sessionId, {
        visibility: 'public',
      });
      expect(res.status).toBe(400);
      await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
        visibility: 'private',
      });
    });

    it('refuses to change a Factory run session, which stays with the team', async () => {
      const { seed, sourceControl, session } = await seedPrivateSession({
        branch: 'feature/card-42',
        visibility: 'org',
      });
      const runSessions = new Set([session.sessionId]);
      const owner = buildApp([sourceControl], seed, undefined, {
        clearSessionReferences: async () => 0,
        hasRunBindingForSession: async ({ sessionId }) => runSessions.has(sessionId),
      });

      const res = await putVisibility(owner, session.sessionId, { visibility: 'private' });
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toEqual({ error: 'Only user sessions can change visibility' });
      await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
        visibility: 'org',
      });
    });

    it('answers 503 and leaves the session alone while work-item storage is not ready', async () => {
      const { seed, sourceControl, session } = await seedPrivateSession();

      const res = await putVisibility(buildApp([sourceControl], seed), session.sessionId, { visibility: 'org' });

      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toEqual({
        error: "Session visibility can't be changed yet: Factory storage is still starting up. Try again in a moment.",
      });
      await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
        visibility: 'private',
      });
    });

    it("refuses to share a session that isn't linked to a Factory", async () => {
      const { seed, sourceControl, session } = await seedPrivateSession();
      // Only rows the project backfill couldn't resolve have no Factory; new sessions always do.
      await seed.storage.ops.updateMany(
        'source_control_sessions',
        { session_id: session.sessionId },
        { factory_project_id: null },
      );

      const res = await putVisibility(buildApp([sourceControl], seed, undefined, noRuns), session.sessionId, {
        visibility: 'org',
      });
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toEqual({
        error: "This session isn't linked to a Factory, so it can't be shared.",
      });
      await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
        visibility: 'private',
      });
    });

    it('refuses to change a Slack thread session', async () => {
      const { seed, sourceControl, session } = await seedPrivateSession({
        branch: 'slack/1700000000-000100',
        visibility: 'org',
      });

      const res = await putVisibility(buildApp([sourceControl], seed, undefined, noRuns), session.sessionId, {
        visibility: 'private',
      });
      expect(res.status).toBe(409);
      await expect(sourceControl.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
        visibility: 'org',
      });
    });
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

  describe('starting a sandbox from the Files tab', () => {
    const startPath = (sessionId: string) => `/web/user-sessions/${sessionId}/sandbox/start`;

    function fakeController(live: { getWorkspace: () => unknown } | null, created = live) {
      const setState = vi.fn();
      return {
        setState,
        getSession: vi.fn(async () => live),
        createSession: vi.fn(async () => ({ ...created, state: { get: () => ({}), set: setState } })),
        queryThreadById: vi.fn(async () => null),
      } as unknown as NonNullable<RouteOptions['controller']> & {
        createSession: ReturnType<typeof vi.fn>;
        setState: ReturnType<typeof vi.fn>;
      };
    }

    it("starts the live session's sandbox", async () => {
      const { seed, sourceControl, session } = await seedRecreateSession();
      const start = vi.fn(async () => {});
      const controller = fakeController({ getWorkspace: () => ({ sandbox: { start } }) });
      const app = buildRecreateApp(seed, sourceControl, { controller });

      const response = await app.request(startPath(session.sessionId), { method: 'POST' });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ started: true });
      expect(start).toHaveBeenCalledTimes(1);
      expect(controller.createSession).not.toHaveBeenCalled();
    });

    it('brings an offline session online as its owner first', async () => {
      const { seed, sourceControl, session } = await seedRecreateSession('user-1');
      const start = vi.fn(async () => {});
      const controller = fakeController(null, { getWorkspace: () => ({ sandbox: { start } }) });
      const app = buildRecreateApp(seed, sourceControl, { controller });

      const response = await app.request(startPath(session.sessionId), { method: 'POST' });

      expect(response.status).toBe(200);
      const created = controller.createSession.mock.calls[0]![0];
      expect(created).toMatchObject({ id: session.sessionId, threadId: session.sessionId, ownerId: 'user-1' });
      expect(created.requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
      // The session's Factory address is seeded, same as when the page starts the conversation.
      expect(controller.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          factoryProjectId: session.factoryProjectId,
          projectRepositoryId: session.projectRepositoryId,
        }),
      );
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('forbids a non-owner who is not an org admin', async () => {
      const { seed, sourceControl, session } = await seedRecreateSession('someone-else');
      const start = vi.fn(async () => {});
      const controller = fakeController({ getWorkspace: () => ({ sandbox: { start } }) });
      const app = buildRecreateApp(seed, sourceControl, { controller });

      const response = await app.request(startPath(session.sessionId), { method: 'POST' });

      expect(response.status).toBe(403);
      expect(start).not.toHaveBeenCalled();
    });

    it('returns 500 with the message when the start fails', async () => {
      const { seed, sourceControl, session } = await seedRecreateSession();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      onTestFinished(() => error.mockRestore());
      const controller = fakeController({
        getWorkspace: () => ({
          sandbox: {
            start: async () => {
              throw new Error('setup failed');
            },
          },
        }),
      });
      const app = buildRecreateApp(seed, sourceControl, { controller });

      const response = await app.request(startPath(session.sessionId), { method: 'POST' });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: 'setup failed' });
    });
  });

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
