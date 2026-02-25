import { describe, expect, it } from 'vitest';

import { migrateLegacyVariedPack, parseThreadSettings, resolveThreadActiveModelPackId } from '../settings.js';
import type { GlobalSettings, StorageSettings } from '../settings.js';

function createSettings(overrides?: Partial<GlobalSettings>): GlobalSettings {
  const storage: StorageSettings = { backend: 'libsql', libsql: {}, pg: {} };
  return {
    onboarding: {
      completedAt: null,
      skippedAt: null,
      version: 0,
      modePackId: null,
      omPackId: null,
      claudeMaxOAuthWarningAcknowledgedAt: null,
    },
    models: {
      activeModelPackId: 'anthropic',
      modeDefaults: {},
      activeOmPackId: null,
      omModelOverride: null,
      subagentModels: {},
    },
    preferences: { yolo: null, theme: 'auto' },
    storage,
    customModelPacks: [
      {
        name: 'My Pack',
        models: {
          plan: 'openai/gpt-5.3-codex',
          build: 'anthropic/claude-sonnet-4-5',
          fast: 'openai/gpt-5.1-codex-mini',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    modelUseCounts: {},
    ...overrides,
  };
}

const builtinPacks = [
  {
    id: 'anthropic',
    models: {
      plan: 'anthropic/claude-sonnet-4-5',
      build: 'anthropic/claude-sonnet-4-5',
      fast: 'anthropic/claude-haiku-4-5',
    },
  },
  {
    id: 'openai',
    models: {
      plan: 'openai/gpt-5.3-codex',
      build: 'openai/gpt-5.3-codex',
      fast: 'openai/gpt-5.1-codex-mini',
    },
  },
];

describe('parseThreadSettings', () => {
  it('extracts active pack and mode model ids from metadata', () => {
    const parsed = parseThreadSettings({
      activeModelPackId: 'custom:My Pack',
      modeModelId_plan: 'openai/gpt-5.3-codex',
      modeModelId_build: 'anthropic/claude-sonnet-4-5',
      ignored: 123,
    });

    expect(parsed.activeModelPackId).toBe('custom:My Pack');
    expect(parsed.modeModelIds).toEqual({
      plan: 'openai/gpt-5.3-codex',
      build: 'anthropic/claude-sonnet-4-5',
    });
  });

  it('returns empty values when metadata is undefined', () => {
    const parsed = parseThreadSettings(undefined);

    expect(parsed.activeModelPackId).toBeNull();
    expect(parsed.modeModelIds).toEqual({});
  });
});

describe('resolveThreadActiveModelPackId', () => {
  it('prefers explicit thread metadata pack id when valid', () => {
    const settings = createSettings();

    const resolved = resolveThreadActiveModelPackId(settings, builtinPacks, {
      activeModelPackId: 'custom:My Pack',
    });

    expect(resolved).toBe('custom:My Pack');
  });

  it('infers pack from thread modeModelId values when explicit pack id is missing', () => {
    const settings = createSettings({ models: { ...createSettings().models, activeModelPackId: 'anthropic' } });

    const resolved = resolveThreadActiveModelPackId(settings, builtinPacks, {
      modeModelId_plan: 'openai/gpt-5.3-codex',
      modeModelId_build: 'openai/gpt-5.3-codex',
      modeModelId_fast: 'openai/gpt-5.1-codex-mini',
    });

    expect(resolved).toBe('openai');
  });

  it('falls back to global activeModelPackId when no thread metadata matches', () => {
    const settings = createSettings({ models: { ...createSettings().models, activeModelPackId: 'anthropic' } });

    const resolved = resolveThreadActiveModelPackId(settings, builtinPacks, {
      modeModelId_plan: 'unknown/model',
    });

    expect(resolved).toBe('anthropic');
  });

  it('returns null when global activeModelPackId points to a deleted custom pack', () => {
    const settings = createSettings({
      customModelPacks: [],
      models: { ...createSettings().models, activeModelPackId: 'custom:Deleted Pack' },
    });

    const resolved = resolveThreadActiveModelPackId(settings, builtinPacks, {
      modeModelId_plan: 'unknown/model',
    });

    expect(resolved).toBeNull();
  });
});

describe('migrateLegacyVariedPack', () => {
  it('migrates legacy varied active selection to a custom varied pack', () => {
    const settings = createSettings({
      models: { ...createSettings().models, activeModelPackId: 'varied', modeDefaults: {} },
      onboarding: { ...createSettings().onboarding, modePackId: 'varied' },
      customModelPacks: [],
    });

    const migrated = migrateLegacyVariedPack(settings);

    expect(migrated).toBe(true);
    expect(settings.models.activeModelPackId).toBe('custom:varied');
    expect(settings.onboarding.modePackId).toBe('custom:varied');
    expect(settings.customModelPacks.find(p => p.name === 'varied')).toBeDefined();
    expect(settings.models.modeDefaults).toEqual({
      plan: 'openai/gpt-5.3-codex',
      build: 'anthropic/claude-sonnet-4-5',
      fast: 'anthropic/claude-haiku-4-5',
    });
  });
});
