import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { describe, expect, it, vi } from 'vitest';

import type { MemorySettingsRecord } from '../storage/domains/memory-settings/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import {
  applyStoredMemorySettings,
  DEFAULT_OBSERVATION_THRESHOLD,
  DEFAULT_REFLECTION_THRESHOLD,
  hydrateSessionMemorySettings,
  type MemorySettingsHydrationDependencies,
  type MemorySettingsHydrationSession,
} from './memory-settings-hydration.js';

function createSession(state: Record<string, unknown> = {}, modelIds: { observer?: string; reflector?: string } = {}) {
  const session: MemorySettingsHydrationSession = {
    identity: { getResourceId: () => 'session-1' },
    om: {
      observer: { modelId: () => modelIds.observer, switchModel: vi.fn().mockResolvedValue(undefined) },
      reflector: { modelId: () => modelIds.reflector, switchModel: vi.fn().mockResolvedValue(undefined) },
    },
    state: {
      get: () => state,
      set: vi.fn().mockResolvedValue(undefined),
    },
  };
  return session;
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

function memorySettingsRow(overrides: Partial<MemorySettingsRecord> = {}): MemorySettingsRecord {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    observerModelId: 'anthropic/claude-haiku-4-5',
    reflectorModelId: 'anthropic/claude-haiku-4-5',
    observationThreshold: null,
    reflectionThreshold: null,
    observeAttachments: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createDependencies({
  row = sourceControlRow(),
  settings = memorySettingsRow(),
}: {
  row?: SourceControlSession | null;
  settings?: MemorySettingsRecord | null;
} = {}): MemorySettingsHydrationDependencies {
  return {
    sourceControl: { sessions: { getBySessionId: vi.fn().mockResolvedValue(row) } },
    memorySettings: { get: vi.fn().mockResolvedValue(settings) },
  };
}

describe('applyStoredMemorySettings', () => {
  it('resets knobs without a stored value to the built-in defaults', async () => {
    // A record whose model fields are null must not preserve stale session
    // values — the row is authoritative, matching the settings routes.
    const session = createSession(
      { observationThreshold: 12_000, reflectionThreshold: 21_000, observeAttachments: false },
      { observer: 'openai/gpt-5-mini', reflector: 'openai/gpt-5-mini' },
    );

    await applyStoredMemorySettings(session, memorySettingsRow({ observerModelId: null, reflectorModelId: null }));

    expect(session.om.observer.switchModel).toHaveBeenCalledExactlyOnceWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(session.om.reflector.switchModel).toHaveBeenCalledExactlyOnceWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({
      observationThreshold: DEFAULT_OBSERVATION_THRESHOLD,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
      observeAttachments: 'auto',
    });
  });

  it('applies a partial row: stored knobs win, the rest reset to defaults', async () => {
    const session = createSession({}, { observer: 'openai/gpt-5-mini', reflector: 'anthropic/claude-haiku-4-5' });

    await applyStoredMemorySettings(
      session,
      memorySettingsRow({
        observerModelId: 'anthropic/claude-haiku-4-5',
        reflectorModelId: null,
        observationThreshold: 12_000,
      }),
    );

    expect(session.om.observer.switchModel).toHaveBeenCalledExactlyOnceWith({
      modelId: 'anthropic/claude-haiku-4-5',
    });
    expect(session.om.reflector.switchModel).toHaveBeenCalledExactlyOnceWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({
      observationThreshold: 12_000,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
    });
  });

  it('skips model switches and state writes that are already in effect', async () => {
    const session = createSession(
      {
        observationThreshold: DEFAULT_OBSERVATION_THRESHOLD,
        reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
      },
      { observer: DEFAULT_OM_MODEL_ID, reflector: DEFAULT_OM_MODEL_ID },
    );

    await applyStoredMemorySettings(session, null);

    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
    expect(session.om.reflector.switchModel).not.toHaveBeenCalled();
    expect(session.state.set).not.toHaveBeenCalled();
  });
});

describe('hydrateSessionMemorySettings', () => {
  it('applies the stored OM models keyed by the session row tenant', async () => {
    const session = createSession();
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).toHaveBeenCalledExactlyOnceWith('session-1');
    expect(dependencies.memorySettings.get).toHaveBeenCalledExactlyOnceWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.om.observer.switchModel).toHaveBeenCalledExactlyOnceWith({
      modelId: 'anthropic/claude-haiku-4-5',
    });
    expect(session.om.reflector.switchModel).toHaveBeenCalledExactlyOnceWith({
      modelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it('applies stored thresholds and attachment preferences to session state', async () => {
    const session = createSession();
    const dependencies = createDependencies({
      settings: memorySettingsRow({ observationThreshold: 12_000, observeAttachments: false }),
    });

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({
      observationThreshold: 12_000,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
      observeAttachments: false,
    });
  });

  it('resets stale session state when the stored row has null knobs', async () => {
    const session = createSession(
      { observationThreshold: 99_000 },
      { observer: 'google/gemini-3.5-flash', reflector: 'google/gemini-3.5-flash' },
    );
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({
      observationThreshold: DEFAULT_OBSERVATION_THRESHOLD,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
    });
  });

  it('skips factory-run sessions, which hydrate through the start coordinator', async () => {
    const session = createSession({ factoryProjectId: 'project-1' });
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
  });

  it('skips sessions without a source-control row', async () => {
    const session = createSession();
    const dependencies = createDependencies({ row: null });

    await hydrateSessionMemorySettings(session, dependencies);

    expect(dependencies.memorySettings.get).not.toHaveBeenCalled();
    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
  });

  it('resets to defaults when the owner has no stored settings row', async () => {
    // A missing row must behave like the settings routes: stale persisted
    // session values reset to the built-in defaults instead of surviving.
    const session = createSession(
      { observationThreshold: 99_000 },
      { observer: 'openai/gpt-5-mini', reflector: 'openai/gpt-5-mini' },
    );
    const dependencies = createDependencies({ settings: null });

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.om.observer.switchModel).toHaveBeenCalledExactlyOnceWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(session.om.reflector.switchModel).toHaveBeenCalledExactlyOnceWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({
      observationThreshold: DEFAULT_OBSERVATION_THRESHOLD,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
    });
  });

  it('warns instead of throwing when a lookup fails', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    dependencies.memorySettings.get = vi.fn().mockRejectedValue(new Error('db down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(hydrateSessionMemorySettings(session, dependencies)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[Factory memory-settings hydration] Unable to apply stored memory settings.',
      expect.any(Error),
    );
    warn.mockRestore();
  });
});
