import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  getCustomProviderId,
  loadSettings,
  migrateLegacyVariedPack,
  parseCustomProviders,
  parseThreadSettings,
  resolveOmRoleModel,
  resolveThreadActiveModelPackId,
  saveSettings,
} from '../settings.js';
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
      quietModePreferenceSelected: true,
    },
    models: {
      activeModelPackId: 'anthropic',
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
      goalJudgeModel: null,
      goalMaxTurns: null,
    },
    preferences: { yolo: null, theme: 'auto', thinkingLevel: 'off', quietMode: false, quietModeMaxToolPreviewLines: 2 },
    storage,
    customProviders: [],
    customModelPacks: [
      {
        name: 'My Pack',
        models: {
          plan: 'openai/gpt-5.4',
          build: 'anthropic/claude-sonnet-4-5',
          fast: 'openai/gpt-5.4-mini',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
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
    observability: { resources: {}, localTracing: false },
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
      plan: 'openai/gpt-5.5',
      build: 'openai/gpt-5.5',
      fast: 'openai/gpt-5.4-mini',
    },
  },
];

function withTempSettingsFile(run: (filePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'mastracode-settings-'));
  const filePath = join(dir, 'settings.json');
  try {
    run(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('customProviders parsing/persistence', () => {
  it('returns defaults with empty customProviders when missing from settings file', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ onboarding: {}, models: {}, preferences: {}, storage: {} }), 'utf-8');

      const settings = loadSettings(filePath);

      expect(settings.customProviders).toEqual([]);
      expect(settings.preferences.thinkingLevel).toBe('off');
      expect(settings.preferences.quietModeMaxToolPreviewLines).toBe(2);
    });
  });

  it('normalizes quiet mode preview line limits', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({ onboarding: {}, models: {}, preferences: { quietModeMaxToolPreviewLines: 2.9 }, storage: {} }),
        'utf-8',
      );
      expect(loadSettings(filePath).preferences.quietModeMaxToolPreviewLines).toBe(2);

      writeFileSync(
        filePath,
        JSON.stringify({ onboarding: {}, models: {}, preferences: { quietModeMaxToolPreviewLines: -4 }, storage: {} }),
        'utf-8',
      );
      expect(loadSettings(filePath).preferences.quietModeMaxToolPreviewLines).toBe(0);

      writeFileSync(
        filePath,
        JSON.stringify({ onboarding: {}, models: {}, preferences: { quietModeMaxToolPreviewLines: 999 }, storage: {} }),
        'utf-8',
      );
      expect(loadSettings(filePath).preferences.quietModeMaxToolPreviewLines).toBe(8);

      writeFileSync(filePath, '{}', 'utf-8');
      vi.spyOn(JSON, 'parse').mockReturnValueOnce({
        onboarding: { quietModePreferenceSelected: true },
        models: {},
        preferences: { quietModeMaxToolPreviewLines: Number.NaN },
        storage: {},
      });
      expect(loadSettings(filePath).preferences.quietModeMaxToolPreviewLines).toBe(2);
      vi.mocked(JSON.parse).mockRestore();

      vi.spyOn(JSON, 'parse').mockReturnValueOnce({
        onboarding: { quietModePreferenceSelected: true },
        models: {},
        preferences: { quietModeMaxToolPreviewLines: Number.POSITIVE_INFINITY },
        storage: {},
      });
      expect(loadSettings(filePath).preferences.quietModeMaxToolPreviewLines).toBe(2);
      vi.mocked(JSON.parse).mockRestore();
    });
  });

  it('defaults new installs to quiet mode with the preference selected', () => {
    withTempSettingsFile(filePath => {
      const settings = loadSettings(filePath);

      expect(settings.preferences.quietMode).toBe(true);
      expect(settings.onboarding.quietModePreferenceSelected).toBe(true);
    });
  });

  it('marks existing classic users as needing the quiet mode preference prompt', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({ onboarding: {}, models: {}, preferences: { quietMode: false }, storage: {} }),
        'utf-8',
      );

      const settings = loadSettings(filePath);

      expect(settings.preferences.quietMode).toBe(false);
      expect(settings.onboarding.quietModePreferenceSelected).toBe(false);
    });
  });

  it('does not prompt existing users who already enabled quiet mode', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({ onboarding: {}, models: {}, preferences: { quietMode: true }, storage: {} }),
        'utf-8',
      );

      const settings = loadSettings(filePath);

      expect(settings.preferences.quietMode).toBe(true);
      expect(settings.onboarding.quietModePreferenceSelected).toBe(true);
    });
  });

  it('preserves existing quiet mode preference selections', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({
          onboarding: { quietModePreferenceSelected: true },
          models: {},
          preferences: { quietMode: false },
          storage: {},
        }),
        'utf-8',
      );

      const settings = loadSettings(filePath);

      expect(settings.preferences.quietMode).toBe(false);
      expect(settings.onboarding.quietModePreferenceSelected).toBe(true);
    });
  });

  it('normalizes invalid thinking levels to off while preserving valid values', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({
          onboarding: {},
          models: {},
          preferences: { thinkingLevel: 'extreme' },
          storage: {},
          customProviders: [],
          customModelPacks: [],
          modelUseCounts: {},
          updateDismissedVersion: null,
        }),
        'utf-8',
      );

      const invalidLevel = loadSettings(filePath);
      expect(invalidLevel.preferences.thinkingLevel).toBe('off');

      writeFileSync(
        filePath,
        JSON.stringify({
          ...invalidLevel,
          preferences: { ...invalidLevel.preferences, thinkingLevel: 'high' },
        }),
        'utf-8',
      );

      const validLevel = loadSettings(filePath);
      expect(validLevel.preferences.thinkingLevel).toBe('high');
    });
  });

  it('parses and sanitizes custom provider entries', () => {
    const providers = parseCustomProviders([
      {
        name: '  Local OpenAI ',
        url: ' https://localhost:1234/v1  ',
        apiKey: '  sk-local  ',
        models: [' foo/bar ', 'foo/bar', ' baz/qux ', '', 123],
      },
      {
        name: 'No Key Provider',
        url: 'https://models.example.com/v1',
        apiKey: '   ',
        models: ['one/model'],
      },
      {
        name: '',
        url: 'https://invalid.example.com/v1',
        models: ['should/not/appear'],
      },
      {
        name: 'Missing URL',
        url: ' ',
        models: ['should/not/appear'],
      },
      'not-an-object',
    ]);

    expect(providers).toEqual([
      {
        name: 'Local OpenAI',
        url: 'https://localhost:1234/v1',
        apiKey: 'sk-local',
        models: ['foo/bar', 'baz/qux'],
      },
      {
        name: 'No Key Provider',
        url: 'https://models.example.com/v1',
        models: ['one/model'],
      },
    ]);
  });

  it('creates custom provider ids without custom- prefix', () => {
    expect(getCustomProviderId('Acme Provider')).toBe('acme-provider');
    expect(getCustomProviderId('  !!!  ')).toBe('provider');
  });

  it('round-trips optional api keys without forcing apiKey field', () => {
    withTempSettingsFile(filePath => {
      const initialSettings = createSettings({
        customProviders: [
          {
            name: 'No-Key',
            url: 'https://no-key.example.com/v1',
            models: ['no-key/model-1'],
          },
          {
            name: 'With-Key',
            url: 'https://with-key.example.com/v1',
            apiKey: 'secret-token',
            models: ['with-key/model-1', 'with-key/model-2'],
          },
        ],
      });

      saveSettings(initialSettings, filePath);

      const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as { customProviders: Array<Record<string, unknown>> };
      expect(raw.customProviders[0]).not.toHaveProperty('apiKey');
      expect(raw.customProviders[1]?.apiKey).toBe('secret-token');

      const loaded = loadSettings(filePath);
      expect(loaded.customProviders).toEqual([
        {
          name: 'No-Key',
          url: 'https://no-key.example.com/v1',
          models: ['model-1'],
        },
        {
          name: 'With-Key',
          url: 'https://with-key.example.com/v1',
          apiKey: 'secret-token',
          models: ['model-1', 'model-2'],
        },
      ]);
    });
  });
});

describe('parseThreadSettings', () => {
  it('extracts active pack and mode model ids from metadata', () => {
    const parsed = parseThreadSettings({
      activeModelPackId: 'custom:My Pack',
      modeModelId_plan: 'openai/gpt-5.4',
      modeModelId_build: 'anthropic/claude-sonnet-4-5',
      ignored: 123,
    });

    expect(parsed.activeModelPackId).toBe('custom:My Pack');
    expect(parsed.modeModelIds).toEqual({
      plan: 'openai/gpt-5.4',
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
      modeModelId_plan: 'openai/gpt-5.5',
      modeModelId_build: 'openai/gpt-5.5',
      modeModelId_fast: 'openai/gpt-5.4-mini',
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

describe('resolveOmRoleModel', () => {
  const omPacks = [
    { id: 'anthropic', modelId: 'anthropic/claude-haiku-4-5' },
    { id: 'gemini', modelId: 'google/gemini-2.5-flash' },
  ];

  it('returns per-role overrides independently when both are set', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeOmPackId: 'custom',
        omModelOverride: 'shared/fallback',
        observerModelOverride: 'openrouter/anthropic/claude-haiku-4-5',
        reflectorModelOverride: 'openrouter/openai/gpt-5.4-mini',
      },
    });

    expect(resolveOmRoleModel(settings, 'observer', omPacks)).toBe('openrouter/anthropic/claude-haiku-4-5');
    expect(resolveOmRoleModel(settings, 'reflector', omPacks)).toBe('openrouter/openai/gpt-5.4-mini');
  });

  it('falls back to omModelOverride when the role-specific override is null (back-compat)', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeOmPackId: 'custom',
        omModelOverride: 'shared/fallback',
        observerModelOverride: null,
        reflectorModelOverride: null,
      },
    });

    expect(resolveOmRoleModel(settings, 'observer', omPacks)).toBe('shared/fallback');
    expect(resolveOmRoleModel(settings, 'reflector', omPacks)).toBe('shared/fallback');
  });

  it('resolves a built-in OM pack when no role override is set', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeOmPackId: 'anthropic',
        omModelOverride: null,
        observerModelOverride: null,
        reflectorModelOverride: null,
      },
    });

    expect(resolveOmRoleModel(settings, 'observer', omPacks)).toBe('anthropic/claude-haiku-4-5');
    expect(resolveOmRoleModel(settings, 'reflector', omPacks)).toBe('anthropic/claude-haiku-4-5');
  });

  it('prefers role-specific override even when an active built-in pack exists', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeOmPackId: 'anthropic',
        omModelOverride: null,
        observerModelOverride: 'openrouter/x-ai/grok-4-fast',
        reflectorModelOverride: null,
      },
    });

    expect(resolveOmRoleModel(settings, 'observer', omPacks)).toBe('openrouter/x-ai/grok-4-fast');
    expect(resolveOmRoleModel(settings, 'reflector', omPacks)).toBe('anthropic/claude-haiku-4-5');
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
      plan: 'openai/gpt-5.4',
      build: 'anthropic/claude-sonnet-4-5',
      fast: 'anthropic/claude-haiku-4-5',
    });
  });
});
