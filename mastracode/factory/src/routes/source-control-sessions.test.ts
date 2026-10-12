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

const user = { workosId: 'user-1', organizationId: 'org-1' };

function buildApp(
  sourceControls: readonly SourceControlStorageHandle[],
  memorySettings: Parameters<typeof buildSourceControlSessionRoutes>[0]['memorySettings'],
  controller?: Parameters<typeof buildSourceControlSessionRoutes>[0]['controller'],
  routeUser = user,
  audit?: Parameters<typeof buildSourceControlSessionRoutes>[0]['audit'],
) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, routeUser as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    buildSourceControlSessionRoutes({
      auth: fakeRouteAuth(),
      sourceControls,
      memorySettings,
      controller,
      audit,
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
      await controller.deleteSession({ resourceId: sessionId });
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
    const app = buildApp([sourceControl], seed.memorySettings, controller);
    const response = await app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ title: 'Review change' });
    expect(queryThreads).toHaveBeenCalledWith({ resourceId: sessionId });
    expect(generateTitle).toHaveBeenCalledWith({
      threadId,
      resourceId: sessionId,
      requestContext: expect.any(RequestContext),
    });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      id: row.id,
      title: 'Review change',
    });
    await expect(sourceControl.sessions.getBySessionId(threadId)).resolves.toBeNull();
  });

  it('takes org-visible ownership with DB CAS, mirrors the thread, audits, and recycles after the active run', async () => {
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
    const controller = new AgentController<MastraCodeState>({
      id: 'code-owner-transfer',
      stateSchema,
      storage: new InMemoryStore({ id: 'factory-owner-transfer' }),
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
    const liveSession = await controller.createSession({
      id: sessionId,
      resourceId: sessionId,
      ownerId: 'user-1',
    });
    vi.spyOn(liveSession.stream, 'isActive').mockReturnValue(true);
    const audit = { record: vi.fn().mockResolvedValue(null) };
    const app = buildApp(
      [sourceControl],
      seed.memorySettings,
      controller,
      { workosId: 'user-2', organizationId: 'org-1' },
      audit,
    );

    const response = await app.request(`/web/user-sessions/${sessionId}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedOwnerId: 'user-1' }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { userId: 'user-2', createdByUserId: 'user-1' },
    });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      userId: 'user-2',
      createdByUserId: 'user-1',
    });
    await expect(liveSession.thread.getOwner()).resolves.toBe('user-2');
    expect(await controller.getSessionByResource(sessionId)).toBe(liveSession);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-2',
        action: 'factory.session.owner_transferred',
        metadata: { fromOwnerId: 'user-1', toOwnerId: 'user-2', createdByUserId: 'user-1' },
      }),
    );

    const stale = await app.request(`/web/user-sessions/${sessionId}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedOwnerId: 'user-1' }),
    });
    expect(stale.status).toBe(409);

    liveSession.emit({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(async () => {
      expect(await controller.getSessionByResource(sessionId)).toBeUndefined();
    });
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
    const controller = new AgentController<MastraCodeState>({
      id: 'code-same-owner-transfer',
      stateSchema,
      storage: new InMemoryStore({ id: 'factory-same-owner-transfer' }),
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({
            id: 'test-agent',
            name: 'Test agent',
            instructions: 'Test idempotent Factory session ownership.',
            model: { id: 'openai/gpt-5.5' },
          }),
        },
      ],
    });
    await controller.init();
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
    const app = buildApp(
      [sourceControl],
      seed.memorySettings,
      controller,
      { workosId: 'user-1', organizationId: 'org-1' },
      audit,
    );

    const response = await app.request(`/web/user-sessions/${session.sessionId}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedOwnerId: 'user-1' }),
    });

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
    expect(await controller.getSessionByResource(session.sessionId)).toBe(liveSession);

    await sourceControl.sessions.transferOwner({
      sessionId: session.sessionId,
      expectedUserId: 'user-1',
      toUserId: 'user-2',
    });
    const staleResponse = await app.request(`/web/user-sessions/${session.sessionId}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedOwnerId: 'user-1' }),
    });
    expect(staleResponse.status).toBe(409);
    await expect(staleResponse.json()).resolves.toMatchObject({ currentOwnerId: 'user-2', reason: 'stale_owner' });
  });

  it('recycles when an active run ends during the active-state check', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const sessionId = 'factory-idle-transfer';
    await sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/idle-transfer',
      baseBranch: 'main',
      visibility: 'org',
    });
    const controller = new AgentController<MastraCodeState>({
      id: 'code-idle-transfer',
      stateSchema,
      storage: new InMemoryStore({ id: 'factory-idle-transfer' }),
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({
            id: 'test-agent',
            name: 'Test agent',
            instructions: 'Test idle Factory session ownership.',
            model: { id: 'openai/gpt-5.5' },
          }),
        },
      ],
    });
    await controller.init();
    const liveSession = await controller.createSession({ id: sessionId, resourceId: sessionId, ownerId: 'user-1' });
    const threadId = liveSession.thread.getId()!;
    vi.spyOn(liveSession.stream, 'isActive').mockImplementation(() => {
      liveSession.emit({ type: 'agent_end', reason: 'complete' });
      return false;
    });
    const app = buildApp([sourceControl], seed.memorySettings, controller, {
      workosId: 'user-2',
      organizationId: 'org-1',
    });

    const response = await app.request(`/web/user-sessions/${sessionId}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedOwnerId: 'user-1' }),
    });
    expect(response.status).toBe(200);
    await vi.waitFor(async () => {
      expect(await controller.getSessionByResource(sessionId)).toBeUndefined();
    });
    await expect(controller.queryThreadById({ threadId })).resolves.toMatchObject({
      metadata: expect.objectContaining({ ownerId: 'user-2', createdBy: 'user-1' }),
    });
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
    const app = buildApp([sourceControl], seed.memorySettings, undefined, {
      workosId: 'user-2',
      organizationId: 'org-2',
    });
    const response = await app.request(`/web/user-sessions/${session.sessionId}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedOwnerId: 'user-1' }),
    });
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
    const app = buildApp([sourceControl], seed.memorySettings, undefined, {
      workosId: 'user-2',
      organizationId: 'org-1',
    });
    const response = await app.request(`/web/user-sessions/${session.sessionId}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedOwnerId: 'user-1' }),
    });
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
    const app = buildApp([sourceControl], seed.memorySettings);

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

  it('creates a session through the provider-neutral project route', async () => {
    const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
    const app = buildApp([sourceControl], seed.memorySettings);
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

  it.each(['-feature', 'topic..fix', 'topic/', 'topic//fix', 'topic.lock'])(
    'rejects invalid ref %s before creating a session',
    async branch => {
      const { seed, sourceControl, projectRepository } = await seedGitLabRepository();
      const app = buildApp([sourceControl], seed.memorySettings);
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
    const app = buildApp([sourceControl], seed.memorySettings);

    const response = await app.request(`/web/github/projects/${projectRepository.id}/sessions`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sessions: [expect.objectContaining({ sessionId: 'gitlab-session-legacy-alias' })],
    });
  });
});
