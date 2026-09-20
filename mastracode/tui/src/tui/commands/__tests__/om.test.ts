import type { GlobalSettings, StorageSettings } from '@mastra/code-sdk/onboarding/settings';
import { resolveOmRoleModel } from '@mastra/code-sdk/onboarding/settings';
import { describe, expect, it } from 'vitest';

import { applyOmRoleAuto, applyOmRoleOverride } from '../om.js';

function createSettings(overrides?: Partial<GlobalSettings['models']>): GlobalSettings {
  const storage: StorageSettings = { backend: 'libsql', libsql: {}, pg: {} };
  return {
    onboarding: {
      completedAt: null,
      skippedAt: null,
      version: 0,
      modePackId: null,
      omPackId: null,
      quietModePreferenceSelected: true,
    },
    models: {
      activeModelPackId: null,
      modeDefaults: {},
      modeThinkingDefaults: {},
      activeOmPackId: null,
      omModelOverride: null,
      observerModelOverride: null,
      observerModelSelection: null,
      reflectorModelOverride: null,
      reflectorModelSelection: null,
      omObservationThreshold: null,
      omReflectionThreshold: null,
      omCavemanObservations: null,
      omObserveAttachments: null,
      subagentModels: {},
      goalJudgeModel: null,
      goalMaxTurns: null,
      ...overrides,
    },
    preferences: {
      yolo: null,
      theme: 'auto',
      thinkingLevel: 'off',
      quietMode: false,
      quietModeMaxToolPreviewLines: 2,
    },
    storage,
    customModelPacks: [],
    customProviders: [],
    modelUseCounts: {},
    updateDismissedVersion: null,
    memoryGateway: {},
    browser: {
      enabled: false,
      provider: 'stagehand',
      headless: false,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'LOCAL' },
    },
  } as unknown as GlobalSettings;
}

describe('OM role selection persistence', () => {
  const BUILTIN_PACKS = [
    { id: 'anthropic', modelId: 'anthropic/claude-haiku-4-5' },
    { id: 'openai', modelId: 'openai/gpt-5.4-mini' },
  ];

  it('pins only the observer role and leaves the reflector on its built-in pack', () => {
    // Pre-branch upgrade shape: a built-in pack is active and neither role has
    // intent yet. Pinning one role must not move the other off the pack.
    const settings = createSettings({ activeOmPackId: 'anthropic' });

    applyOmRoleOverride(settings, 'observer', 'openrouter/x-ai/grok-4-fast');

    expect(settings.models.activeOmPackId).toBe('anthropic');
    expect(settings.models.observerModelOverride).toBe('openrouter/x-ai/grok-4-fast');
    expect(settings.models.observerModelSelection).toBe('openrouter/x-ai/grok-4-fast');
    expect(settings.models.reflectorModelOverride).toBeNull();
    expect(settings.models.reflectorModelSelection).toBeNull();
    expect(resolveOmRoleModel(settings, 'reflector', BUILTIN_PACKS)).toBe('anthropic/claude-haiku-4-5');
    expect(resolveOmRoleModel(settings, 'observer', BUILTIN_PACKS)).toBe('openrouter/x-ai/grok-4-fast');
  });

  it('pins only the reflector role and leaves the observer on its built-in pack', () => {
    const settings = createSettings({ activeOmPackId: 'anthropic' });

    applyOmRoleOverride(settings, 'reflector', 'openrouter/openai/gpt-5.4-mini');

    expect(settings.models.activeOmPackId).toBe('anthropic');
    expect(settings.models.reflectorModelSelection).toBe('openrouter/openai/gpt-5.4-mini');
    expect(settings.models.observerModelOverride).toBeNull();
    expect(settings.models.observerModelSelection).toBeNull();
    expect(resolveOmRoleModel(settings, 'observer', BUILTIN_PACKS)).toBe('anthropic/claude-haiku-4-5');
    expect(resolveOmRoleModel(settings, 'reflector', BUILTIN_PACKS)).toBe('openrouter/openai/gpt-5.4-mini');
  });

  it('resets one explicit role to auto without changing the other role', () => {
    const settings = createSettings({
      activeOmPackId: 'anthropic',
      observerModelOverride: 'openai/gpt-5.4-mini',
      observerModelSelection: 'openai/gpt-5.4-mini',
    });

    applyOmRoleAuto(settings, 'observer');

    expect(settings.models.activeOmPackId).toBe('anthropic');
    expect(settings.models.observerModelOverride).toBeNull();
    expect(settings.models.observerModelSelection).toBe('auto');
    expect(settings.models.reflectorModelSelection).toBeNull();
    expect(resolveOmRoleModel(settings, 'observer', BUILTIN_PACKS)).toBeNull();
    expect(resolveOmRoleModel(settings, 'reflector', BUILTIN_PACKS)).toBe('anthropic/claude-haiku-4-5');
  });

  it('keeps an explicit other role untouched when one role changes', () => {
    const settings = createSettings({
      activeOmPackId: 'anthropic',
      reflectorModelOverride: 'openai/gpt-5.4-mini',
      reflectorModelSelection: 'openai/gpt-5.4-mini',
    });

    applyOmRoleAuto(settings, 'observer');

    expect(settings.models.reflectorModelOverride).toBe('openai/gpt-5.4-mini');
    expect(settings.models.reflectorModelSelection).toBe('openai/gpt-5.4-mini');
    expect(resolveOmRoleModel(settings, 'reflector', BUILTIN_PACKS)).toBe('openai/gpt-5.4-mini');
  });
});
