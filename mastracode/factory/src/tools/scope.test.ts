import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { createSourceControlSessionLookup } from '../session/factory-session.js';
import type { SourceControlSessionVisibility } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FACTORY_INTERACTIVE_KEY, FACTORY_SLACK_SENDER_KEY, resolveFactoryToolScope } from './scope.js';
import type { FactoryToolScope } from './scope.js';
import { createFactoryTools } from './index.js';

async function seedFactory(orgId = 'org-1') {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const project = await seed.projects.create({ orgId, userId: 'owner', input: { name: 'Mastra' } });
  const installation = await sourceControl.installations.upsert({ orgId, connectedByUserId: 'owner', externalId: '1' });
  const repository = await sourceControl.repositories.upsert({
    orgId,
    input: { installationId: installation.id, externalId: '2', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId,
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'owner',
  });
  const projectRepository = await sourceControl.projectRepositories.link({
    orgId,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'owner',
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox/mastra',
  });
  const createSession = (sessionId: string, userId: string, visibility: SourceControlSessionVisibility = 'org') =>
    sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      factoryProjectId: project.id,
      orgId,
      userId,
      branch: `user/${sessionId}`,
      baseBranch: 'main',
      visibility,
    });
  const sessions = createSourceControlSessionLookup([sourceControl]);
  const workItems = seed.workItems;
  /** Bind `sessionId` to a run on `threadId`, the way a role start does. */
  const bindRun = (sessionId: string, threadId: string) =>
    seed.workItems.prepareRunStart({
      orgId,
      userId: 'owner',
      factoryProjectId: project.id,
      workItem: { input: { title: 'Bound item', stages: ['intake'] } },
      role: 'work',
      session: { sessionId, branch: `factory/${sessionId}`, threadId },
      resourceId: sessionId,
      kickoffKey: `kickoff-${sessionId}-${threadId}`,
      kickoffMessage: null,
    });
  return { seed, project, createSession, sessions, workItems, bindRun };
}

function context({
  user,
  resourceId = 'session-1',
  threadId = 'thread-1',
  interactive = true,
  tag,
}: {
  user?: { workosId: string; organizationId?: string; name?: string; avatarUrl?: string };
  resourceId?: string;
  threadId?: string;
  interactive?: boolean;
  tag?: string;
}) {
  const requestContext = new RequestContext();
  if (user) requestContext.set('user', user);
  if (interactive) requestContext.set(FACTORY_INTERACTIVE_KEY, true);
  requestContext.set('controller', {
    resourceId,
    threadId,
    scope: '/worktree',
    getState: () => (tag ? { factoryProjectId: tag } : {}),
  });
  return requestContext;
}

describe('resolveFactoryToolScope', () => {
  it('accepts the session owner', async () => {
    const { seed, project, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1', 'private');
    const scope = await resolveFactoryToolScope({
      requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' } }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope).toEqual({
      orgId: 'org-1',
      factoryProjectId: project.id,
      userId: 'user-1',
      sessionId: 'session-1',
      resourceId: 'session-1',
      threadId: 'thread-1',
      kind: 'user',
      interactive: true,
    });
  });

  it('carries the signed-in caller’s name and avatar for audit events', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1');
    const scope = await resolveFactoryToolScope({
      requestContext: context({
        user: { workosId: 'user-1', organizationId: 'org-1', name: 'Caleb', avatarUrl: 'https://example.com/c.png' },
      }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope?.actorProfile).toEqual({ name: 'Caleb', avatarUrl: 'https://example.com/c.png' });
  });

  it('authorizes Slack management as the linked sender while the model uses the session owner', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'owner-1', 'org');
    const requestContext = context({ user: { workosId: 'owner-1', organizationId: 'org-1' } });
    requestContext.set(FACTORY_SLACK_SENDER_KEY, { userId: 'responder-1', orgId: 'org-1' });
    const scope = await resolveFactoryToolScope({
      requestContext,
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope).toMatchObject({ userId: 'responder-1', kind: 'user', interactive: true });
    expect(requestContext.get('user')).toEqual({ workosId: 'owner-1', organizationId: 'org-1' });
  });

  it('does not let a linked Slack responder manage someone else’s private session', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'owner-1', 'private');
    const requestContext = context({ user: { workosId: 'owner-1', organizationId: 'org-1' } });
    requestContext.set(FACTORY_SLACK_SENDER_KEY, { userId: 'responder-1', orgId: 'org-1' });
    await expect(
      resolveFactoryToolScope({ requestContext, authEnabled: true, sessions, projects: seed.projects, workItems }),
    ).resolves.toBeNull();
  });

  it('rejects a Slack sender from another organization even when the model runs as the owner', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'owner-1', 'org');
    const requestContext = context({ user: { workosId: 'owner-1', organizationId: 'org-1' } });
    requestContext.set(FACTORY_SLACK_SENDER_KEY, { userId: 'responder-1', orgId: 'org-2' });
    await expect(
      resolveFactoryToolScope({ requestContext, authEnabled: true, sessions, projects: seed.projects, workItems }),
    ).resolves.toBeNull();
  });

  it('accepts an org teammate on an org-visible session', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1', 'org');
    const scope = await resolveFactoryToolScope({
      requestContext: context({ user: { workosId: 'user-2', organizationId: 'org-1' } }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope).toMatchObject({ userId: 'user-2', orgId: 'org-1', kind: 'user' });
  });

  it("refuses another user's private session", async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1', 'private');
    await expect(
      resolveFactoryToolScope({
        requestContext: context({ user: { workosId: 'user-2', organizationId: 'org-1' } }),
        authEnabled: true,
        sessions,
        projects: seed.projects,
        workItems,
      }),
    ).resolves.toBeNull();
  });

  it('refuses a caller from another org', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1');
    await expect(
      resolveFactoryToolScope({
        requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-2' } }),
        authEnabled: true,
        sessions,
        projects: seed.projects,
        workItems,
      }),
    ).resolves.toBeNull();
  });

  it('refuses when auth is enabled and nobody is signed in', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1');
    await expect(
      resolveFactoryToolScope({
        requestContext: context({}),
        authEnabled: true,
        sessions,
        projects: seed.projects,
        workItems,
      }),
    ).resolves.toBeNull();
  });

  it('refuses a session whose Factory was deleted', async () => {
    const { seed, project, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1');
    await seed.projects.delete({ orgId: 'org-1', id: project.id });
    await expect(
      resolveFactoryToolScope({
        requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' } }),
        authEnabled: true,
        sessions,
        projects: seed.projects,
        workItems,
      }),
    ).resolves.toBeNull();
  });

  it('refuses a thread that only carries a factoryProjectId tag', async () => {
    const { seed, project, sessions, workItems } = await seedFactory();
    await expect(
      resolveFactoryToolScope({
        requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' }, tag: project.id }),
        authEnabled: true,
        sessions,
        projects: seed.projects,
        workItems,
      }),
    ).resolves.toBeNull();
  });

  it('resolves a session whose run binding was revoked, on another thread, as a worker', async () => {
    const { seed, project, createSession, sessions, workItems, bindRun } = await seedFactory();
    await createSession('session-1', 'user-1');
    const { binding } = await bindRun('session-1', 'thread-a');
    await expect(
      seed.workItems.revokeRunBinding({
        orgId: 'org-1',
        factoryProjectId: project.id,
        bindingId: binding.id,
        revokedAt: new Date(),
      }),
    ).resolves.toMatchObject({ status: 'revoked' });
    const scope = await resolveFactoryToolScope({
      requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' }, threadId: 'thread-b' }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope?.kind).toBe('worker');
    expect(Object.keys(createFactoryTools({ scope: scope!, deps: {} as never }))).toEqual(['factory_message_origin']);
  });

  it('resolves an active binding on another thread of the session as a worker', async () => {
    const { seed, createSession, sessions, workItems, bindRun } = await seedFactory();
    await createSession('session-1', 'user-1');
    await bindRun('session-1', 'thread-a');
    const scope = await resolveFactoryToolScope({
      requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' }, threadId: 'thread-b' }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope?.kind).toBe('worker');
  });

  it('resolves a worker session with no signed-in caller, as its row owner', async () => {
    const { seed, project, createSession, sessions, workItems, bindRun } = await seedFactory();
    await createSession('session-1', 'user-1', 'private');
    await bindRun('session-1', 'thread-1');
    const scope = await resolveFactoryToolScope({
      requestContext: context({ interactive: false }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope).toEqual({
      orgId: 'org-1',
      factoryProjectId: project.id,
      userId: 'user-1',
      sessionId: 'session-1',
      resourceId: 'session-1',
      threadId: 'thread-1',
      kind: 'worker',
      interactive: false,
    });
  });

  it('refuses a worker session to a caller from another org', async () => {
    const { seed, createSession, sessions, workItems, bindRun } = await seedFactory();
    await createSession('session-1', 'user-1');
    await bindRun('session-1', 'thread-1');
    await expect(
      resolveFactoryToolScope({
        requestContext: context({ user: { workosId: 'user-9', organizationId: 'org-9' } }),
        authEnabled: true,
        sessions,
        projects: seed.projects,
        workItems,
      }),
    ).resolves.toBeNull();
  });

  it('resolves a user session woken by a notification as the row owner, not interactive', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1', 'private');
    // A wake's context carries the target row's owner (prepareSessionRunContext) and no interactive marker.
    const scope = await resolveFactoryToolScope({
      requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' }, interactive: false }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope).toMatchObject({ userId: 'user-1', kind: 'user', interactive: false });
  });

  it('resolves the local tenant when auth is disabled', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory('local');
    await createSession('session-1', 'local');
    const scope = await resolveFactoryToolScope({
      requestContext: context({}),
      authEnabled: false,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope).toMatchObject({ orgId: 'local', userId: 'local', kind: 'user' });
  });

  it('returns null without a controller context', async () => {
    const { seed, sessions, workItems } = await seedFactory();
    await expect(
      resolveFactoryToolScope({
        requestContext: new RequestContext(),
        authEnabled: false,
        sessions,
        projects: seed.projects,
        workItems,
      }),
    ).resolves.toBeNull();
  });

  it('is interactive only when the request carries the interactive marker', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1');
    const resolve = (interactive: boolean) =>
      resolveFactoryToolScope({
        requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' }, interactive }),
        authEnabled: true,
        sessions,
        projects: seed.projects,
        workItems,
      });
    await expect(resolve(true)).resolves.toMatchObject({ interactive: true });
    // A wake, webhook or dispatcher notice builds a fresh context carrying only `user`.
    await expect(resolve(false)).resolves.toMatchObject({ interactive: false });
  });
});

describe('createFactoryTools', () => {
  const scope: FactoryToolScope = {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    userId: 'user-1',
    sessionId: 'session-1',
    resourceId: 'session-1',
    threadId: 'thread-1',
    kind: 'user',
    interactive: true,
  };

  it('gives worker sessions only the reply tool', () => {
    expect(Object.keys(createFactoryTools({ scope: { ...scope, kind: 'worker' }, deps: {} as never }))).toEqual([
      'factory_message_origin',
    ]);
  });
});
