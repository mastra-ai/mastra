import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FactoryModelScope } from '../storage/domains/projects/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createSourceControlSessionLookup } from './factory-session.js';
import { resolveFactoryThinkingLevel } from './thinking-default.js';

function contextFor(controller: Record<string, unknown> | undefined, userId: string | null = 'owner') {
  const requestContext = new RequestContext();
  if (userId) requestContext.set('user', { workosId: userId, organizationId: 'org-1' });
  if (controller) requestContext.set('controller', controller);
  return requestContext;
}

async function setup(
  modelScope: FactoryModelScope = 'hybrid',
  { withSourceSession = true, ownerLevel = 'high' as 'high' | null } = {},
) {
  const seed = await createFactoryStorageForTests();
  const created = await seed.projects.create({
    orgId: 'org-1',
    userId: 'owner',
    input: { name: 'Billing', modelScope, defaultModelId: 'deepseek/deepseek-flash' },
  });
  const project = (await seed.projects.update({
    orgId: 'org-1',
    id: created.id,
    input: { defaultThinkingLevel: 'low' },
  }))!;
  const sourceControl = seed.sourceControl.forIntegration('github');
  if (withSourceSession) {
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
      createdByUserId: 'owner',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/mastra',
    });
    await sourceControl.sessions.create({
      orgId: 'org-1',
      userId: 'owner',
      factoryProjectId: project.id,
      projectRepositoryId: projectRepository.id,
      sessionId: 'session-1',
      branch: 'test',
      baseBranch: 'main',
      visibility: 'org',
    });
  }
  await seed.modelDefaults.set({ orgId: 'org-1', userId: 'owner', modelId: 'anthropic/claude-opus-4-6' });
  if (ownerLevel) {
    await seed.modelDefaults.setThinkingLevel({ orgId: 'org-1', userId: 'owner', thinkingLevel: ownerLevel });
  }
  await seed.modelDefaults.set({ orgId: 'org-1', userId: 'viewer', modelId: 'openai/gpt-5.5' });
  await seed.modelDefaults.setThinkingLevel({ orgId: 'org-1', userId: 'viewer', thinkingLevel: 'max' });
  const deps = {
    projects: seed.projects,
    sourceControl: createSourceControlSessionLookup([sourceControl]),
    workItems: seed.workItems,
    modelDefaults: seed.modelDefaults,
  };
  const bindRunThread = () =>
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
      session: { sessionId: 'session-1', branch: 'test', threadId: 'run-thread' },
      resourceId: 'session-1',
      kickoffKey: 'run-1',
      kickoffMessage: null,
    });
  const resolve = (threadId: string) =>
    resolveFactoryThinkingLevel(contextFor({ sessionId: 'session-1', resourceId: 'session-1', threadId }), deps);
  return { project, deps, bindRunThread, resolve };
}

afterEach(() => vi.restoreAllMocks());

describe('resolveFactoryThinkingLevel', () => {
  it("starts a hybrid chat at the session owner's personal level", async () => {
    const { resolve } = await setup('hybrid');
    expect(await resolve('chat-thread')).toBe('high');
  });

  it('starts a hybrid work-item run at the Factory level', async () => {
    const { resolve, bindRunThread } = await setup('hybrid');
    await bindRunThread();
    expect(await resolve('run-thread')).toBe('low');
  });

  it("starts a user-scoped work-item run at the owner's personal level", async () => {
    const { resolve, bindRunThread } = await setup('user');
    await bindRunThread();
    expect(await resolve('run-thread')).toBe('high');
  });

  it('starts a chat on Factory routing at the Factory level', async () => {
    const { resolve } = await setup('factory');
    expect(await resolve('chat-thread')).toBe('low');
  });

  it('falls back to the Factory level when the owner has a personal model but no level', async () => {
    const { resolve } = await setup('hybrid', { ownerLevel: null });
    expect(await resolve('chat-thread')).toBe('low');
  });

  it("starts a session under the user's own resource at their level, else at its Factory's", async () => {
    const { project, deps } = await setup('hybrid', { withSourceSession: false });
    const ownResource = (userId: string) =>
      contextFor(
        { sessionId: 'session-2', resourceId: userId, getState: () => ({ factoryProjectId: project.id }) },
        userId,
      );
    expect(await resolveFactoryThinkingLevel(ownResource('viewer'), deps)).toBe('max');
    expect(await resolveFactoryThinkingLevel(ownResource('user-1'), deps)).toBe('low');
  });

  it("starts a Factory-page chat at the viewer's level on personal routing", async () => {
    const { project, deps } = await setup('hybrid', { withSourceSession: false });
    const page = contextFor({ sessionId: project.id, resourceId: project.id }, 'viewer');
    expect(await resolveFactoryThinkingLevel(page, deps)).toBe('max');
  });

  it('starts a Factory-page chat at the Factory level on Factory routing', async () => {
    const { project, deps } = await setup('factory', { withSourceSession: false });
    const page = contextFor({ sessionId: project.id, resourceId: project.id }, 'viewer');
    expect(await resolveFactoryThinkingLevel(page, deps)).toBe('low');
  });

  it('uses the Factory level when no user is signed in', async () => {
    const { deps } = await setup('hybrid');
    const unsigned = contextFor({ sessionId: 'session-1', resourceId: 'session-1', threadId: 'chat-thread' }, null);
    expect(await resolveFactoryThinkingLevel(unsigned, deps)).toBe('low');
  });

  it("keeps the Factory level when the personal defaults can't be read", async () => {
    const { deps } = await setup('hybrid');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = {
      ...deps,
      modelDefaults: {
        ensureReady: async () => {
          throw new Error('model defaults init failed');
        },
        get: deps.modelDefaults.get.bind(deps.modelDefaults),
      },
    };
    const chat = contextFor({ sessionId: 'session-1', resourceId: 'session-1', threadId: 'chat-thread' });
    expect(await resolveFactoryThinkingLevel(chat, failing)).toBe('low');
  });

  it('uses medium outside any Factory and when the lookup fails', async () => {
    const { deps } = await setup('hybrid', { withSourceSession: false });
    expect(await resolveFactoryThinkingLevel(undefined, deps)).toBe('medium');
    expect(await resolveFactoryThinkingLevel(contextFor(undefined), deps)).toBe('medium');
    expect(await resolveFactoryThinkingLevel(contextFor({ sessionId: 'user-1', resourceId: 'user-1' }), deps)).toBe(
      'medium',
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = {
      ...deps,
      sourceControl: {
        getBySessionId: async () => {
          throw new Error('domain not ready');
        },
      },
    };
    expect(
      await resolveFactoryThinkingLevel(contextFor({ sessionId: 'session-1', resourceId: 'session-1' }), failing),
    ).toBe('medium');
    expect(warn).toHaveBeenCalled();
  });
});
