import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createSourceControlSessionLookup } from '../session/factory-session.js';
import type { SourceControlSessionVisibility } from '../storage/domains/source-control/base.js';
import type { FactoryRunBindingRecord } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FACTORY_INTERACTIVE_KEY, resolveFactoryToolScope } from './scope.js';
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
  const workItems = {
    findRunBindingBySession: vi.fn(async (): Promise<FactoryRunBindingRecord | null> => null),
    findActiveRunBindingForSession: vi.fn(async (): Promise<FactoryRunBindingRecord | null> => null),
  };
  return { seed, project, createSession, sessions, workItems };
}

function context({
  user,
  resourceId = 'session-1',
  threadId = 'thread-1',
  interactive = true,
  tag,
}: {
  user?: { workosId: string; organizationId?: string };
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

const binding = {
  id: 'binding-1',
  orgId: 'org-1',
  workItemId: 'item-1',
  role: 'work',
  threadId: 'thread-1',
  resourceId: 'session-1',
  sessionId: 'session-1',
  branch: 'factory/item',
  status: 'revoked',
  createdAt: new Date(),
  revokedAt: new Date(),
} as unknown as FactoryRunBindingRecord;

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

  it('resolves a session with a run binding, even a revoked one, as a worker', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1');
    workItems.findRunBindingBySession.mockResolvedValue(binding);
    const scope = await resolveFactoryToolScope({
      requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' } }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope?.kind).toBe('worker');
    expect(createFactoryTools({ scope: scope!, deps: {} })).toEqual({});
  });

  it('resolves an active binding on another thread of the session as a worker', async () => {
    const { seed, createSession, sessions, workItems } = await seedFactory();
    await createSession('session-1', 'user-1');
    workItems.findActiveRunBindingForSession.mockResolvedValue({ ...binding, status: 'active', revokedAt: null });
    const scope = await resolveFactoryToolScope({
      requestContext: context({ user: { workosId: 'user-1', organizationId: 'org-1' }, threadId: 'thread-2' }),
      authEnabled: true,
      sessions,
      projects: seed.projects,
      workItems,
    });
    expect(scope?.kind).toBe('worker');
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

  it('gives worker sessions nothing', () => {
    expect(createFactoryTools({ scope: { ...scope, kind: 'worker' }, deps: {} })).toEqual({});
  });
});
