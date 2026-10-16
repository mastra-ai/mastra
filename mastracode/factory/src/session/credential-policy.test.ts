import {
  prepareCredentialTenant,
  resolveCredentialStore,
  resolveTenantFromRequestContext,
  withCredentialTenantPreparation,
} from '@mastra/code-sdk/agents/credential-resolver';
import { getDynamicModel, resolveModel } from '@mastra/code-sdk/agents/model';
import { stateSchema } from '@mastra/code-sdk/schema';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { SET_AGENT_CONTROLLER_SESSION_STATE_ROUTE } from '@mastra/server/handlers/agent-controller';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { prepareSessionRunContext } from '../integrations/subscription-session.js';
import {
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
} from '../routes/tenant-credentials.js';
import { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { resolveFactoryCredentialTenant } from './credential-policy.js';
import { hydrateSessionDefaultModel } from './default-model-hydration.js';
import { createSourceControlSessionLookup, ensureFactorySourceSession } from './factory-session.js';

const ORG = 'org-1';
const OWNER = 'owner';

async function setup() {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const project = await seed.projects.create({
    orgId: ORG,
    userId: OWNER,
    input: { name: 'Policy', modelScope: 'factory' },
  });
  const installation = await sourceControl.installations.upsert({
    orgId: ORG,
    connectedByUserId: OWNER,
    externalId: '123',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: ORG,
    input: { installationId: installation.id, externalId: '456', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: ORG,
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: OWNER,
  });
  await sourceControl.projectRepositories.link({
    orgId: ORG,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: OWNER,
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox/mastra',
  });
  const sourceSession = await ensureFactorySourceSession({
    sourceControl,
    orgId: ORG,
    factoryProjectId: project.id,
    repositorySlug: repository.slug,
    branch: 'policy-test',
  });
  const deps = {
    projects: seed.projects,
    sourceControl: createSourceControlSessionLookup([sourceControl]),
    workItems: seed.workItems,
  };
  registerTenantCredentialResolver(seed.credentials, new Set(), context =>
    resolveFactoryCredentialTenant(context, deps),
  );
  for (const [userId, key] of [
    [OWNER, 'owner-key'],
    ['sender', 'sender-key'],
    ['victim', 'victim-key'],
  ] as const) {
    await seed.credentials.setCredential({ orgId: ORG, userId }, 'openai-codex', { type: 'api_key', key });
  }
  await seed.credentials.setCredential({ orgId: ORG }, 'openai-codex', { type: 'api_key', key: 'org-key' });
  const context = (sessionId = sourceSession.sessionId, userId = 'sender', orgId = ORG, resourceId = sessionId) => {
    const ctx = new RequestContext();
    ctx.set('user', { id: userId, organizationId: orgId });
    ctx.set('controller', { sessionId, resourceId, threadId: sessionId, state: {} });
    return ctx;
  };
  return { seed, sourceControl, sourceSession, project, deps, context };
}

async function bindRun(
  seed: Awaited<ReturnType<typeof setup>>['seed'],
  sourceSession: Awaited<ReturnType<typeof setup>>['sourceSession'],
  factoryProjectId: string,
  externalId = factoryProjectId,
) {
  await seed.workItems.prepareRunStart({
    orgId: ORG,
    userId: OWNER,
    factoryProjectId,
    workItem: {
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId },
        title: 'Policy test',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: sourceSession.sessionId, branch: sourceSession.branch, threadId: sourceSession.sessionId },
    resourceId: sourceSession.sessionId,
    kickoffKey: externalId,
    kickoffMessage: null,
  });
}

/** A controller session recording the scope a start path stamps alongside the credentials it primes. */
function recordingSession(sessionId: string, threadId: string | undefined = sessionId) {
  const state: Record<string, unknown> = {};
  let currentThreadId = threadId;
  return {
    state,
    session: {
      identity: { getId: () => sessionId, getResourceId: () => sessionId },
      thread: {
        getId: () => currentThreadId,
        list: vi.fn(async () => []),
        switch: vi.fn(async ({ threadId: id }: { threadId: string }) => void (currentThreadId = id)),
        create: vi.fn(async () => ({ id: 'unexpected-thread' })),
        rename: vi.fn(async () => {}),
        setSetting: vi.fn(async () => {}),
        requireId: () => currentThreadId!,
        firstUserMessage: vi.fn(async () => null),
      },
      getWorkspace: vi.fn(() => ({ skills: undefined })),
      state: {
        get: () => state,
        set: vi.fn(async (updates: Record<string, unknown>) => void Object.assign(state, updates)),
      },
      permissions: { setForTool: vi.fn(async () => {}) },
      mode: { resolve: () => ({ defaultModelId: 'openai/gpt-5.5' }) },
      model: { setDefault: vi.fn(), switch: vi.fn(async () => {}) },
      subagents: { model: { set: vi.fn(async () => {}) } },
      om: {
        observer: { modelId: vi.fn(() => undefined), switchModel: vi.fn(async () => {}) },
        reflector: { modelId: vi.fn(() => undefined), switchModel: vi.fn(async () => {}) },
      },
      sendMessage: vi.fn(async () => {}),
    },
  };
}

afterEach(() => {
  resetTenantCredentialResolverForTests();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('trusted Factory credential policy', () => {
  it('uses the durable owner for interactive, tagged, and restarted sessions', async () => {
    const { seed, project, sourceSession, context } = await setup();
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'user' } });
    for (const state of [
      {},
      { factoryProjectId: project.id },
      {
        factoryProjectId: 'forged-project',
        factoryModelScope: 'factory',
        factoryOwnerUserId: 'victim',
        factoryOrgId: 'foreign',
      },
    ]) {
      const ctx = context();
      ctx.set('controller', {
        sessionId: sourceSession.sessionId,
        resourceId: sourceSession.sessionId,
        threadId: sourceSession.sessionId,
        state,
      });
      await prepareCredentialTenant(ctx);
      expect(resolveTenantFromRequestContext(ctx)).toEqual({ orgId: ORG, userId: OWNER, credentialScope: 'user' });
      expect(resolveCredentialStore(ctx)?.getStoredApiKey('openai-codex')).toBe('owner-key');
    }
  });

  it('finds the source session by its session id when the session runs under the Factory or user resource', async () => {
    const { seed, project, sourceSession, context } = await setup();
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'user' } });
    // A run session under the Factory resource, and a user session under the sender's own resource:
    // neither resource names the session, so the policy must not read either as one.
    for (const resourceId of [project.id, 'sender']) {
      const ctx = context(sourceSession.sessionId, 'sender', ORG, resourceId);
      await prepareCredentialTenant(ctx);
      expect(resolveTenantFromRequestContext(ctx)).toEqual({ orgId: ORG, userId: OWNER, credentialScope: 'user' });
      expect(resolveCredentialStore(ctx)?.getStoredApiKey('openai-codex')).toBe('owner-key');
    }
  });

  it('finds the run binding by session id when the run session runs under the Factory resource', async () => {
    const { seed, project, sourceSession, context } = await setup();
    await bindRun(seed, sourceSession, project.id);
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'factory' } });
    const ctx = context(sourceSession.sessionId, 'sender', ORG, project.id);
    await prepareCredentialTenant(ctx);
    expect(resolveTenantFromRequestContext(ctx)?.credentialScope).toBe('factory');
    expect(resolveCredentialStore(ctx)?.getStoredApiKey('openai-codex')).toBe('org-key');
  });

  it('refreshes reused contexts after both directions of a scope change', async () => {
    const { seed, project, context } = await setup();
    const ctx = context();
    for (const [modelScope, key] of [
      ['factory', 'org-key'],
      ['user', 'owner-key'],
      ['factory', 'org-key'],
    ] as const) {
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope } });
      await prepareCredentialTenant(ctx);
      expect(resolveCredentialStore(ctx)?.getStoredApiKey('openai-codex')).toBe(key);
      await expect(resolveCredentialStore(ctx)?.getApiKey('openai-codex')).resolves.toBe(key);
    }
  });

  it('invalidates prior policy and refuses execution on project read failure or deletion', async () => {
    const { seed, project, context } = await setup();
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'user' } });
    const ctx = context();
    await prepareCredentialTenant(ctx);
    const lookup = vi.spyOn(seed.projects, 'getById');
    lookup.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(prepareCredentialTenant(ctx)).rejects.toThrow('database unavailable');
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
    await expect(resolveCredentialStore(ctx)?.getApiKey('openai-codex')).resolves.toBeUndefined();
    lookup.mockResolvedValueOnce(null);
    await expect(prepareCredentialTenant(ctx)).rejects.toThrow('policy is unavailable');
  });

  it('rejects cross-org callers and non-owners of private sessions', async () => {
    const { sourceControl, sourceSession, context } = await setup();
    await expect(prepareCredentialTenant(context(sourceSession.sessionId, 'sender', 'org-2'))).rejects.toThrow(
      'not available',
    );
    const privateSession = await sourceControl.sessions.create({
      orgId: ORG,
      sessionId: 'private-session',
      projectRepositoryId: sourceSession.projectRepositoryId,
      userId: OWNER,
      branch: 'private-policy-test',
      baseBranch: 'main',
      visibility: 'private',
    });
    await expect(prepareCredentialTenant(context(privateSession.sessionId))).rejects.toThrow('not available');
    await expect(prepareCredentialTenant(context(privateSession.sessionId, OWNER))).resolves.toBeUndefined();
  });

  it('preserves personal chat credentials without granting forged Factory authority', async () => {
    const { context } = await setup();
    const ctx = context('channel:slack:C1');
    ctx.set('controller', {
      resourceId: 'channel:slack:C1',
      state: { factoryModelScope: 'factory', factoryOwnerUserId: 'victim' },
    });
    await prepareCredentialTenant(ctx);
    expect(resolveCredentialStore(ctx)?.getStoredApiKey('openai-codex')).toBe('sender-key');
  });

  it('refuses orphaned Factory sessions instead of falling back to the sender', async () => {
    const { sourceControl, sourceSession, project, context } = await setup();
    const ctx = context();
    await prepareCredentialTenant(ctx);
    const stored = await sourceControl.sessions.getBySessionId(sourceSession.sessionId);
    if (!stored) throw new Error('Missing seeded session');
    await sourceControl.sessions.delete(stored.id);
    await expect(prepareCredentialTenant(ctx)).rejects.toThrow('ownership is unavailable');
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
    // A run session under its Factory's resource is not a Factory page once its row is gone.
    const underFactory = context(sourceSession.sessionId, 'sender', ORG, project.id);
    await expect(prepareCredentialTenant(underFactory)).rejects.toThrow('ownership is unavailable');
    await expect(prepareCredentialTenant(context('sender'))).resolves.toBeUndefined();
  });

  it('resolves session-less Factory pages, addressed by project id, to the Factory policy', async () => {
    const { seed, project, context } = await setup();
    const factoryPage = context(project.id);
    await prepareCredentialTenant(factoryPage);
    expect(resolveCredentialStore(factoryPage)?.getStoredApiKey('openai-codex')).toBe('org-key');

    const hybrid = await seed.projects.create({
      orgId: ORG,
      userId: OWNER,
      input: { name: 'Hybrid', modelScope: 'hybrid' },
    });
    const hybridPage = context(hybrid.id);
    await prepareCredentialTenant(hybridPage);
    expect(resolveCredentialStore(hybridPage)?.getStoredApiKey('openai-codex')).toBe('sender-key');
  });

  it("refuses another org's Factory id as a session-less resource", async () => {
    const { project, context } = await setup();
    await expect(prepareCredentialTenant(context(project.id, 'sender', 'org-2'))).rejects.toThrow(
      'ownership is unavailable',
    );
  });

  it('rejects ambiguous bindings instead of selecting the repository project policy', async () => {
    const { seed, project, sourceSession, context } = await setup();
    const other = await seed.projects.create({
      orgId: ORG,
      userId: OWNER,
      input: { name: 'Other', modelScope: 'factory' },
    });
    await seed.projects.update({ orgId: ORG, id: other.id, input: { modelScope: 'user' } });
    for (const factoryProjectId of [project.id, other.id]) {
      await seed.workItems.prepareRunStart({
        orgId: ORG,
        userId: OWNER,
        factoryProjectId,
        workItem: {
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: factoryProjectId },
            title: 'Policy test',
            stages: ['intake'],
            sessions: {},
            metadata: {},
          },
        },
        role: 'work',
        session: {
          sessionId: sourceSession.sessionId,
          branch: sourceSession.branch,
          threadId: sourceSession.sessionId,
        },
        resourceId: sourceSession.sessionId,
        kickoffKey: factoryProjectId,
        kickoffMessage: null,
      });
    }
    const address = {
      orgId: ORG,
      resourceId: sourceSession.sessionId,
      sessionId: sourceSession.sessionId,
      threadId: sourceSession.sessionId,
    };
    await expect(seed.workItems.findActiveRunBindingByThread(address)).resolves.toBeNull();
    await expect(prepareCredentialTenant(context())).rejects.toThrow('ambiguous');
  });

  describe('hybrid scope', () => {
    it("resolves an unbound session thread to the owner's personal credentials", async () => {
      const { seed, project, context } = await setup();
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'hybrid' } });
      const ctx = context();

      await prepareCredentialTenant(ctx);

      expect(resolveTenantFromRequestContext(ctx)).toEqual({ orgId: ORG, userId: OWNER, credentialScope: 'user' });
      await expect(resolveCredentialStore(ctx)?.getApiKey('openai-codex')).resolves.toBe('owner-key');
    });

    it("resolves a thread with an active run binding to the organization's credentials", async () => {
      const { seed, project, sourceSession, context } = await setup();
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'hybrid' } });
      await bindRun(seed, sourceSession, project.id);
      const ctx = context();

      await prepareCredentialTenant(ctx);

      expect(resolveTenantFromRequestContext(ctx)).toEqual({ orgId: ORG, userId: OWNER, credentialScope: 'factory' });
      await expect(resolveCredentialStore(ctx)?.getApiKey('openai-codex')).resolves.toBe('org-key');
    });

    it.each(['hybrid', 'user'] as const)(
      'keeps %s billing on a completed work-item thread without restoring authority',
      async modelScope => {
        const { seed, project, sourceSession, context, deps } = await setup();
        await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope } });
        await bindRun(seed, sourceSession, project.id);
        const address = {
          orgId: ORG,
          factoryProjectId: project.id,
          resourceId: sourceSession.sessionId,
          sessionId: sourceSession.sessionId,
          threadId: sourceSession.sessionId,
        };
        const binding = await seed.workItems.findActiveRunBinding(address);
        await seed.workItems.revokeRunBinding({
          orgId: ORG,
          factoryProjectId: project.id,
          bindingId: binding!.id,
          revokedAt: new Date(),
        });
        await expect(seed.workItems.findActiveRunBinding(address)).resolves.toBeNull();

        const ctx = context();
        await prepareCredentialTenant(ctx);
        const expectedScope = modelScope === 'hybrid' ? 'factory' : 'user';
        expect(resolveTenantFromRequestContext(ctx)).toEqual({
          orgId: ORG,
          userId: OWNER,
          credentialScope: expectedScope,
        });
        await expect(resolveCredentialStore(ctx)?.getApiKey('openai-codex')).resolves.toBe(
          modelScope === 'hybrid' ? 'org-key' : 'owner-key',
        );

        const { session, state } = recordingSession(sourceSession.sessionId);
        await hydrateSessionDefaultModel(session, { ...deps, modelDefaults: seed.modelDefaults });
        expect(state.factoryModelScope).toBe(expectedScope);
        expect(session.model.switch).not.toHaveBeenCalled();

        ctx.set('controller', {
          sessionId: sourceSession.sessionId,
          resourceId: sourceSession.sessionId,
          threadId: 'unrelated-chat-thread',
          state: {},
        });
        await prepareCredentialTenant(ctx);
        expect(resolveTenantFromRequestContext(ctx)).toEqual({ orgId: ORG, userId: OWNER, credentialScope: 'user' });
      },
    );

    it('resolves the same session as a session again on a thread the run binding does not cover', async () => {
      const { seed, project, sourceSession, context } = await setup();
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'hybrid' } });
      await bindRun(seed, sourceSession, project.id);
      const ctx = context();
      ctx.set('controller', {
        sessionId: sourceSession.sessionId,
        resourceId: sourceSession.sessionId,
        threadId: 'chat-thread',
        state: {},
      });

      await prepareCredentialTenant(ctx);

      expect(resolveTenantFromRequestContext(ctx)).toEqual({ orgId: ORG, userId: OWNER, credentialScope: 'user' });
    });

    it('still rejects ambiguous bindings', async () => {
      const { seed, project, sourceSession, context } = await setup();
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'hybrid' } });
      const other = await seed.projects.create({
        orgId: ORG,
        userId: OWNER,
        input: { name: 'Other', modelScope: 'hybrid' },
      });
      await bindRun(seed, sourceSession, project.id);
      await bindRun(seed, sourceSession, other.id);

      await expect(prepareCredentialTenant(context())).rejects.toThrow('ambiguous');
    });

    it('does not seed the owner default on a thread with ambiguous bindings', async () => {
      const { seed, project, sourceSession, deps } = await setup();
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'hybrid' } });
      const other = await seed.projects.create({
        orgId: ORG,
        userId: OWNER,
        input: { name: 'Other', modelScope: 'hybrid' },
      });
      await bindRun(seed, sourceSession, project.id);
      await bindRun(seed, sourceSession, other.id);
      await seed.modelDefaults.set({ orgId: ORG, userId: OWNER, modelId: 'anthropic/claude-opus-4-6' });
      const { session, state } = recordingSession(sourceSession.sessionId);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await hydrateSessionDefaultModel(session as never, { ...deps, modelDefaults: seed.modelDefaults });

      expect(session.model.switch).not.toHaveBeenCalled();
      expect(state).toMatchObject({ factoryModelScope: 'user', factoryOwnerUserId: undefined });
    });

    it('leaves factory and user Factories on their scope whether or not a run binding exists', async () => {
      const { seed, project, sourceSession, context } = await setup();
      for (const bound of [false, true]) {
        if (bound) await bindRun(seed, sourceSession, project.id);
        for (const modelScope of ['factory', 'user'] as const) {
          await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope } });
          const ctx = context();
          await prepareCredentialTenant(ctx);
          expect(resolveTenantFromRequestContext(ctx)?.credentialScope).toBe(modelScope);
        }
      }
    });

    it('primes the same scope at session start that the policy resolves for the session', async () => {
      const { seed, project, sourceSession, deps, context } = await setup();
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'hybrid' } });
      await seed.modelDefaults.set({ orgId: ORG, userId: OWNER, modelId: 'anthropic/claude-opus-4-6' });
      const { session, state } = recordingSession(sourceSession.sessionId);

      await hydrateSessionDefaultModel(session as never, { ...deps, modelDefaults: seed.modelDefaults });
      const ctx = context();
      await prepareCredentialTenant(ctx);

      expect(state.factoryModelScope).toBe('user');
      expect(resolveTenantFromRequestContext(ctx)?.credentialScope).toBe(state.factoryModelScope);
      expect(session.model.switch).toHaveBeenCalledWith('anthropic/claude-opus-4-6');
    });

    it('primes the same scope at run start that the policy resolves for the run', async () => {
      const { seed, project, sourceControl, sourceSession, context } = await setup();
      await seed.projects.update({
        orgId: ORG,
        id: project.id,
        input: { modelScope: 'hybrid', defaultModelId: 'deepseek/deepseek-flash' },
      });
      await seed.modelDefaults.set({ orgId: ORG, userId: OWNER, modelId: 'anthropic/claude-opus-4-6' });
      const { session, state } = recordingSession(sourceSession.sessionId, undefined);
      const coordinator = new FactoryStartCoordinator(
        {
          createSession: vi.fn(async ({ threadId }: { threadId: string }) => {
            await session.thread.switch({ threadId });
            return session;
          }),
        } as never,
        seed.workItems,
        undefined,
        sourceControl,
        undefined,
        { projects: seed.projects, modelDefaults: seed.modelDefaults },
      );

      const prepared = await coordinator.prepare({
        orgId: ORG,
        userId: OWNER,
        factoryProjectId: project.id,
        sessionId: sourceSession.sessionId,
        threadTitle: 'Run',
        kickoffKey: 'run-1',
        modelScope: 'factory',
        workItem: {
          role: 'work',
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: 'run-1' },
            title: 'Run',
            stages: ['intake'],
            sessions: {},
            metadata: {},
          },
        },
      });
      const ctx = context();
      ctx.set('controller', {
        sessionId: prepared.resourceId,
        resourceId: prepared.resourceId,
        threadId: prepared.threadId,
        state: {},
      });
      await prepareCredentialTenant(ctx);

      expect(state.factoryModelScope).toBe('factory');
      expect(resolveTenantFromRequestContext(ctx)?.credentialScope).toBe(state.factoryModelScope);
      expect(session.model.switch).toHaveBeenCalledWith('deepseek/deepseek-flash');
    });
  });

  it('refreshes stripped subagent and delayed memory contexts before provider calls', async () => {
    const { seed, project, context } = await setup();
    const parent = context();
    await prepareCredentialTenant(parent);
    const child = new RequestContext(parent.entries());
    child.set('controller', { resourceId: '', threadId: null });
    const delayedModel = resolveModel('openai/gpt-5.4', { requestContext: child });
    const auth: Array<string | null> = [];
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      auth.push(new Headers(init?.headers).get('authorization'));
      return new Response(
        JSON.stringify({ error: { message: 'test provider boundary', type: 'invalid_request_error' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    });
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'user' } });
    await expect(delayedModel.doGenerate({ prompt: [] })).rejects.toThrow('test provider boundary');
    expect(auth).toEqual(['Bearer owner-key']);
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'factory' } });
    await expect(delayedModel.doStream({ prompt: [] })).rejects.toThrow('test provider boundary');
    expect(auth).toEqual(['Bearer owner-key', 'Bearer org-key']);
    vi.spyOn(seed.projects, 'getById').mockRejectedValueOnce(new Error('database unavailable'));
    await expect(delayedModel.doGenerate({ prompt: [] })).rejects.toThrow('database unavailable');
    expect(fetch).toHaveBeenCalledTimes(2);
    await expect(delayedModel.doGenerate({ prompt: [] })).rejects.toThrow('test provider boundary');
    expect(auth).toEqual(['Bearer owner-key', 'Bearer org-key', 'Bearer org-key']);
    vi.mocked(seed.projects.getById).mockResolvedValue(null);
    for (let retry = 0; retry < 2; retry++) {
      await expect(delayedModel.doGenerate({ prompt: [] })).rejects.toThrow('policy is unavailable');
    }
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['factory', 'user', 'owner-key'],
    ['user', 'factory', 'org-key'],
  ] as const)(
    'constructs a delayed model when only the newly authorized %s → %s scope has credentials',
    async (before, after, key) => {
      const { seed, project, context } = await setup();
      await seed.credentials.removeCredential(
        { orgId: ORG, ...(before === 'user' ? { userId: OWNER } : {}) },
        'openai-codex',
      );
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: before } });
      const parent = context();
      await prepareCredentialTenant(parent);
      expect(resolveCredentialStore(parent)?.getStoredApiKey('openai-codex')).toBeUndefined();
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: after } });
      const child = new RequestContext(parent.entries());
      child.set('controller', { resourceId: '', threadId: null });
      const delayedModel = resolveModel('openai/gpt-5.4', { requestContext: child });
      const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${key}`);
        return new Response(
          JSON.stringify({ error: { message: 'test provider boundary', type: 'invalid_request_error' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      });
      await expect(delayedModel.doGenerate({ prompt: [] })).rejects.toThrow('test provider boundary');
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it('defers Moonshot construction until the current scope supplies its key, without environment fallback', async () => {
    vi.stubEnv('MOONSHOT_API_KEY', '');
    vi.stubEnv('MOONSHOT_AI_API_KEY', '');
    const { seed, project, context } = await setup();
    await seed.credentials.setCredential({ orgId: ORG, userId: OWNER }, 'moonshotai', {
      type: 'api_key',
      key: 'moonshot-owner',
    });
    const parent = context();
    await prepareCredentialTenant(parent);
    const child = new RequestContext(parent.entries());
    child.set('controller', { resourceId: '', threadId: null });
    const model = resolveModel('moonshotai/kimi-k2.6', { requestContext: child });
    expect(model.specificationVersion).toBe('v2');
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'user' } });
    expect(await model.supportedUrls).toEqual(expect.any(Object));
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      expect(new Headers(init?.headers).get('x-api-key')).toBe('moonshot-owner');
      return new Response(
        JSON.stringify({
          id: 'msg-policy',
          type: 'message',
          role: 'assistant',
          model: 'kimi-k2.6',
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });
    const agent = new Agent({ id: 'moonshot-policy', name: 'Moonshot policy', instructions: 'test', model });
    await expect(agent.generate('test', { requestContext: child })).resolves.toMatchObject({ text: 'ok' });
    expect(fetch).toHaveBeenCalledOnce();
    fetch.mockImplementationOnce(async (_url, init) => {
      expect(new Headers(init?.headers).get('x-api-key')).toBe('moonshot-owner');
      const events = [
        {
          type: 'message_start',
          message: {
            id: 'msg-stream',
            type: 'message',
            role: 'assistant',
            model: 'kimi-k2.6',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
      return new Response(events.map(data => `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`).join(''), {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });
    const stream = await agent.stream('test', { requestContext: child });
    expect(await stream.text).toBe('ok');
    expect(fetch).toHaveBeenCalledTimes(2);
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'factory' } });
    await expect(model.doGenerate({ prompt: [] })).rejects.toThrow('No usable moonshotai credential');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('isolates concurrent provider invocations when the first policy read completes before the second', async () => {
    const { seed, project, context } = await setup();
    const parent = context();
    await prepareCredentialTenant(parent);
    const child = new RequestContext(parent.entries());
    child.set('controller', { resourceId: '', threadId: null });
    const model = resolveModel('openai/gpt-5.4', { requestContext: child });
    let finishFirst = () => {};
    let finishSecond = () => {};
    const firstLookup = new Promise<typeof project>(resolve => {
      finishFirst = () => resolve(project);
    });
    const secondLookup = new Promise<typeof project>(resolve => {
      finishSecond = () => resolve(project);
    });
    const lookup = vi
      .spyOn(seed.projects, 'getById')
      .mockReturnValueOnce(firstLookup)
      .mockReturnValueOnce(secondLookup);
    const auth: Array<string | null> = [];
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      auth.push(new Headers(init?.headers).get('authorization'));
      return new Response(
        JSON.stringify({ error: { type: 'invalid_request_error', message: 'test provider boundary' } }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    const first = expect(model.doGenerate({ prompt: [] })).rejects.toThrow('test provider boundary');
    const second = expect(model.doGenerate({ prompt: [] })).rejects.toThrow('test provider boundary');
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
    finishFirst();
    await first;
    expect(fetch).toHaveBeenCalledOnce();
    finishSecond();
    await second;
    expect(auth).toEqual(['Bearer org-key', 'Bearer org-key']);
  });

  it('resolves unattended wake identity from the durable session before binding fresh execution policy', async () => {
    const { seed, project, sourceSession, deps } = await setup();
    const wake = new RequestContext();
    await expect(
      prepareSessionRunContext(wake, sourceSession.sessionId, { sessions: deps.sourceControl }),
    ).resolves.toBe('prepared');
    const execution = new RequestContext(wake.entries());
    execution.set('controller', {
      sessionId: sourceSession.sessionId,
      resourceId: sourceSession.sessionId,
      threadId: sourceSession.sessionId,
    });
    await prepareCredentialTenant(execution);
    expect(resolveTenantFromRequestContext(execution)).toEqual({
      orgId: ORG,
      userId: OWNER,
      credentialScope: 'factory',
    });
    expect(resolveCredentialStore(execution)?.getStoredApiKey('openai-codex')).toBe('org-key');
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'user' } });
    await prepareCredentialTenant(execution);
    expect(resolveCredentialStore(execution)?.getStoredApiKey('openai-codex')).toBe('owner-key');
    const unavailable = new RequestContext();
    await expect(
      prepareSessionRunContext(unavailable, 'missing-session', { sessions: deps.sourceControl }),
    ).resolves.toBe('session-not-found');
    await expect(prepareCredentialTenant(unavailable)).rejects.toThrow('could not be resolved');
  });

  it('refuses a project-keyed resourceId from a retired session kind instead of reading the project policy', async () => {
    const { project, context } = await setup();
    const ctx = context(`factory-retired-kind:${project.id}`);
    await expect(prepareCredentialTenant(ctx)).rejects.toThrow('ownership is unavailable');
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
  });

  it('ignores HTTP state forgery during real Agent model resolution and fails closed on subsequent policy errors', async () => {
    const { seed, project, sourceSession, context } = await setup();
    await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope: 'user' } });
    const keys: Array<string | undefined> = [];
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    };
    const mockModel = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'policy-test',
      supportedUrls: {},
      doGenerate: async () => ({
        content: [{ type: 'text' as const, text: 'ok' }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage,
        warnings: [],
      }),
      doStream: async () => ({
        stream: new ReadableStream({
          start(stream) {
            stream.enqueue({ type: 'stream-start', warnings: [] });
            stream.enqueue({ type: 'text-start', id: 'text-1' });
            stream.enqueue({ type: 'text-delta', id: 'text-1', delta: 'ok' });
            stream.enqueue({ type: 'text-end', id: 'text-1' });
            stream.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage });
            stream.close();
          },
        }),
      }),
    };
    const agent = new Agent({
      id: 'policy',
      name: 'Policy',
      instructions: 'test',
      model: withCredentialTenantPreparation(ctx => {
        keys.push(resolveCredentialStore(ctx.requestContext)?.getStoredApiKey('openai-codex'));
        getDynamicModel(ctx);
        return mockModel;
      }),
    });
    const storage = new InMemoryStore({ id: 'policy-http' });
    const controller = new AgentController({
      id: 'code',
      storage,
      stateSchema,
      modes: [{ id: 'build', name: 'Build', default: true, defaultModelId: 'openai/gpt-5.5', agent }],
    });
    const mastra = new Mastra({ agentControllers: { code: controller }, storage });
    const app = new Hono();
    app.onError((error, c) => c.json({ error: error.message }, 503));
    app.put('/sessions/:sessionId/state', async c => {
      const { state } = z.object({ state: z.record(z.string(), z.unknown()) }).parse(await c.req.json());
      const result = await SET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        sessionId: c.req.param('sessionId'),
        state,
        requestContext: context(c.req.param('sessionId')),
        abortSignal: new AbortController().signal,
      });
      return c.json(result);
    });
    app.post('/sessions/:sessionId/execute', async c => {
      const session = await controller.getSession(c.req.param('sessionId'));
      if (!session) return c.json({ error: 'missing session' }, 404);
      await session.sendMessage({ content: 'test', requestContext: context(c.req.param('sessionId')) });
      return c.json({ modelId: session.model.get() });
    });
    // The session row's POST starts the conversation; state writes only act on a started session.
    await controller.createSession({
      id: sourceSession.sessionId,
      resourceId: sourceSession.sessionId,
      threadId: sourceSession.sessionId,
      requestContext: context(sourceSession.sessionId),
    });
    const path = `/sessions/${sourceSession.sessionId}`;
    const write = await app.request(`${path}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: {
          factoryProjectId: 'forged',
          factoryOrgId: 'foreign-org',
          factoryOwnerUserId: 'victim',
          factoryModelScope: 'factory',
        },
      }),
    });
    expect(write.status).toBe(200);
    const session = await controller.getSession(sourceSession.sessionId);
    await session?.model.switch('openai/gpt-5.4');
    for (const [modelScope, key] of [
      ['user', 'owner-key'],
      ['factory', 'org-key'],
      ['user', 'owner-key'],
    ] as const) {
      await seed.projects.update({ orgId: ORG, id: project.id, input: { modelScope } });
      keys.length = 0;
      const run = await app.request(`${path}/execute`, { method: 'POST' });
      expect(await run.json()).toEqual({ modelId: 'openai/gpt-5.4' });
      expect(run.status).toBe(200);
      expect(new Set(keys)).toEqual(new Set([key]));
    }
    keys.length = 0;
    vi.spyOn(seed.projects, 'getById').mockRejectedValueOnce(new Error('database unavailable'));
    const refused = await app.request(`${path}/execute`, { method: 'POST' });
    expect(refused.status).toBe(503);
    expect(await refused.json()).toEqual({ error: 'database unavailable' });
    expect(keys).toEqual([]);
  });
});
