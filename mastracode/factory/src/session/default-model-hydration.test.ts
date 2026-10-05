import { describe, expect, it, vi } from 'vitest';

import type { ModelDefaultRecord } from '../storage/domains/model-defaults/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import {
  applyDefaultModel,
  hydrateSessionDefaultModel,
  type DefaultModelHydrationDependencies,
  type DefaultModelHydrationSession,
} from './default-model-hydration.js';

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

function createSession(state: Record<string, unknown> = {}): DefaultModelHydrationSession {
  return {
    identity: { getResourceId: () => 'session-1' },
    model: { switch: vi.fn().mockResolvedValue(undefined) },
    state: { get: () => state },
    subagents: { model: { set: vi.fn().mockResolvedValue(undefined) } },
    thread: {
      getId: () => 'session-1',
      getSetting: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function createDependencies(record: ModelDefaultRecord | null = modelDefault()): DefaultModelHydrationDependencies {
  return {
    sourceControl: { sessions: { getBySessionId: vi.fn().mockResolvedValue(sourceControlRow()) } },
    workItems: { findActiveRunBindingByThread: vi.fn().mockResolvedValue(null) },
    modelDefaults: { get: vi.fn().mockResolvedValue(record) },
  };
}

describe('applyDefaultModel', () => {
  it('sets the current model and every subagent model', async () => {
    const session = createSession();

    await applyDefaultModel(session, modelId);

    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith({ modelId });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId, agentType: 'explore' });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId, agentType: 'plan' });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId, agentType: 'execute' });
  });
});

describe('hydrateSessionDefaultModel', () => {
  it('applies the user default model to a new interactive session', async () => {
    const session = createSession();
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).toHaveBeenCalledExactlyOnceWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith({ modelId });
  });

  it('preserves the current thread model when the session is recreated', async () => {
    const session = createSession();
    vi.mocked(session.thread.getSetting).mockImplementation(async ({ key }) =>
      key === 'currentModelId' ? 'anthropic/claude-haiku-4-5' : undefined,
    );
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('preserves a legacy per-mode model when the session is recreated', async () => {
    const session = createSession();
    vi.mocked(session.thread.getSetting).mockImplementation(async ({ key }) =>
      key === 'modeModelId_build' ? 'anthropic/claude-haiku-4-5' : undefined,
    );
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('does not apply a default when thread settings cannot be read', async () => {
    const session = createSession();
    delete (session.thread as { getSetting?: DefaultModelHydrationSession['thread']['getSetting'] }).getSetting;
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
  });

  it('does not apply a user default to Factory work sessions', async () => {
    const session = createSession({ factoryProjectId: 'factory-1' });
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
  });

  it('does not apply a user default to active Factory run bindings before state is seeded', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    vi.mocked(dependencies.workItems.findActiveRunBindingByThread).mockResolvedValue({} as never);

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.workItems.findActiveRunBindingByThread).toHaveBeenCalledExactlyOnceWith({
      orgId: 'org-1',
      threadId: 'session-1',
      resourceId: 'session-1',
      sessionId: 'session-1',
    });
    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
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
      '[Factory default-model hydration] Unable to apply the user default model.',
      expect.any(Error),
    );
    expect(session.model.switch).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
