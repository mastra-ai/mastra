import { describe, expect, it, vi } from 'vitest';

import type { ModelDefaultRecord } from '../storage/domains/model-defaults/base.js';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import type { SourceControlSession, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import {
  hydrateSessionDefaultModel,
  type DefaultModelHydrationDependencies,
  type DefaultModelHydrationSession,
} from './default-model-hydration.js';
import { SEEDED_MODEL_SELECTION_KEY } from './model-selection.js';

const PERSONAL_MODEL_ID = 'anthropic/claude-opus-5';
const FACTORY_MODEL_ID = 'openai/gpt-5.6';

function personalDefault(): ModelDefaultRecord {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    modelId: PERSONAL_MODEL_ID,
    thinkingLevel: 'high',
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

function createSession({
  state = {},
  seeded,
  messages = [],
}: { state?: Record<string, unknown>; seeded?: unknown; messages?: unknown[] } = {}) {
  return {
    identity: { getResourceId: () => 'session-1' },
    model: { switch: vi.fn().mockResolvedValue(undefined) },
    state: { get: () => state, set: vi.fn().mockResolvedValue(undefined) },
    subagents: { model: { set: vi.fn().mockResolvedValue(undefined) } },
    thread: {
      getId: () => 'session-1',
      getSetting: vi.fn(async ({ key }: { key: string }) => (key === SEEDED_MODEL_SELECTION_KEY ? seeded : undefined)),
      setSetting: vi.fn().mockResolvedValue(undefined),
      listActiveMessages: vi.fn().mockResolvedValue(messages),
    },
  } satisfies DefaultModelHydrationSession;
}

function createDependencies({
  personal = personalDefault(),
  factory = { defaultModelId: FACTORY_MODEL_ID },
}: {
  personal?: ModelDefaultRecord | null;
  factory?: Pick<FactoryProject, 'defaultModelId'> | null;
} = {}) {
  const sourceControlHandle = {
    sessions: { getBySessionId: vi.fn().mockResolvedValue(sourceControlRow()) },
    projectRepositories: { get: vi.fn().mockResolvedValue({ id: 'repo-1', connectionId: 'connection-1' }) },
    connections: { get: vi.fn().mockResolvedValue({ id: 'connection-1', factoryProjectId: 'factory-1' }) },
  } as unknown as SourceControlStorageHandle;
  return {
    sourceControl: {
      sessions: {
        getBySessionId: vi.fn().mockResolvedValue(sourceControlRow()),
        getSourceControlBySessionId: vi.fn().mockResolvedValue(sourceControlHandle),
      },
    },
    workItems: { findActiveRunBindingByThread: vi.fn().mockResolvedValue(null) },
    modelDefaults: { get: vi.fn().mockResolvedValue(personal) },
    projects: { getById: vi.fn().mockResolvedValue(factory ? { id: 'factory-1', ...factory } : null) },
  } satisfies DefaultModelHydrationDependencies;
}

describe('hydrateSessionDefaultModel', () => {
  it('seeds a new thread with the personal pair and marks it seeded', async () => {
    const session = createSession();
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).toHaveBeenCalledExactlyOnceWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith(PERSONAL_MODEL_ID, { thinkingLevel: 'high' });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId: PERSONAL_MODEL_ID, agentType: 'execute' });
    expect(session.thread.setSetting).toHaveBeenCalledWith({
      key: SEEDED_MODEL_SELECTION_KEY,
      value: { modelId: PERSONAL_MODEL_ID, thinkingLevel: 'high' },
    });
  });

  it('falls back to the Factory default model, clearing any thread level, when the owner has no personal default', async () => {
    const session = createSession();
    const dependencies = createDependencies({ personal: null });

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.projects.getById).toHaveBeenCalledExactlyOnceWith({ id: 'factory-1' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith(FACTORY_MODEL_ID);
    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({ thinkingLevel: undefined });
    expect(session.thread.setSetting).toHaveBeenCalledWith({
      key: SEEDED_MODEL_SELECTION_KEY,
      value: { modelId: FACTORY_MODEL_ID, thinkingLevel: null },
    });
  });

  it('given a default without a thinking level, then the thread override is cleared so the Factory fallback applies', async () => {
    const session = createSession({ state: { thinkingLevel: 'max' } });
    const dependencies = createDependencies({ personal: { ...personalDefault(), thinkingLevel: null } });

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith(PERSONAL_MODEL_ID);
    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({ thinkingLevel: undefined });
  });

  it('keeps an already seeded thread when the session is recreated', async () => {
    const session = createSession({
      seeded: { modelId: FACTORY_MODEL_ID, thinkingLevel: null },
    });
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('keeps a thread that already has messages', async () => {
    const session = createSession({ messages: [{ id: 'message-1' }] });
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('does not seed Factory work sessions', async () => {
    const session = createSession({ state: { factoryProjectId: 'factory-1' } });
    const dependencies = createDependencies();

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('does not seed active Factory run bindings before state is seeded', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    dependencies.workItems.findActiveRunBindingByThread.mockResolvedValue({});

    await hydrateSessionDefaultModel(session, dependencies);

    expect(dependencies.workItems.findActiveRunBindingByThread).toHaveBeenCalledExactlyOnceWith({
      orgId: 'org-1',
      threadId: 'session-1',
      resourceId: 'session-1',
      sessionId: 'session-1',
    });
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('leaves the mode default when neither the owner nor the Factory has a default', async () => {
    const session = createSession();
    const dependencies = createDependencies({ personal: null, factory: { defaultModelId: null } });

    await hydrateSessionDefaultModel(session, dependencies);

    expect(session.model.switch).not.toHaveBeenCalled();
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('swallows storage errors so session creation can continue', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    dependencies.modelDefaults.get.mockRejectedValue(new Error('database unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(hydrateSessionDefaultModel(session, dependencies)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[Factory default-model hydration] Unable to apply the default model.',
      expect.any(Error),
    );
    expect(session.model.switch).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
