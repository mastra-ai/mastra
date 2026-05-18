import { describe, expect, it } from 'vitest';

import type { ModePack } from '../../../onboarding/packs.js';
import type { GlobalSettings, StorageSettings } from '../../../onboarding/settings.js';
import {
  deserializePack,
  removeCustomPackFromSettings,
  serializePack,
  upsertCustomPackInSettings,
} from '../models-pack.js';

function createSettings(overrides?: Partial<GlobalSettings>): GlobalSettings {
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
      omCavemanObservations: null,
      subagentModels: {},
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
    ...overrides,
  };
}

const alphaPack: ModePack = {
  id: 'custom:Alpha',
  name: 'Alpha',
  description: 'Saved custom pack',
  models: {
    plan: 'openai/gpt-5.3-codex',
    build: 'anthropic/claude-sonnet-4-5',
    fast: 'openai/gpt-5.1-codex-mini',
  },
};

describe('upsertCustomPackInSettings', () => {
  it('creates a new custom pack and sets it active', () => {
    const settings = createSettings();
    upsertCustomPackInSettings(settings, alphaPack, alphaPack.models);

    expect(settings.customModelPacks).toHaveLength(1);
    expect(settings.customModelPacks[0]?.name).toBe('Alpha');
    expect(settings.customModelPacks[0]?.models).toEqual(alphaPack.models);
    expect(settings.models.activeModelPackId).toBe('custom:Alpha');
    expect(settings.models.modeDefaults).toEqual(alphaPack.models);
  });

  it('updates an existing custom pack without duplicating entries', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: { plan: 'old/plan', build: 'old/build', fast: 'old/fast' },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const edited = { ...alphaPack, models: { ...alphaPack.models, fast: 'anthropic/claude-haiku-4-5' } };
    upsertCustomPackInSettings(settings, edited, edited.models);

    expect(settings.customModelPacks).toHaveLength(1);
    expect(settings.customModelPacks[0]?.models.fast).toBe('anthropic/claude-haiku-4-5');
    expect(settings.models.activeModelPackId).toBe('custom:Alpha');
  });

  it('renames custom pack without leaving stale old-name entry', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      models: {
        ...createSettings().models,
        activeModelPackId: 'custom:Alpha',
      },
      onboarding: {
        ...createSettings().onboarding,
        modePackId: 'custom:Alpha',
      },
    });

    const renamedPack: ModePack = {
      ...alphaPack,
      id: 'custom:Renamed',
      name: 'Renamed',
    };

    upsertCustomPackInSettings(settings, renamedPack, renamedPack.models, 'custom:Alpha');

    expect(settings.customModelPacks).toHaveLength(1);
    expect(settings.customModelPacks[0]?.name).toBe('Renamed');
    expect(settings.customModelPacks.find(p => p.name === 'Alpha')).toBeUndefined();
    expect(settings.models.activeModelPackId).toBe('custom:Renamed');
    expect(settings.onboarding.modePackId).toBeNull();
  });

  it('single-mode edit preserves untouched model assignments', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const editedModels = { ...alphaPack.models, fast: 'anthropic/claude-haiku-4-5' };
    upsertCustomPackInSettings(settings, alphaPack, editedModels);

    expect(settings.customModelPacks).toHaveLength(1);
    expect(settings.customModelPacks[0]?.models).toEqual({
      plan: alphaPack.models.plan,
      build: alphaPack.models.build,
      fast: 'anthropic/claude-haiku-4-5',
    });
  });

  it('can persist custom pack edits without activating edited pack', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      models: {
        ...createSettings().models,
        activeModelPackId: 'openai',
      },
    });

    const editedModels = { ...alphaPack.models, plan: 'anthropic/claude-sonnet-4-5' };
    upsertCustomPackInSettings(settings, alphaPack, editedModels, undefined, false);

    expect(settings.models.activeModelPackId).toBe('openai');
    expect(settings.customModelPacks[0]?.models.plan).toBe('anthropic/claude-sonnet-4-5');
  });

  it('does nothing when pack is not custom', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      models: {
        ...createSettings().models,
        activeModelPackId: 'anthropic',
        modeDefaults: { plan: 'existing/plan' },
      },
    });

    const builtInPack: ModePack = {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Built-in',
      models: {
        plan: 'anthropic/claude-sonnet-4-5',
        build: 'anthropic/claude-sonnet-4-5',
        fast: 'anthropic/claude-haiku-4-5',
      },
    };

    upsertCustomPackInSettings(settings, builtInPack, builtInPack.models);

    expect(settings.customModelPacks).toHaveLength(1);
    expect(settings.models.activeModelPackId).toBe('anthropic');
    expect(settings.models.modeDefaults).toEqual({ plan: 'existing/plan' });
  });
});

describe('removeCustomPackFromSettings', () => {
  it('deletes custom pack and clears active/onboarding when they reference deleted pack', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      models: {
        ...createSettings().models,
        activeModelPackId: 'custom:Alpha',
        modeDefaults: { ...alphaPack.models },
      },
      onboarding: {
        ...createSettings().onboarding,
        modePackId: 'custom:Alpha',
      },
    });

    removeCustomPackFromSettings(settings, 'custom:Alpha');

    expect(settings.customModelPacks).toEqual([]);
    expect(settings.models.activeModelPackId).toBeNull();
    expect(settings.models.modeDefaults).toEqual({});
    expect(settings.onboarding.modePackId).toBeNull();
  });

  it('deletes only the targeted custom pack and preserves unrelated selection', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          name: 'Beta',
          models: { plan: 'beta/plan', build: 'beta/build', fast: 'beta/fast' },
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      models: {
        ...createSettings().models,
        activeModelPackId: 'custom:Beta',
      },
      onboarding: {
        ...createSettings().onboarding,
        modePackId: 'custom:Beta',
      },
    });

    removeCustomPackFromSettings(settings, 'custom:Alpha');

    expect(settings.customModelPacks).toHaveLength(1);
    expect(settings.customModelPacks[0]?.name).toBe('Beta');
    expect(settings.models.activeModelPackId).toBe('custom:Beta');
    expect(settings.onboarding.modePackId).toBe('custom:Beta');
  });

  it('clears stale mode defaults that exactly match deleted custom pack', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      models: {
        ...createSettings().models,
        activeModelPackId: 'openai',
        modeDefaults: { ...alphaPack.models },
      },
    });

    removeCustomPackFromSettings(settings, 'custom:Alpha');

    expect(settings.models.activeModelPackId).toBe('openai');
    expect(settings.models.modeDefaults).toEqual({});
  });

  it('does nothing when pack id is not custom', () => {
    const settings = createSettings({
      customModelPacks: [
        {
          name: 'Alpha',
          models: alphaPack.models,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      models: {
        ...createSettings().models,
        activeModelPackId: 'custom:Alpha',
      },
      onboarding: {
        ...createSettings().onboarding,
        modePackId: 'custom:Alpha',
      },
    });

    removeCustomPackFromSettings(settings, 'anthropic');

    expect(settings.customModelPacks).toHaveLength(1);
    expect(settings.models.activeModelPackId).toBe('custom:Alpha');
    expect(settings.onboarding.modePackId).toBe('custom:Alpha');
  });
});

describe('serializePack / deserializePack', () => {
  it('round-trips a custom pack', () => {
    const serialized = serializePack(alphaPack);
    expect(serialized).toMatch(/^mastra-pack:/);

    const deserialized = deserializePack(serialized);
    expect(deserialized).not.toBeNull();
    expect(deserialized!.name).toBe('Alpha');
    expect(deserialized!.id).toBe('custom:Alpha');
    expect(deserialized!.models).toEqual(alphaPack.models);
  });

  it('round-trips a built-in pack', () => {
    const builtIn: ModePack = {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'All Anthropic models',
      models: {
        build: 'anthropic/claude-sonnet-4-5',
        plan: 'anthropic/claude-sonnet-4-5',
        fast: 'anthropic/claude-haiku-4-5',
      },
    };
    const serialized = serializePack(builtIn);
    const deserialized = deserializePack(serialized);
    expect(deserialized).not.toBeNull();
    expect(deserialized!.name).toBe('Anthropic');
    expect(deserialized!.models).toEqual(builtIn.models);
    // Imported packs always get the custom: prefix
    expect(deserialized!.id).toBe('custom:Anthropic');
  });

  it('returns null for invalid strings', () => {
    expect(deserializePack('')).toBeNull();
    expect(deserializePack('not-a-pack')).toBeNull();
    expect(deserializePack('mastra-pack:!!invalid-base64!!')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    const noName = Buffer.from(JSON.stringify({ models: { build: 'a', plan: 'b', fast: 'c' } })).toString('base64');
    expect(deserializePack(`mastra-pack:${noName}`)).toBeNull();

    const noModels = Buffer.from(JSON.stringify({ name: 'Test' })).toString('base64');
    expect(deserializePack(`mastra-pack:${noModels}`)).toBeNull();

    const partialModels = Buffer.from(JSON.stringify({ name: 'Test', models: { build: 'a' } })).toString('base64');
    expect(deserializePack(`mastra-pack:${partialModels}`)).toBeNull();
  });

  it('trims whitespace from pasted input', () => {
    const serialized = serializePack(alphaPack);
    const padded = `  \n  ${serialized}  \n  `;
    const deserialized = deserializePack(padded);
    expect(deserialized).not.toBeNull();
    expect(deserialized!.name).toBe('Alpha');
  });
});
