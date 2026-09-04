import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { applyOMDefaultIfUnconfigured, hasExplicitOMConfiguration } from '../om-settings.js';
import {
  createBrowserFromSettings,
  getCustomProviderId,
  loadSettings,
  migrateLegacyVariedPack,
  parseCustomProviders,
  parseThreadSettings,
  parseViewportInput,
  resolveDefaultThinkingLevel,
  resolveLspSetting,
  resolveModelDefaults,
  resolveOmRoleModel,
  resolveThreadActiveModelPackId,
  saveSettings,
  stripMastraCodeCustomProviderPrefix,
} from '../settings.js';
import type { BrowserSettings, CustomProviderSetting, GlobalSettings, StorageSettings } from '../settings.js';

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
      modePackOverrides: {},
      modeDefaults: {},
      modeThinkingDefaults: {},
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
    shellPassthrough: { mode: 'default' },
    voice: { enabled: false, engine: 'cloud', provider: 'openai', model: 'whisper-1' },
    backgroundTools: { enabled: false },
    signals: { unixSocketPubSub: false, experimentalGithubSignals: false, githubPollIntervalMs: 300_000 },
    mcp: { claudeCodeGlobal: false, codexGlobal: false },
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

describe('explicit OM configuration', () => {
  it('reports untouched settings as unconfigured', () => {
    expect(hasExplicitOMConfiguration(createSettings())).toBe(false);
  });

  it.each([
    [
      'onboarding pack',
      (settings: GlobalSettings) => {
        settings.onboarding.omPackId = 'anthropic';
      },
    ],
    [
      'active pack',
      (settings: GlobalSettings) => {
        settings.models.activeOmPackId = 'openai';
      },
    ],
    [
      'shared model override',
      (settings: GlobalSettings) => {
        settings.models.omModelOverride = 'custom/shared';
      },
    ],
    [
      'observer override',
      (settings: GlobalSettings) => {
        settings.models.observerModelOverride = 'custom/observer';
      },
    ],
    [
      'reflector override',
      (settings: GlobalSettings) => {
        settings.models.reflectorModelOverride = 'custom/reflector';
      },
    ],
  ])('treats a persisted %s as explicit configuration', (_name, configure) => {
    const settings = createSettings();
    configure(settings);
    expect(hasExplicitOMConfiguration(settings)).toBe(true);
  });

  it('ignores a custom pack that carries no model', () => {
    const settings = createSettings();
    settings.onboarding.omPackId = 'custom';
    settings.models.activeOmPackId = 'custom';

    expect(hasExplicitOMConfiguration(settings)).toBe(false);
  });

  it('treats a custom pack with a model as explicit configuration', () => {
    const settings = createSettings();
    settings.onboarding.omPackId = 'custom';
    settings.models.activeOmPackId = 'custom';
    settings.models.omModelOverride = 'xai/grok-4.5';

    expect(hasExplicitOMConfiguration(settings)).toBe(true);
  });

  it('applies a provider default while OM is untouched', () => {
    const settings = createSettings();
    const pack = {
      id: 'openai',
      name: 'OpenAI Mini',
      description: 'Via Codex subscription',
      modelId: 'openai/gpt-5.4-mini',
    };

    expect(applyOMDefaultIfUnconfigured(settings, pack)).toBe(true);
    expect(settings.onboarding.omPackId).toBe('openai');
    expect(settings.models.activeOmPackId).toBe('openai');
    expect(settings.models.omModelOverride).toBeNull();
  });

  it('does not overwrite an explicit role model', () => {
    const settings = createSettings();
    settings.models.observerModelOverride = 'custom/observer';

    expect(
      applyOMDefaultIfUnconfigured(settings, {
        id: 'anthropic',
        name: 'Claude Haiku',
        description: 'Via Max subscription',
        modelId: 'anthropic/claude-haiku-4-5',
      }),
    ).toBe(false);
    expect(settings.onboarding.omPackId).toBeNull();
    expect(settings.models.activeOmPackId).toBeNull();
    expect(settings.models.observerModelOverride).toBe('custom/observer');
  });
});

function withTempSettingsFile(run: (filePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'mastracode-settings-'));
  const filePath = join(dir, 'settings.json');
  try {
    run(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('MCP discovery settings parsing', () => {
  it('defaults external MCP discovery to disabled', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, '{}', 'utf-8');

      expect(loadSettings(filePath).mcp).toEqual({ claudeCodeGlobal: false, codexGlobal: false });
    });
  });

  it('loads valid opt-ins and defaults malformed values', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ mcp: { claudeCodeGlobal: true, codexGlobal: 'yes' } }), 'utf-8');

      expect(loadSettings(filePath).mcp).toEqual({ claudeCodeGlobal: true, codexGlobal: false });
    });
  });
});

describe('voice settings parsing', () => {
  it('back-compat: old { enabled }-only file gets engine + provider defaults', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ voice: { enabled: true } }), 'utf-8');

      const { voice } = loadSettings(filePath);

      expect(voice.enabled).toBe(true);
      expect(voice.engine).toMatch(/^(macos-native|cloud)$/);
      expect(voice.provider).toBe('openai');
      expect(voice.model).toBe('whisper-1');
    });
  });

  it('keeps a valid provider/model pair', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({ voice: { enabled: true, engine: 'cloud', provider: 'groq', model: 'whisper-large-v3' } }),
        'utf-8',
      );

      const { voice } = loadSettings(filePath);

      expect(voice.engine).toBe('cloud');
      expect(voice.provider).toBe('groq');
      expect(voice.model).toBe('whisper-large-v3');
    });
  });

  it('falls back to the provider default when the model is unknown', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ voice: { provider: 'groq', model: 'does-not-exist' } }), 'utf-8');

      const { voice } = loadSettings(filePath);

      expect(voice.provider).toBe('groq');
      expect(voice.model).toBe('whisper-large-v3-turbo');
    });
  });

  it('falls back to the global default for an unknown provider', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ voice: { provider: 'nope' } }), 'utf-8');

      const { voice } = loadSettings(filePath);

      expect(voice.provider).toBe('openai');
      expect(voice.model).toBe('whisper-1');
    });
  });

  it('rejects an invalid engine value', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ voice: { engine: 'bogus' } }), 'utf-8');

      const { voice } = loadSettings(filePath);

      expect(voice.engine).toMatch(/^(macos-native|cloud)$/);
    });
  });
});

describe('customProviders parsing/persistence', () => {
  it('returns defaults with empty customProviders when missing from settings file', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ onboarding: {}, models: {}, preferences: {}, storage: {} }), 'utf-8');

      const settings = loadSettings(filePath);

      expect(settings.customProviders).toEqual([]);
      expect(settings.preferences.thinkingLevel).toBe('off');
      expect(settings.preferences.quietModeMaxToolPreviewLines).toBe(2);
      expect(settings.shellPassthrough).toEqual({ mode: 'default' });
    });
  });

  it('trims shell passthrough settings while preserving invalid values for runtime warnings', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({
          onboarding: {},
          models: {},
          preferences: {},
          storage: {},
          shellPassthrough: {
            mode: ' profile ',
            executable: ' /bin/zsh ',
            family: ' zsh ',
          },
        }),
        'utf-8',
      );

      expect(loadSettings(filePath).shellPassthrough).toEqual({
        mode: 'profile',
        executable: '/bin/zsh',
        family: 'zsh',
      });
    });
  });

  it('preserves omitted shell passthrough mode when an executable is configured', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({
          onboarding: {},
          models: {},
          preferences: {},
          storage: {},
          shellPassthrough: {
            executable: ' /bin/zsh ',
          },
        }),
        'utf-8',
      );

      expect(loadSettings(filePath).shellPassthrough).toEqual({
        executable: '/bin/zsh',
      });
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

  it('keeps native background tools disabled unless explicitly enabled', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ onboarding: {}, models: {}, preferences: {}, storage: {} }), 'utf-8');
      expect(loadSettings(filePath).backgroundTools.enabled).toBe(false);

      const settings = createSettings();
      settings.backgroundTools.enabled = true;
      saveSettings(settings, filePath);
      expect(loadSettings(filePath).backgroundTools.enabled).toBe(true);

      writeFileSync(
        filePath,
        JSON.stringify({
          onboarding: {},
          models: {},
          preferences: {},
          storage: {},
          backgroundTools: { enabled: 'yes' },
        }),
        'utf-8',
      );
      expect(loadSettings(filePath).backgroundTools.enabled).toBe(false);
    });
  });

  it('persists experimental GitHub signals enable and disable across reloads', () => {
    withTempSettingsFile(filePath => {
      const settings = createSettings();
      settings.signals.experimentalGithubSignals = true;
      saveSettings(settings, filePath);

      expect(loadSettings(filePath).signals.experimentalGithubSignals).toBe(true);
      expect(JSON.parse(readFileSync(filePath, 'utf-8')).signals.experimentalGithubSignals).toBe(true);

      const reloaded = loadSettings(filePath);
      reloaded.signals.experimentalGithubSignals = false;
      saveSettings(reloaded, filePath);

      expect(loadSettings(filePath).signals.experimentalGithubSignals).toBe(false);
      expect(JSON.parse(readFileSync(filePath, 'utf-8')).signals.experimentalGithubSignals).toBe(false);
    });
  });

  it('does not clobber experimental GitHub signals from a stale settings object', () => {
    withTempSettingsFile(filePath => {
      saveSettings(createSettings(), filePath);
      const staleSettings = loadSettings(filePath);

      const currentSettings = loadSettings(filePath);
      currentSettings.signals.experimentalGithubSignals = true;
      saveSettings(currentSettings, filePath);

      staleSettings.modelUseCounts['openai/gpt-5.5'] = 1;
      saveSettings(staleSettings, filePath);

      expect(loadSettings(filePath).signals.experimentalGithubSignals).toBe(true);
      expect(JSON.parse(readFileSync(filePath, 'utf-8')).signals.experimentalGithubSignals).toBe(true);
    });
  });

  it('defaults missing GitHub poll interval for old settings files', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(
        filePath,
        JSON.stringify({
          onboarding: {},
          models: {},
          preferences: {},
          storage: {},
          signals: { experimentalGithubSignals: true },
        }),
        'utf-8',
      );

      const settings = loadSettings(filePath);

      expect(settings.signals.experimentalGithubSignals).toBe(true);
      expect(settings.signals.githubPollIntervalMs).toBe(300_000);
    });
  });

  it('falls back for malformed GitHub poll interval values', () => {
    withTempSettingsFile(filePath => {
      for (const value of [null, '300000', -1, 9999]) {
        writeFileSync(
          filePath,
          JSON.stringify({
            onboarding: {},
            models: {},
            preferences: {},
            storage: {},
            signals: { githubPollIntervalMs: value },
          }),
          'utf-8',
        );
        expect(loadSettings(filePath).signals.githubPollIntervalMs).toBe(300_000);
      }

      writeFileSync(
        filePath,
        JSON.stringify({
          onboarding: {},
          models: {},
          preferences: {},
          storage: {},
          signals: { githubPollIntervalMs: 99_999_999_999 },
        }),
        'utf-8',
      );
      expect(loadSettings(filePath).signals.githubPollIntervalMs).toBe(2_147_483_647);
    });
  });

  it('persists GitHub poll interval across reloads', () => {
    withTempSettingsFile(filePath => {
      const settings = createSettings();
      settings.signals.githubPollIntervalMs = 60_000;
      saveSettings(settings, filePath);

      expect(loadSettings(filePath).signals.githubPollIntervalMs).toBe(60_000);
      expect(JSON.parse(readFileSync(filePath, 'utf-8')).signals.githubPollIntervalMs).toBe(60_000);
    });
  });

  it('does not clobber GitHub poll interval from a stale settings object', () => {
    withTempSettingsFile(filePath => {
      saveSettings(createSettings(), filePath);
      const staleSettings = loadSettings(filePath);

      const currentSettings = loadSettings(filePath);
      currentSettings.signals.githubPollIntervalMs = 60_000;
      saveSettings(currentSettings, filePath);

      staleSettings.modelUseCounts['openai/gpt-5.5'] = 1;
      saveSettings(staleSettings, filePath);

      expect(loadSettings(filePath).signals.githubPollIntervalMs).toBe(60_000);
      expect(JSON.parse(readFileSync(filePath, 'utf-8')).signals.githubPollIntervalMs).toBe(60_000);
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

  describe('stripMastraCodeCustomProviderPrefix', () => {
    const customProviders: CustomProviderSetting[] = [
      { name: 'Custom Provider', url: 'https://example.com/v1', models: ['gemma-4-31b'] },
    ];

    it('strips the mastracode/ gateway prefix for a configured custom provider', () => {
      expect(stripMastraCodeCustomProviderPrefix('mastracode/custom-provider/gemma-4-31b', customProviders)).toBe(
        'custom-provider/gemma-4-31b',
      );
    });

    it('preserves nested model name segments after stripping', () => {
      expect(stripMastraCodeCustomProviderPrefix('mastracode/custom-provider/nested/model-name', customProviders)).toBe(
        'custom-provider/nested/model-name',
      );
    });

    it('leaves legitimate mastracode gateway-routed ids unchanged', () => {
      expect(
        stripMastraCodeCustomProviderPrefix('mastracode/anthropic/claude-sonnet-4-20250514', customProviders),
      ).toBe('mastracode/anthropic/claude-sonnet-4-20250514');
    });

    it('leaves ids for unrecognized providers unchanged', () => {
      expect(stripMastraCodeCustomProviderPrefix('mastracode/unknown-provider/model', customProviders)).toBe(
        'mastracode/unknown-provider/model',
      );
    });

    it('leaves ids without the mastracode/ prefix unchanged', () => {
      expect(stripMastraCodeCustomProviderPrefix('custom-provider/gemma-4-31b', customProviders)).toBe(
        'custom-provider/gemma-4-31b',
      );
    });

    it('leaves ids with an empty model portion unchanged', () => {
      expect(stripMastraCodeCustomProviderPrefix('mastracode/custom-provider/', customProviders)).toBe(
        'mastracode/custom-provider/',
      );
    });
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

describe('resolveModelDefaults', () => {
  it('layers stored mode overrides over the active built-in pack', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeModelPackId: 'openai',
        modePackOverrides: { openai: { build: 'openai/gpt-5.4' } },
      },
    });

    expect(resolveModelDefaults(settings, builtinPacks)).toEqual({
      plan: 'openai/gpt-5.5',
      build: 'openai/gpt-5.4',
      fast: 'openai/gpt-5.4-mini',
    });
  });

  it('does not apply built-in overrides to custom packs', () => {
    const settings = createSettings({
      models: {
        ...createSettings().models,
        activeModelPackId: 'custom:My Pack',
        modePackOverrides: { 'custom:My Pack': { build: 'openai/gpt-5.4' } },
      },
    });

    expect(resolveModelDefaults(settings, builtinPacks)).toEqual(settings.customModelPacks[0]!.models);
  });

  it('loads valid pack overrides and drops malformed entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-settings-'));
    const path = join(dir, 'settings.json');
    try {
      writeFileSync(
        path,
        JSON.stringify({
          models: {
            modePackOverrides: {
              openai: { build: 'openai/gpt-5.4', plan: 42 },
              anthropic: null,
            },
          },
        }),
      );

      expect(loadSettings(path).models.modePackOverrides).toEqual({
        openai: { build: 'openai/gpt-5.4' },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('resolveDefaultThinkingLevel', () => {
  it('returns the mode default when set for the mode', () => {
    const settings = createSettings({
      models: { ...createSettings().models, modeThinkingDefaults: { build: 'high' } },
      preferences: { ...createSettings().preferences, thinkingLevel: 'low' },
    });

    expect(resolveDefaultThinkingLevel(settings, 'build')).toEqual({ level: 'high', source: 'mode-default' });
  });

  it('falls back to the global default when the mode has no entry', () => {
    const settings = createSettings({
      models: { ...createSettings().models, modeThinkingDefaults: { build: 'high' } },
      preferences: { ...createSettings().preferences, thinkingLevel: 'low' },
    });

    expect(resolveDefaultThinkingLevel(settings, 'plan')).toEqual({ level: 'low', source: 'global' });
  });

  it('falls back to the global default when no mode is provided', () => {
    const settings = createSettings({
      models: { ...createSettings().models, modeThinkingDefaults: { build: 'max' } },
      preferences: { ...createSettings().preferences, thinkingLevel: 'medium' },
    });

    expect(resolveDefaultThinkingLevel(settings, null)).toEqual({ level: 'medium', source: 'global' });
    expect(resolveDefaultThinkingLevel(settings)).toEqual({ level: 'medium', source: 'global' });
  });

  it('round-trips modeThinkingDefaults through save/load and drops invalid levels', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-settings-'));
    const path = join(dir, 'settings.json');
    try {
      writeFileSync(
        path,
        JSON.stringify({
          models: { modeThinkingDefaults: { build: 'high', plan: 'nonsense', fast: 'max' } },
        }),
      );

      const loaded = loadSettings(path);
      expect(loaded.models.modeThinkingDefaults).toEqual({ build: 'high', fast: 'max' });

      loaded.models.modeThinkingDefaults = { plan: 'xhigh' };
      saveSettings(loaded, path);
      expect(loadSettings(path).models.modeThinkingDefaults).toEqual({ plan: 'xhigh' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

describe('createBrowserFromSettings — stagehand model', () => {
  function stagehandSettings(stagehand: Record<string, unknown>): BrowserSettings {
    return { enabled: true, provider: 'stagehand', headless: true, stagehand } as unknown as BrowserSettings;
  }

  // The model lands on a private field, so read it the way the browser does.
  function configuredModel(browser: unknown): unknown {
    return (browser as { stagehandConfig: { model?: unknown } }).stagehandConfig.model;
  }

  it('passes a configured model through to Stagehand', async () => {
    const browser = await createBrowserFromSettings(
      stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' }),
    );
    expect(configuredModel(browser)).toBe('anthropic/claude-sonnet-4-5');
  });

  it('leaves the model unset when none is configured, so Stagehand keeps its own default', async () => {
    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL' }));
    const model = configuredModel(browser);
    // A Codex OAuth credential in the ambient environment supplies its own
    // model; either way the user has not configured one here.
    expect(typeof model === 'undefined' || typeof model === 'object').toBe(true);
  });

  it('keeps the configured model when connecting over CDP', async () => {
    const settings = stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' });
    const browser = await createBrowserFromSettings({ ...settings, cdpUrl: 'ws://localhost:9222/devtools/browser/x' });
    expect(configuredModel(browser)).toBe('anthropic/claude-sonnet-4-5');
  });
});

describe('parseBrowserSettings — stagehand model', () => {
  function parseBrowser(browser: unknown): BrowserSettings {
    const dir = mkdtempSync(join(tmpdir(), 'mc-browser-settings-'));
    const file = join(dir, 'settings.json');
    writeFileSync(file, JSON.stringify({ browser }));
    try {
      return loadSettings(file).browser;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('round-trips a configured model', () => {
    expect(parseBrowser({ stagehand: { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' } }).stagehand?.model).toBe(
      'anthropic/claude-sonnet-4-5',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(
      parseBrowser({ stagehand: { env: 'LOCAL', model: '  anthropic/claude-sonnet-4-5  ' } }).stagehand?.model,
    ).toBe('anthropic/claude-sonnet-4-5');
  });

  // A hand-edited settings.json reaches Stagehand without passing through the
  // /browser set model validation, so the unusable shapes are dropped here.
  // 'gpt-4.1' is read by Stagehand as a provider named "gpt-4.1", and
  // 'anthropic/' resolves a provider but leaves an empty model name.
  it.each([['   '], [42], [null], [{}], ['gpt-4.1'], ['anthropic/'], ['anthropic/   '], ['/claude-sonnet-4-5']])(
    'drops malformed model %p rather than passing it to Stagehand',
    value => {
      expect(parseBrowser({ stagehand: { env: 'LOCAL', model: value } }).stagehand?.model).toBeUndefined();
    },
  );

  it('keeps the rest of the stagehand settings when the model is dropped', () => {
    expect(parseBrowser({ stagehand: { env: 'BROWSERBASE', model: 'gpt-4.1' } }).stagehand?.env).toBe('BROWSERBASE');
  });
});

describe('parseViewportInput', () => {
  it.each([
    ['desktop', { width: 1280, height: 720 }],
    ['desktop-hd', { width: 1920, height: 1080 }],
    ['MOBILE', { width: 390, height: 844 }],
    ['1600x1000', { width: 1600, height: 1000 }],
    ['1600 x 1000', { width: 1600, height: 1000 }],
    ['  1600X1000  ', { width: 1600, height: 1000 }],
  ])('parses %p', (input, expected) => {
    expect(parseViewportInput(input)).toEqual(expected);
  });

  it('parses window', () => {
    expect(parseViewportInput('window')).toBe('window');
  });

  it.each([[''], ['   '], ['1280'], ['1280x'], ['0x720'], ['-10x720'], ['1280.5x720'], ['99999x720'], ['huge']])(
    'rejects %p',
    input => {
      expect(parseViewportInput(input)).toBeUndefined();
    },
  );
});

describe('parseBrowserSettings — viewport', () => {
  function parseBrowser(browser: unknown): BrowserSettings {
    const dir = mkdtempSync(join(tmpdir(), 'mc-browser-viewport-'));
    const file = join(dir, 'settings.json');
    writeFileSync(file, JSON.stringify({ browser }));
    try {
      return loadSettings(file).browser;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('round-trips explicit dimensions', () => {
    expect(parseBrowser({ viewport: { width: 1600, height: 1000 } }).viewport).toEqual({ width: 1600, height: 1000 });
  });

  it('round-trips window', () => {
    expect(parseBrowser({ viewport: 'window' }).viewport).toBe('window');
  });

  // A hand-edited settings.json bypasses /browser set viewport validation, so
  // unusable shapes fall back to the default rather than reaching the provider.
  it.each([[undefined], ['maximized'], [{ width: 0, height: 720 }], [{ width: '1280', height: 720 }], [{}], [42]])(
    'falls back to the default for %p',
    value => {
      expect(parseBrowser({ viewport: value }).viewport).toEqual({ width: 1280, height: 720 });
    },
  );
});

describe('createBrowserFromSettings — recording tools gating', () => {
  const RECORDING_TOOL_NAMES = ['browser_record', 'browser_record_caption'] as const;

  function makeBrowserSettings(overrides: Partial<BrowserSettings> = {}): BrowserSettings {
    return {
      enabled: true,
      provider: 'stagehand',
      headless: true,
      ...overrides,
    } as BrowserSettings;
  }

  it('returns undefined when browser is disabled', async () => {
    const result = await createBrowserFromSettings({ enabled: false } as BrowserSettings);
    expect(result).toBeUndefined();
  });

  it.each([
    ['stagehand', 'stagehand_navigate'],
    ['agent-browser', 'browser_goto'],
  ] as const)(
    'exposes recording tools on a Mastra Code-constructed %s browser while keeping provider tools intact',
    async (provider, providerToolName) => {
      const browser = await createBrowserFromSettings(makeBrowserSettings({ provider }));
      expect(browser).toBeDefined();
      const tools = browser!.getTools();
      for (const name of RECORDING_TOOL_NAMES) {
        expect(tools[name], `expected tool ${name} to be present`).toBeDefined();
      }
      expect(tools[providerToolName], `expected provider tool ${providerToolName} to be present`).toBeDefined();
    },
  );

  it('does NOT expose recording tools when StagehandBrowser is constructed directly', async () => {
    const { StagehandBrowser } = await import('@mastra/stagehand');
    const browser = new StagehandBrowser({ headless: true });
    const tools = browser.getTools();
    for (const name of RECORDING_TOOL_NAMES) {
      expect(tools[name], `expected tool ${name} to be absent on direct StagehandBrowser`).toBeUndefined();
    }
  });

  it('does NOT expose recording tools when AgentBrowser is constructed directly', async () => {
    const { AgentBrowser } = await import('@mastra/agent-browser');
    const browser = new AgentBrowser({ headless: true });
    const tools = browser.getTools();
    for (const name of RECORDING_TOOL_NAMES) {
      expect(tools[name], `expected tool ${name} to be absent on direct AgentBrowser`).toBeUndefined();
    }
  });
});

describe('LSP settings parsing', () => {
  it('leaves LSP unset when the file has no lsp key', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, '{}', 'utf-8');

      expect(loadSettings(filePath).lsp).toBeUndefined();
    });
  });

  it('preserves an explicit opt-out', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ lsp: false }), 'utf-8');

      expect(loadSettings(filePath).lsp).toBe(false);
    });
  });

  it('preserves an explicit opt-in', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ lsp: true }), 'utf-8');

      expect(loadSettings(filePath).lsp).toBe(true);
    });
  });

  it('preserves a full config object', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ lsp: { maxOpenClients: 2 } }), 'utf-8');

      expect(loadSettings(filePath).lsp).toEqual({ maxOpenClients: 2 });
    });
  });

  it('ignores malformed values', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, JSON.stringify({ lsp: 'yes' }), 'utf-8');
      expect(loadSettings(filePath).lsp).toBeUndefined();

      writeFileSync(filePath, JSON.stringify({ lsp: null }), 'utf-8');
      expect(loadSettings(filePath).lsp).toBeUndefined();
    });
  });

  it('defaults new installs to disabled', () => {
    withTempSettingsFile(filePath => {
      expect(loadSettings(filePath).lsp).toBe(false);
    });
  });

  it('resolveLspSetting treats absent and false as disabled, true as defaults', () => {
    expect(resolveLspSetting(undefined)).toBe(false);
    expect(resolveLspSetting(false)).toBe(false);
    expect(resolveLspSetting(true)).toEqual({});
    const config = { maxOpenClients: 3 };
    expect(resolveLspSetting(config)).toBe(config);
  });
});
