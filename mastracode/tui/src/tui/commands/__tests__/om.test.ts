import type { GlobalSettings, StorageSettings } from '@mastra/code-sdk/onboarding/settings';
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
  it('pins only the observer role', () => {
    const settings = createSettings({
      activeOmPackId: 'anthropic',
      reflectorModelSelection: { mode: 'auto' },
    });

    applyOmRoleOverride(settings, 'observer', 'openrouter/x-ai/grok-4-fast');

    expect(settings.models.activeOmPackId).toBe('custom');
    expect(settings.models.observerModelOverride).toBe('openrouter/x-ai/grok-4-fast');
    expect(settings.models.observerModelSelection).toEqual({
      mode: 'model',
      modelId: 'openrouter/x-ai/grok-4-fast',
    });
    expect(settings.models.reflectorModelOverride).toBeNull();
    expect(settings.models.reflectorModelSelection).toEqual({ mode: 'auto' });
  });

  it('pins only the reflector role', () => {
    const settings = createSettings({ observerModelSelection: { mode: 'auto' } });

    applyOmRoleOverride(settings, 'reflector', 'openrouter/openai/gpt-5.4-mini');

    expect(settings.models.reflectorModelSelection).toEqual({
      mode: 'model',
      modelId: 'openrouter/openai/gpt-5.4-mini',
    });
    expect(settings.models.observerModelOverride).toBeNull();
    expect(settings.models.observerModelSelection).toEqual({ mode: 'auto' });
  });

  it('resets one explicit role to auto without changing the other role', () => {
    const settings = createSettings({
      observerModelOverride: 'openai/gpt-5.4-mini',
      observerModelSelection: { mode: 'model', modelId: 'openai/gpt-5.4-mini' },
      reflectorModelOverride: 'anthropic/claude-haiku-4-5',
      reflectorModelSelection: { mode: 'model', modelId: 'anthropic/claude-haiku-4-5' },
    });

    applyOmRoleAuto(settings, 'observer');

    expect(settings.models.observerModelOverride).toBeNull();
    expect(settings.models.observerModelSelection).toEqual({ mode: 'auto' });
    expect(settings.models.reflectorModelOverride).toBe('anthropic/claude-haiku-4-5');
    expect(settings.models.reflectorModelSelection).toEqual({
      mode: 'model',
      modelId: 'anthropic/claude-haiku-4-5',
    });
  });
});
