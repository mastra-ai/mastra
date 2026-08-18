import { describe, expect, it, vi } from 'vitest';

import type { ActiveModelPackRecord } from '../storage/domains/model-packs/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import {
  applyActiveModelPack,
  hydrateSessionModelPack,
  type ModelPackHydrationDependencies,
  type ModelPackHydrationSession,
} from './model-pack-hydration.js';

const models = {
  build: 'anthropic/claude-opus-5',
  plan: 'openai/gpt-5.6-sol',
  fast: 'anthropic/claude-sonnet-5',
};

function activePack(): ActiveModelPackRecord {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    packId: 'custom:pack-1',
    models,
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

function createSession(
  state: Record<string, unknown> = {},
  mode = 'build',
  threadPackId?: string,
): ModelPackHydrationSession {
  return {
    identity: { getResourceId: () => 'session-1' },
    mode: { get: () => mode },
    model: { switch: vi.fn().mockResolvedValue(undefined) },
    state: { get: () => state },
    subagents: { model: { set: vi.fn().mockResolvedValue(undefined) } },
    thread: {
      getId: () => 'session-1',
      getSetting: vi.fn().mockResolvedValue(threadPackId),
      setSetting: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function createDependencies(pack: ActiveModelPackRecord | null = activePack()): ModelPackHydrationDependencies {
  return {
    sourceControl: { sessions: { getBySessionId: vi.fn().mockResolvedValue(sourceControlRow()) } },
    workItems: { findActiveRunBindingByThread: vi.fn().mockResolvedValue(null) },
    modelPacks: { getActive: vi.fn().mockResolvedValue(pack) },
  };
}

describe('applyActiveModelPack', () => {
  it('sets every chat mode, current model, subagent model, and active pack marker', async () => {
    const session = createSession({}, 'plan');

    await applyActiveModelPack(session, activePack());

    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'modeModelId_build', value: models.build });
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'modeModelId_plan', value: models.plan });
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'modeModelId_fast', value: models.fast });
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'activeModelPackId', value: 'custom:pack-1' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith({ modelId: models.plan });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId: models.fast, agentType: 'explore' });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId: models.plan, agentType: 'plan' });
    expect(session.subagents.model.set).toHaveBeenCalledWith({ modelId: models.build, agentType: 'execute' });
  });
});

describe('hydrateSessionModelPack', () => {
  it('applies the user active pack to a new interactive session', async () => {
    const session = createSession();
    const dependencies = createDependencies();

    await hydrateSessionModelPack(session, dependencies);

    expect(dependencies.modelPacks.getActive).toHaveBeenCalledExactlyOnceWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith({ modelId: models.build });
  });

  it('preserves an existing thread-specific pack when the session is recreated', async () => {
    const session = createSession({}, 'build', 'custom:thread-pack');
    const dependencies = createDependencies();

    await hydrateSessionModelPack(session, dependencies);

    expect(dependencies.modelPacks.getActive).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('preserves manual thread model choices when the session is recreated', async () => {
    const session = createSession();
    vi.mocked(session.thread.getSetting!).mockImplementation(async ({ key }) =>
      key === 'modeModelId_build' ? 'anthropic/claude-haiku-4-5' : undefined,
    );
    const dependencies = createDependencies();

    await hydrateSessionModelPack(session, dependencies);

    expect(dependencies.modelPacks.getActive).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('does not apply a user pack to Factory work sessions before their state is seeded', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    vi.mocked(dependencies.workItems.findActiveRunBindingByThread).mockResolvedValue({} as never);

    await hydrateSessionModelPack(session, dependencies);

    expect(dependencies.workItems.findActiveRunBindingByThread).toHaveBeenCalledExactlyOnceWith({
      orgId: 'org-1',
      threadId: 'session-1',
      resourceId: 'session-1',
      sessionId: 'session-1',
    });
    expect(dependencies.modelPacks.getActive).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });
});
