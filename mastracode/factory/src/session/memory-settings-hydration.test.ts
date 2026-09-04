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
    // Org pre-seeded: the seed has its own cases, and these assert the exact
    // settings write.
    const session = createSession({ factoryOrgId: 'org-1' });
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
      { observationThreshold: 99_000, factoryOrgId: 'org-1' },
      { observer: 'google/gemini-3.5-flash', reflector: 'google/gemini-3.5-flash' },
    );
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({
      observationThreshold: DEFAULT_OBSERVATION_THRESHOLD,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
    });
  });

  it('seeds the tenant org from the session row so knowledge curation is scoped to it', async () => {
    // Without this seed the curation side falls back to the session owner id —
    // the controller's own id for web chat sessions — and every curated node
    // lands under an org rung the knowledge reader never queries.
    const session = createSession();
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('does not rewrite an org that already matches the row', async () => {
    const session = createSession({ factoryOrgId: 'org-1' });
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).not.toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('overwrites a stale org with the row org, since the row is authoritative', async () => {
    const session = createSession({ factoryOrgId: 'stale-org' });
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('marks the session unresolved and does not throw when it has no source-control row', async () => {
    // No row means no org. Staying silent here is what let a Factory session be
    // mistaken for a local one and filed under a scope nothing can read.
    const session = createSession();
    const dependencies = createDependencies({ row: null });

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
    expect(session.state.set).not.toHaveBeenCalledWith(expect.objectContaining({ factoryOrgId: expect.anything() }));
    expect(dependencies.memorySettings.get).not.toHaveBeenCalled();
  });

  it('marks the session unresolved when the row carries an empty org', async () => {
    const session = createSession();
    const dependencies = createDependencies({ row: { orgId: '  ', userId: 'user-1' } as never });

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
  });

  it('re-resolves a tagged session whose stored org is blank', async () => {
    // The coordinator-hydrated early return has to agree with the curation side,
    // which trims: a blank org is unresolved, so this session still needs a seed.
    const session = createSession({ factoryProjectId: 'project-1', factoryOrgId: '   ' });
    const dependencies = createDependencies({ row: { orgId: 'org-1', userId: 'user-1' } as never });

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledWith(expect.objectContaining({ factoryOrgId: 'org-1' }));
  });

  it('marks the session unresolved when the row lookup rejects', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    dependencies.sourceControl.sessions.getBySessionId.mockRejectedValueOnce(new Error('storage down'));

    await expect(hydrateSessionMemorySettings(session, dependencies)).resolves.toBeUndefined();

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
  });

  it('seeds the org on a tagged session that never went through the coordinator', async () => {
    // A web chat session persists `factoryProjectId` from its browser seed, so on
    // resume it carries the tag with no org. Skipping on the tag alone would leave
    // it mis-scoped forever. Settings still belong to the coordinator.
    const session = createSession({ factoryProjectId: 'project-1' });
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(session.state.set).toHaveBeenCalledExactlyOnceWith({ factoryOrgId: 'org-1' });
    expect(dependencies.memorySettings.get).not.toHaveBeenCalled();
    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
  });

  it('skips fully hydrated factory-run sessions, which the start coordinator owns', async () => {
    const session = createSession({ factoryProjectId: 'project-1', factoryOrgId: 'org-1' });
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(session.state.set).not.toHaveBeenCalled();
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
      { observationThreshold: 99_000, factoryOrgId: 'org-1' },
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
