import { describe, expect, it } from 'vitest';

import type { GlobalSettings, StorageSettings } from '../../../onboarding/settings.js';
import { applyOmRoleOverride } from '../om.js';

function createSettings(overrides?: Partial<GlobalSettings['models']>): GlobalSettings {
  const storage: StorageSettings = { backend: 'libsql', libsql: {}, pg: {} };
  return {
    onboarding: {
      completedAt: null,
      skippedAt: null,
      version: 0,
      modePackId: null,
      omPackId: null,
    },
    models: {
      activeModelPackId: null,
      modeDefaults: {},
      activeOmPackId: null,
      omModelOverride: null,
      observerModelOverride: null,
      reflectorModelOverride: null,
      omObservationThreshold: null,
      omReflectionThreshold: null,
      subagentModels: {},
      ...overrides,
    },
    preferences: { yolo: null, theme: 'auto', thinkingLevel: 'off', quietMode: false },
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
  };
}

describe('applyOmRoleOverride', () => {
  it('snapshots the reflector model when switching observer off a built-in pack', () => {
    const settings = createSettings({ activeOmPackId: 'anthropic' });

    applyOmRoleOverride(settings, 'observer', 'openrouter/x-ai/grok-4-fast', 'anthropic/claude-haiku-4-5');

    expect(settings.models.activeOmPackId).toBe('custom');
    expect(settings.models.observerModelOverride).toBe('openrouter/x-ai/grok-4-fast');
    expect(settings.models.reflectorModelOverride).toBe('anthropic/claude-haiku-4-5');
  });

  it('snapshots the observer model when switching reflector off a built-in pack', () => {
    const settings = createSettings({ activeOmPackId: 'gemini' });

    applyOmRoleOverride(settings, 'reflector', 'openrouter/openai/gpt-5.4-mini', 'google/gemini-2.5-flash');

    expect(settings.models.activeOmPackId).toBe('custom');
    expect(settings.models.reflectorModelOverride).toBe('openrouter/openai/gpt-5.4-mini');
    expect(settings.models.observerModelOverride).toBe('google/gemini-2.5-flash');
  });

  it('does not clobber an existing other-role override when switching off a built-in pack', () => {
    const settings = createSettings({
      activeOmPackId: 'anthropic',
      reflectorModelOverride: 'openrouter/openai/gpt-5.4-mini',
    });

    applyOmRoleOverride(settings, 'observer', 'openrouter/x-ai/grok-4-fast', 'should-be-ignored');

    expect(settings.models.reflectorModelOverride).toBe('openrouter/openai/gpt-5.4-mini');
    expect(settings.models.observerModelOverride).toBe('openrouter/x-ai/grok-4-fast');
  });

  it('does not snapshot when already on custom', () => {
    const settings = createSettings({
      activeOmPackId: 'custom',
      observerModelOverride: 'openrouter/x-ai/grok-4-fast',
    });

    applyOmRoleOverride(settings, 'observer', 'openrouter/anthropic/claude-haiku-4-5', 'some/reflector');

    expect(settings.models.observerModelOverride).toBe('openrouter/anthropic/claude-haiku-4-5');
    expect(settings.models.reflectorModelOverride).toBeNull();
  });

  it('does not snapshot when there is no active OM pack at all', () => {
    const settings = createSettings({ activeOmPackId: null });

    applyOmRoleOverride(settings, 'observer', 'x/foo', 'y/bar');

    expect(settings.models.observerModelOverride).toBe('x/foo');
    expect(settings.models.reflectorModelOverride).toBeNull();
    expect(settings.models.activeOmPackId).toBe('custom');
  });
});
