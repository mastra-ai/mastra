import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FactoryModelScope } from '../storage/domains/projects/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createSourceControlSessionLookup } from './factory-session.js';
import { resolveRoutedModelDefaults } from './routed-model-defaults.js';
import type { RoutedModelDefaults } from './routed-model-defaults.js';

function contextFor(controller: Record<string, unknown> | undefined, userId: string | null = 'owner') {
  const requestContext = new RequestContext();
  if (userId) requestContext.set('user', { workosId: userId, organizationId: 'org-1' });
  if (controller) requestContext.set('controller', controller);
  return requestContext;
}

const thinkingLevel = async (pending: Promise<RoutedModelDefaults>) => (await pending).thinkingLevel;

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
    input: { defaultThinkingLevel: 'low', fallbackModelIds: ['openai/gpt-5.6-sol', 'google/gemini-3.8-flash'] },
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
  await seed.modelDefaults.setFallbackModelIds({
    orgId: 'org-1',
    userId: 'owner',
    fallbackModelIds: ['anthropic/claude-sonnet-4-6'],
  });
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
  const resolveDefaults = (threadId: string) =>
    resolveRoutedModelDefaults(contextFor({ sessionId: 'session-1', resourceId: 'session-1', threadId }), deps);
  const resolve = (threadId: string) => thinkingLevel(resolveDefaults(threadId));
  return { project, deps, bindRunThread, resolve, resolveDefaults };
}

afterEach(() => vi.restoreAllMocks());

describe('resolveRoutedModelDefaults', () => {
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

  it('reads the defaults once per request', async () => {
    const { deps } = await setup('factory');
    const getById = vi.spyOn(deps.projects, 'getById');
    const chat = () => contextFor({ sessionId: 'session-1', resourceId: 'session-1', threadId: 'chat-thread' });
    const request = chat();
    const factoryDefaults = {
      thinkingLevel: 'low',
      fallbackModelIds: ['openai/gpt-5.6-sol', 'google/gemini-3.8-flash'],
    };

    expect(await resolveRoutedModelDefaults(request, deps)).toEqual(factoryDefaults);
    const reads = getById.mock.calls.length;
    expect(reads).toBeGreaterThan(0);
    expect(await resolveRoutedModelDefaults(request, deps)).toEqual(factoryDefaults);
    expect(getById).toHaveBeenCalledTimes(reads);

    await resolveRoutedModelDefaults(chat(), deps);
    expect(getById).toHaveBeenCalledTimes(2 * reads);
  });

  it("falls back to the owner's personal fallback models in a personally routed chat", async () => {
    const { resolveDefaults } = await setup('hybrid');
    expect((await resolveDefaults('chat-thread')).fallbackModelIds).toEqual(['anthropic/claude-sonnet-4-6']);
  });

  it("falls back to the Factory's fallback models, in order, in a Factory-routed work-item run", async () => {
    const { resolveDefaults, bindRunThread } = await setup('hybrid');
    await bindRunThread();
    expect((await resolveDefaults('run-thread')).fallbackModelIds).toEqual([
      'openai/gpt-5.6-sol',
      'google/gemini-3.8-flash',
    ]);
  });

  it.each(['user', 'hybrid'] as const)(
    'starts a %s-routed chat at medium, never the Factory level, when the owner set no personal level',
    async modelScope => {
      const { resolve } = await setup(modelScope, { ownerLevel: null });
      expect(await resolve('chat-thread')).toBe('medium');
    },
  );

  it("starts a session under the user's own resource at their level, else at medium", async () => {
    const { project, deps } = await setup('hybrid', { withSourceSession: false });
    const ownResource = (userId: string) =>
      contextFor(
        { sessionId: 'session-2', resourceId: userId, getState: () => ({ factoryProjectId: project.id }) },
        userId,
      );
    expect(await thinkingLevel(resolveRoutedModelDefaults(ownResource('viewer'), deps))).toBe('max');
    expect(await thinkingLevel(resolveRoutedModelDefaults(ownResource('user-1'), deps))).toBe('medium');
  });

  it("starts a Factory-page chat at the viewer's level on personal routing", async () => {
    const { project, deps } = await setup('hybrid', { withSourceSession: false });
    const page = contextFor({ sessionId: project.id, resourceId: project.id }, 'viewer');
    expect(await resolveRoutedModelDefaults(page, deps)).toEqual({ thinkingLevel: 'max', fallbackModelIds: [] });
  });

  it('starts a Factory-page chat at the Factory level on Factory routing', async () => {
    const { project, deps } = await setup('factory', { withSourceSession: false });
    const page = contextFor({ sessionId: project.id, resourceId: project.id }, 'viewer');
    expect(await thinkingLevel(resolveRoutedModelDefaults(page, deps))).toBe('low');
  });

  it('uses the Factory level when no user is signed in', async () => {
    const { deps } = await setup('hybrid');
    const unsigned = contextFor({ sessionId: 'session-1', resourceId: 'session-1', threadId: 'chat-thread' }, null);
    expect(await thinkingLevel(resolveRoutedModelDefaults(unsigned, deps))).toBe('low');
  });

  it("starts a personal-routed chat at medium with no fallbacks when the personal defaults can't be read", async () => {
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
    expect(await resolveRoutedModelDefaults(chat, failing)).toEqual({ thinkingLevel: 'medium', fallbackModelIds: [] });
  });

  it('uses medium and no fallbacks outside any Factory and when the lookup fails', async () => {
    const { deps } = await setup('hybrid', { withSourceSession: false });
    const unrouted = { thinkingLevel: 'medium', fallbackModelIds: [] };
    expect(await resolveRoutedModelDefaults(undefined, deps)).toEqual(unrouted);
    expect(await resolveRoutedModelDefaults(contextFor(undefined), deps)).toEqual(unrouted);
    expect(await resolveRoutedModelDefaults(contextFor({ sessionId: 'user-1', resourceId: 'user-1' }), deps)).toEqual(
      unrouted,
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
      await resolveRoutedModelDefaults(contextFor({ sessionId: 'session-1', resourceId: 'session-1' }), failing),
    ).toEqual(unrouted);
    expect(warn).toHaveBeenCalled();
  });
});
