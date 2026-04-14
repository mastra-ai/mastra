import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  getCustomProviderId,
  loadSettings,
  migrateLegacyVariedPack,
  parseCustomProviders,
  parseThreadSettings,
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
    },
    models: {
      activeModelPackId: 'anthropic',
      modeDefaults: {},
      activeOmPackId: null,
      omModelOverride: null,
      omObservationThreshold: null,
      omReflectionThreshold: null,
      subagentModels: {},
    },
    preferences: { yolo: null, theme: 'auto', thinkingLevel: 'off', quietMode: false },
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
      plan: 'openai/gpt-5.4',
      build: 'openai/gpt-5.4',
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
      modeModelId_plan: 'openai/gpt-5.4',
      modeModelId_build: 'openai/gpt-5.4',
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
