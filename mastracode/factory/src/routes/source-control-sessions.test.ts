import { gunzipSync } from 'node:zlib';

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

type RouteOptions = Parameters<typeof buildSourceControlSessionRoutes>[0];

function buildApp(
  sourceControls: readonly SourceControlStorageHandle[],
  { memorySettings, projects, users }: Pick<RouteOptions, 'memorySettings' | 'projects' | 'users'>,
  controller?: RouteOptions['controller'],
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
    const app = buildApp([sourceControl], seed, controller);
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

describe('Factory sessions list (compact + incremental sync)', () => {
  const ownerAvatar = (id: string) => `https://workoscdn.com/images/v1/${id}/${'a'.repeat(96)}`;
  const users = {
    getUser: async (id: string) => ({ id, name: `Name of ${id}`, avatarUrl: ownerAvatar(id) }),
  };
  const sessionRow = (
    projectRepositoryId: string,
    index: number,
    overrides: { visibility?: 'org' | 'private'; userId?: string } = {},
  ) =>
    ({
      sessionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      projectRepositoryId,
      orgId: 'org-1',
      userId: overrides.userId ?? (index % 2 === 0 ? 'user-1' : 'user-2'),
      branch: index % 3 === 0 ? `factory/issue-${index}` : `user/session-${index}`,
      baseBranch: 'main',
      visibility: overrides.visibility ?? 'org',
    }) as const;

  type CompactBody = {
    sessions: Array<Record<string, unknown> & { sessionId: string; userId: string }>;
    owners: Record<string, { name: string; avatarUrl?: string }>;
    total: number;
    syncedAt: string;
  };

  it('sends each listed session once with its owner in a shared map, gzip-compressed', async () => {
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    for (let index = 0; index < 60; index += 1) {
      await sourceControl.sessions.create(sessionRow(projectRepository.id, index));
    }
    await sourceControl.sessions.create(
      sessionRow(projectRepository.id, 99, { visibility: 'private', userId: 'user-2' }),
    );
    const app = buildApp([sourceControl], { ...seed, users });

    const legacy = await app.request(`/web/factory/projects/${project.id}/sessions`);
    const legacyBytes = (await legacy.arrayBuffer()).byteLength;
    const compact = await app.request(`/web/factory/projects/${project.id}/sessions?compact=1`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });

    expect(compact.status).toBe(200);
    expect(compact.headers.get('content-encoding')).toBe('gzip');
    const compressed = new Uint8Array(await compact.arrayBuffer());
    const json = gunzipSync(compressed).toString('utf8');
    const body = JSON.parse(json) as CompactBody;
    expect(body.total).toBe(60);
    expect(body.sessions).toHaveLength(60);
    expect(Object.keys(body.sessions[0]!).sort()).toEqual(
      [
        'baseBranch',
        'branch',
        'createdAt',
        'id',
        'materializedAt',
        'projectRepositoryId',
        'sessionId',
        'title',
        'updatedAt',
        'userId',
        'visibility',
      ].sort(),
    );
    expect(body.owners).toEqual({
      'user-1': { name: 'Name of user-1', avatarUrl: ownerAvatar('user-1') },
      'user-2': { name: 'Name of user-2', avatarUrl: ownerAvatar('user-2') },
    });
    expect(json.split(ownerAvatar('user-1')).length - 1).toBe(1);
    // The owner map and dropped sandbox fields roughly halve the JSON; gzip takes it below a tenth.
    expect(json.length).toBeLessThan(legacyBytes * 0.6);
    expect(compressed.byteLength).toBeLessThan(legacyBytes * 0.1);
  });

  it('with updatedSince returns only sessions changed since the last sync, plus the visible total', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    onTestFinished(() => vi.useRealTimers());
    const { seed, sourceControl, projectRepository, project } = await seedGitLabRepository();
    const app = buildApp([sourceControl], { ...seed, users });
    const url = `/web/factory/projects/${project.id}/sessions?compact=1`;

    vi.setSystemTime(new Date('2026-10-01T10:00:00.000Z'));
    for (let index = 0; index < 20; index += 1) {
      await sourceControl.sessions.create(sessionRow(projectRepository.id, index));
    }
    vi.setSystemTime(new Date('2026-10-01T10:04:57.000Z'));
    const committedLate = await sourceControl.sessions.create(sessionRow(projectRepository.id, 20));
    vi.setSystemTime(new Date('2026-10-01T10:05:00.000Z'));
    const first = (await (await app.request(url)).json()) as CompactBody;
    expect(first.sessions).toHaveLength(21);
    expect(first.syncedAt).toBe('2026-10-01T10:05:00.000Z');

    vi.setSystemTime(new Date('2026-10-01T10:06:00.000Z'));
    const renamed = sessionRow(projectRepository.id, 4);
    await sourceControl.sessions.rename({ sessionId: renamed.sessionId, title: 'Renamed' });
    const created = await sourceControl.sessions.create(sessionRow(projectRepository.id, 21));
    await sourceControl.sessions.create(
      sessionRow(projectRepository.id, 22, { visibility: 'private', userId: 'user-2' }),
    );
    vi.setSystemTime(new Date('2026-10-01T10:07:00.000Z'));

    const sync = await app.request(`${url}&updatedSince=${encodeURIComponent(first.syncedAt)}`);

    expect(sync.status).toBe(200);
    const delta = (await sync.json()) as CompactBody;
    // Rows written in the seconds before the last sync are re-sent in case they committed after it.
    expect(delta.sessions.map(session => [session.sessionId, session.title])).toEqual([
      [committedLate.sessionId, null],
      [renamed.sessionId, 'Renamed'],
      [created.sessionId, null],
    ]);
    expect(Object.keys(delta.owners).sort()).toEqual(['user-1', 'user-2']);
    expect(delta.total).toBe(22);
    expect(delta.syncedAt).toBe('2026-10-01T10:07:00.000Z');
  });

  it('rejects an updatedSince that is not a timestamp', async () => {
    const { seed, sourceControl, project } = await seedGitLabRepository();
    const app = buildApp([sourceControl], seed);

    const response = await app.request(`/web/factory/projects/${project.id}/sessions?compact=1&updatedSince=yesterday`);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'updatedSince must be an ISO timestamp' });
  });
});
