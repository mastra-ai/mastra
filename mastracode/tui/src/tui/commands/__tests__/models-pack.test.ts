import { stripVTControlCharacters } from 'node:util';
import type { ModePack } from '@mastra/code-sdk/onboarding/packs';
import type { GlobalSettings, StorageSettings } from '@mastra/code-sdk/onboarding/settings';
import chalk from 'chalk';
import { describe, expect, it } from 'vitest';
import {
  activateActionDetail,
  deserializePack,
  fallbackPackCandidates,
  formatFallbackChainPreview,
  formatFallbackChainPreviewStyled,
  formatPackFallbackChain,
  getOverriddenPackModes,
  handleModelsPackCommand,
  removeCustomPackFromSettings,
  resetBuiltinPackOverrides,
  serializePack,
  setPackFallback,
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
      omObserveAttachments: null,
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

describe('getOverriddenPackModes', () => {
  it('identifies only modes whose effective model differs from the built-in pack', () => {
    const builtinPack: ModePack = {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Built-in',
      models: {
        plan: 'anthropic/claude-opus-4-6',
        build: 'anthropic/claude-opus-4-6',
        fast: 'anthropic/claude-haiku-4-5',
      },
    };
    const modifiedPack: ModePack = {
      ...builtinPack,
      models: { ...builtinPack.models, build: 'anthropic/claude-sonnet-4-6' },
    };

    expect(getOverriddenPackModes(modifiedPack, builtinPack)).toEqual(['build']);
  });
});

describe('handleModelsPackCommand', () => {
  it('creates a pending new thread before resolving model packs', async () => {
    const events: string[] = [];
    const ctx = {
      state: {
        pendingNewThread: true,
        session: {
          thread: {
            create: async () => {
              events.push('create');
            },
          },
        },
        controller: {
          listAvailableModels: async () => {
            events.push('list-models');
            throw new Error('stop after ordering check');
          },
        },
      },
    } as any;

    await expect(handleModelsPackCommand(ctx)).rejects.toThrow('stop after ordering check');

    expect(events).toEqual(['create', 'list-models']);
    expect(ctx.state.pendingNewThread).toBe(false);
  });
});

describe('setPackFallback', () => {
  it('sets and clears a fallback on a builtin pack', () => {
    const settings = createSettings();

    setPackFallback(settings, 'anthropic', 'openai');
    expect(settings.models.packFallbacks).toEqual({ anthropic: 'openai' });

    setPackFallback(settings, 'anthropic', null);
    expect(settings.models.packFallbacks).toEqual({});
  });

  it('sets a fallback on a custom pack and overwrites an existing one', () => {
    const settings = createSettings();

    setPackFallback(settings, 'custom:Alpha', 'anthropic');
    setPackFallback(settings, 'custom:Alpha', 'github-copilot');
    expect(settings.models.packFallbacks).toEqual({ 'custom:Alpha': 'github-copilot' });
  });

  it('tolerates a settings object without a packFallbacks map', () => {
    const settings = createSettings();
    delete (settings.models as { packFallbacks?: Record<string, string> }).packFallbacks;

    setPackFallback(settings, 'anthropic', 'openai');
    expect(settings.models.packFallbacks).toEqual({ anthropic: 'openai' });
  });
});

describe('fallbackPackCandidates', () => {
  const packs: ModePack[] = [
    { id: 'anthropic', name: 'Anthropic', description: '', models: {} },
    { id: 'openai', name: 'OpenAI', description: '', models: {} },
    alphaPack,
    { id: 'custom', name: 'New Custom', description: '', models: {} },
  ];

  it('excludes the pack itself and the New Custom pseudo-row', () => {
    expect(fallbackPackCandidates(packs, 'anthropic').map(p => p.id)).toEqual(['openai', 'custom:Alpha']);
    expect(fallbackPackCandidates(packs, 'custom:Alpha').map(p => p.id)).toEqual(['anthropic', 'openai']);
  });
});

describe('formatPackFallbackChain', () => {
  const packs: ModePack[] = [
    { id: 'anthropic', name: 'Anthropic', description: '', models: {} },
    { id: 'openai', name: 'OpenAI', description: '', models: {} },
    { id: 'github-copilot', name: 'GitHub Copilot', description: '', models: {} },
  ];

  it('renders the implied chain and null when no fallback is set', () => {
    const settings = createSettings();
    expect(formatPackFallbackChain(settings, packs, 'anthropic')).toBeNull();

    setPackFallback(settings, 'anthropic', 'openai');
    setPackFallback(settings, 'openai', 'github-copilot');
    expect(formatPackFallbackChain(settings, packs, 'anthropic')).toBe('OpenAI → GitHub Copilot');
  });

  it('caps cycles at one revisit, matching the runtime cascade', () => {
    const settings = createSettings();
    setPackFallback(settings, 'anthropic', 'openai');
    setPackFallback(settings, 'openai', 'anthropic');

    // One revisit total per cascade, so the A⇄B cycle renders A's single
    // revisit and then stops.
    expect(formatPackFallbackChain(settings, packs, 'anthropic')).toBe('OpenAI → Anthropic');
  });
});

describe('formatFallbackChainPreview', () => {
  const packs: ModePack[] = [
    { id: 'anthropic', name: 'Anthropic', description: '', models: {} },
    { id: 'openai', name: 'OpenAI', description: '', models: {} },
    { id: 'github-copilot', name: 'GitHub Copilot', description: '', models: {} },
  ];
  const anthropic = packs[0]!;

  it('changes with the highlighted candidate, like moving the picker cursor', () => {
    const settings = createSettings();
    // An existing downstream chain: OpenAI already falls back to Copilot.
    setPackFallback(settings, 'openai', 'github-copilot');

    // Hovering "OpenAI" shows the full chain through its own fallback…
    expect(formatFallbackChainPreview(settings, packs, anthropic, 'openai')).toBe(
      'When Anthropic is unavailable: Anthropic → OpenAI → GitHub Copilot',
    );
    // …moving to "GitHub Copilot" shortens it…
    expect(formatFallbackChainPreview(settings, packs, anthropic, 'github-copilot')).toBe(
      'When Anthropic is unavailable: Anthropic → GitHub Copilot',
    );
    // …and landing on "Clear fallback" shows the no-fallback line.
    expect(formatFallbackChainPreview(settings, packs, anthropic, null)).toBe(
      'No fallback — when Anthropic is unavailable the error surfaces.',
    );

    // Hovering never mutates the real settings.
    expect(settings.models.packFallbacks).toEqual({ openai: 'github-copilot' });
  });
});

describe('fallback chain highlighting', () => {
  const packs: ModePack[] = [
    { id: 'anthropic', name: 'Anthropic', description: '', models: {} },
    { id: 'openai', name: 'OpenAI', description: '', models: {} },
    { id: 'github-copilot', name: 'GitHub Copilot', description: '', models: {} },
  ];
  const anthropic = packs[0]!;

  it('activate detail appends the fallback chain only when one is set', () => {
    const settings = createSettings();
    const base = '  plan  → anthropic/some-model';
    expect(stripVTControlCharacters(activateActionDetail(base, settings, packs, 'anthropic'))).toBe(base);

    setPackFallback(settings, 'anthropic', 'openai');
    expect(stripVTControlCharacters(activateActionDetail(base, settings, packs, 'anthropic'))).toBe(
      `${base}\n  fallback → OpenAI`,
    );
  });

  it('styled preview matches the plain text and highlights the chain in color', () => {
    const settings = createSettings();
    setPackFallback(settings, 'openai', 'github-copilot');

    const plain = formatFallbackChainPreview(settings, packs, anthropic, 'openai');
    const esc = String.fromCharCode(27);

    const previousLevel = chalk.level;
    chalk.level = 3;
    try {
      const styled = formatFallbackChainPreviewStyled(settings, packs, anthropic, 'openai');
      // Same words as the plain preview, with ANSI color in the output.
      expect(stripVTControlCharacters(styled).trim()).toBe(plain);
      expect(styled).toContain(`${esc}[`);

      // The no-fallback line has no chain to highlight but the same words.
      const cleared = formatFallbackChainPreviewStyled(settings, packs, anthropic, null);
      expect(stripVTControlCharacters(cleared).trim()).toBe(
        'No fallback — when Anthropic is unavailable the error surfaces.',
      );
    } finally {
      chalk.level = previousLevel;
    }
  });
});

describe('resetBuiltinPackOverrides', () => {
  it('removes the selected pack overrides and clears stale active mode defaults', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeModelPackId: 'anthropic',
        modeDefaults: { build: 'anthropic/overridden' },
        modePackOverrides: {
          anthropic: { build: 'anthropic/overridden' },
          openai: { plan: 'openai/overridden' },
        },
      },
    });

    resetBuiltinPackOverrides(settings, 'anthropic');

    expect(settings.models.modePackOverrides).toEqual({ openai: { plan: 'openai/overridden' } });
    expect(settings.models.modeDefaults).toEqual({});
  });

  it('does not clear defaults when resetting an inactive pack', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeModelPackId: 'openai',
        modeDefaults: { build: 'openai/current' },
        modePackOverrides: { anthropic: { build: 'anthropic/overridden' } },
      },
    });

    resetBuiltinPackOverrides(settings, 'anthropic');

    expect(settings.models.modePackOverrides).toEqual({});
    expect(settings.models.modeDefaults).toEqual({ build: 'openai/current' });
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
