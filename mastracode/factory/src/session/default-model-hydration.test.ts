import { describe, expect, it, vi } from 'vitest';

import type { ModelDefaultRecord } from '../storage/domains/model-defaults/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { hydrateSessionDefaultModel } from './default-model-hydration.js';
import type { DefaultModelHydrationDependencies, DefaultModelHydrationSession } from './default-model-hydration.js';

const { primeTenant, providerDefault } = vi.hoisted(() => ({
  primeTenant: vi.fn(async (_tenant: unknown) => undefined),
  providerDefault: vi.fn(
    async (_tenant: unknown, _current: string | undefined): Promise<string | undefined> => undefined,
  ),
}));
vi.mock('../routes/tenant-credentials.js', () => ({
  primeTenantCredentialsForTenant: primeTenant,
  resolveTenantProviderDefaultModel: providerDefault,
}));

const modelId = 'anthropic/claude-opus-5';

function modelDefault(): ModelDefaultRecord {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    modelId,
    updatedAt: new Date(),
  };
}

function sourceControlRow(): SourceControlSession {
  return {
    id: 'row-1',
    sessionId: 'session-1',
    projectRepositoryId: 'repo-1',
    factoryProjectId: 'factory-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'user/session-1',
    title: null,
    visibility: 'private',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    firstMessageAt: null,
    firstMeaningfulExecAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createSession(state: Record<string, unknown> = {}, resourceId = 'session-1'): DefaultModelHydrationSession {
  return {
    identity: { getId: () => 'session-1', getResourceId: () => resourceId },
    model: { get: () => 'openai/mode-default', switch: vi.fn().mockResolvedValue(undefined), setDefault: vi.fn() },
    state: {
      get: () => state,
      set: vi.fn(async (updates: Record<string, unknown>) => void Object.assign(state, updates)),
    },
    subagents: { model: { set: vi.fn().mockResolvedValue(undefined) } },
    thread: {
      getId: () => 'session-1',
      firstUserMessage: vi.fn().mockResolvedValue(null),
    },
  };
}

function createDependencies(
  record: ModelDefaultRecord | null = modelDefault(),
  modelScope: 'factory' | 'user' | 'hybrid' = 'user',
): DefaultModelHydrationDependencies {
  const sourceSession = sourceControlRow();
  return {
    sourceControl: {
      getBySessionId: vi.fn().mockResolvedValue(sourceSession),
    },
    projects: {
      getById: vi.fn().mockResolvedValue({
        id: 'factory-1',
        orgId: 'org-1',
        modelScope,
        defaultModelId: 'openai/factory-model',
      }),
    },
    workItems: { findRunBindingByThread: vi.fn().mockResolvedValue(null) },
    modelDefaults: { get: vi.fn().mockResolvedValue(record) },
  };
}

describe('hydrateSessionDefaultModel', () => {
  it('applies the user default model to a new interactive session', async () => {
    const session = createSession();
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).toHaveBeenCalledExactlyOnceWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith(modelId);
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId, agentType: 'explore' });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId, agentType: 'plan' });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId, agentType: 'execute' });
    expect(session.state.set).toHaveBeenCalledWith({
      factoryOrgId: 'org-1',
      factoryModelScope: 'user',
      factoryOwnerUserId: 'user-1',
    });
  });

  it('applies the Factory model and never reads the owner default under factory scope', async () => {
    const session = createSession();
    const dependencies = createDependencies(modelDefault(), 'factory');

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith('openai/factory-model');
    expect(session.state.set).toHaveBeenCalledWith({
      factoryOrgId: 'org-1',
      factoryModelScope: 'factory',
      factoryOwnerUserId: 'user-1',
    });
  });

  it("falls back to a connected provider's default model when no default was chosen", async () => {
    providerDefault.mockResolvedValueOnce('anthropic/claude-fable-5');
    const session = createSession();
    const dependencies = createDependencies(null);

    await hydrateSessionDefaultModel(session, dependencies);

    expect(providerDefault).toHaveBeenCalledExactlyOnceWith(
      { orgId: 'org-1', userId: 'user-1', credentialScope: 'user' },
      'openai/mode-default',
    );
    expect(session.model.setDefault).toHaveBeenCalledExactlyOnceWith({ modelId: 'anthropic/claude-fable-5' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith('anthropic/claude-fable-5');
  });

  it('checks the credentials the session is billed to: org credentials for Factory scope and hybrid runs', async () => {
    providerDefault.mockClear();
    const factoryScoped = createDependencies(null, 'factory');
    vi.mocked(factoryScoped.projects.getById).mockResolvedValue({
      id: 'factory-1',
      orgId: 'org-1',
      modelScope: 'factory',
      defaultModelId: null,
    } as never);
    await hydrateSessionDefaultModel(createSession(), factoryScoped);
    expect(providerDefault).toHaveBeenLastCalledWith(
      { orgId: 'org-1', userId: 'user-1', credentialScope: 'factory' },
      'openai/mode-default',
    );

    // A hybrid Factory bills interactive sessions to the user.
    await hydrateSessionDefaultModel(createSession(), createDependencies(null, 'hybrid'));
    expect(providerDefault).toHaveBeenLastCalledWith(
      { orgId: 'org-1', userId: 'user-1', credentialScope: 'user' },
      'openai/mode-default',
    );
  });

  it('keeps the session usable when the provider-default lookup fails', async () => {
    providerDefault.mockRejectedValueOnce(new Error('credentials down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = createSession();

    await hydrateSessionDefaultModel(session, createDependencies(null));

    expect(session.model.switch).not.toHaveBeenCalled();
    expect(session.state.set).toHaveBeenCalledWith(expect.objectContaining({ factoryModelScope: 'user' }));
    expect(warn).toHaveBeenCalledWith(
      '[Factory default-model hydration] Unable to resolve a provider default model.',
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it('keeps the current model when no default was chosen and no provider default applies', async () => {
    const session = createSession();

    await hydrateSessionDefaultModel(session, createDependencies(null));

    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('never consults provider defaults when a default was chosen', async () => {
    providerDefault.mockClear();
    await hydrateSessionDefaultModel(createSession(), createDependencies());
    expect(providerDefault).not.toHaveBeenCalled();
  });

  it('keeps the model of a chat that already has a user message when the session is recreated', async () => {
    const session = createSession();
    vi.mocked(session.thread.firstUserMessage).mockResolvedValue({ id: 'message-1' });
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
    expect(session.state.set).toHaveBeenCalledWith({
      factoryOrgId: 'org-1',
      factoryModelScope: 'user',
      factoryOwnerUserId: 'user-1',
    });
  });

  it('does not apply a default when thread messages cannot be read', async () => {
    const session = createSession();
    delete (session.thread as { firstUserMessage?: DefaultModelHydrationSession['thread']['firstUserMessage'] })
      .firstUserMessage;
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.sourceControl.getBySessionId).not.toHaveBeenCalled();
    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
  });

  it('clears stale Factory identity when the project is unresolvable', async () => {
    const state: Record<string, unknown> = {
      factoryOrgId: 'old-org',
      factoryModelScope: 'factory',
      factoryOwnerUserId: 'old-owner',
    };
    const session = createSession(state);
    const dependencies = createDependencies();
    vi.mocked(dependencies.projects.getById).mockResolvedValue(null);

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({
      factoryOrgId: undefined,
      factoryModelScope: undefined,
      factoryOwnerUserId: undefined,
    });
    expect(state).toEqual({
      factoryOrgId: undefined,
      factoryModelScope: undefined,
      factoryOwnerUserId: undefined,
    });
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('preserves durable Factory identity when project lookup temporarily fails', async () => {
    const state = {
      factoryOrgId: 'org-1',
      factoryModelScope: 'factory',
      factoryOwnerUserId: 'user-1',
    };
    const session = createSession(state);
    const dependencies = createDependencies();
    vi.mocked(dependencies.projects.getById).mockRejectedValue(new Error('database unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.state.set).not.toHaveBeenCalled();
    expect(state).toEqual({
      factoryOrgId: 'org-1',
      factoryModelScope: 'factory',
      factoryOwnerUserId: 'user-1',
    });
    expect(session.model.switch).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('fails closed when identity lookup errors before any Factory identity is known', async () => {
    const state: Record<string, unknown> = {};
    const session = createSession(state);
    const dependencies = createDependencies();
    vi.mocked(dependencies.sourceControl.getBySessionId).mockRejectedValue(new Error('database unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({ factoryModelScope: 'user', factoryOwnerUserId: undefined });
    expect(state).toEqual({ factoryModelScope: 'user', factoryOwnerUserId: undefined });
    expect(session.model.switch).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('normalizes a partial owner-only identity to a fail-closed stamp after lookup errors', async () => {
    const state: Record<string, unknown> = { factoryOwnerUserId: 'old-owner' };
    const session = createSession(state);
    const dependencies = createDependencies();
    vi.mocked(dependencies.sourceControl.getBySessionId).mockRejectedValue(new Error('database unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({ factoryModelScope: 'user', factoryOwnerUserId: undefined });
    expect(state).toEqual({ factoryModelScope: 'user', factoryOwnerUserId: undefined });
    warn.mockRestore();
  });

  it('does not apply a user default to Factory work sessions', async () => {
    const session = createSession({ factoryProjectId: 'factory-1' });
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.sourceControl.getBySessionId).not.toHaveBeenCalled();
    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
  });

  it('does not apply a user default to active Factory run bindings before state is seeded', async () => {
    const session = createSession({}, 'factory-1');
    const dependencies = createDependencies();
    vi.mocked(dependencies.workItems.findRunBindingByThread).mockResolvedValue({} as never);

    await hydrateSessionDefaultModel(session, dependencies);

    // The run session sits on its Factory's resource; the binding is found by its session id.
    expect(dependencies.sourceControl.getBySessionId).toHaveBeenCalledWith('session-1');
    expect(dependencies.workItems.findRunBindingByThread).toHaveBeenCalledExactlyOnceWith({
      orgId: 'org-1',
      threadId: 'session-1',
      resourceId: 'factory-1',
      sessionId: 'session-1',
      rejectAmbiguous: true,
    });
    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
  });

  it("primes the owner's scope and applies the owner default to an unbound session in hybrid scope", async () => {
    primeTenant.mockClear();
    const session = createSession();
    const dependencies = createDependencies(modelDefault(), 'hybrid');

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({
      factoryOrgId: 'org-1',
      factoryModelScope: 'user',
      factoryOwnerUserId: 'user-1',
    });
    expect(primeTenant).toHaveBeenCalledExactlyOnceWith({ orgId: 'org-1', userId: 'user-1', credentialScope: 'user' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith(modelId);
  });

  it("primes the Factory's scope and keeps the model of a run-bound thread in hybrid scope", async () => {
    primeTenant.mockClear();
    const session = createSession();
    const dependencies = createDependencies(modelDefault(), 'hybrid');
    vi.mocked(dependencies.workItems.findRunBindingByThread).mockResolvedValue({} as never);

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({
      factoryOrgId: 'org-1',
      factoryModelScope: 'factory',
      factoryOwnerUserId: 'user-1',
    });
    expect(primeTenant).toHaveBeenCalledExactlyOnceWith({
      orgId: 'org-1',
      userId: 'user-1',
      credentialScope: 'factory',
    });
    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('does nothing when the user has no default model', async () => {
    const session = createSession();
    const dependencies = createDependencies(null);

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('swallows storage errors so session creation can continue', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    vi.mocked(dependencies.modelDefaults.get).mockRejectedValue(new Error('database unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(hydrateSessionDefaultModel(session, dependencies)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[Factory default-model hydration] Unable to apply the scoped default model.',
      expect.any(Error),
    );
    expect(session.state.set).toHaveBeenCalledWith({
      factoryOrgId: 'org-1',
      factoryModelScope: 'user',
      factoryOwnerUserId: 'user-1',
    });
    expect(session.model.switch).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
