import type { CustomProviderSetting, GlobalSettings, StorageSettings } from '@mastra/code-sdk/onboarding/settings';
import { describe, expect, it } from 'vitest';

import {
  addHeaderToCustomProviderInSettings,
  addModelsToCustomProviderInSettings,
  addModelToCustomProviderInSettings,
  headersForCustomProviderUrlChange,
  removeCustomProviderFromSettings,
  removeHeaderFromCustomProviderInSettings,
  removeModelFromCustomProviderInSettings,
  setCustomProviderAuthSchemeInSettings,
  upsertCustomProviderInSettings,
} from '../custom-providers.js';

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
    preferences: { yolo: null, theme: 'auto', thinkingLevel: 'off', previewLines: 2 },
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

describe('upsertCustomProviderInSettings', () => {
  it('creates a new provider', () => {
    const settings = createSettings();

    upsertCustomProviderInSettings(settings, {
      name: 'Acme',
      url: 'https://llm.acme.dev/v1',
      apiKey: 'test-key',
      models: ['acme-1'],
    });

    expect(settings.customProviders).toHaveLength(1);
    expect(settings.customProviders[0]).toEqual({
      name: 'Acme',
      url: 'https://llm.acme.dev/v1',
      apiKey: 'test-key',
      models: ['acme-1'],
    });
  });

  it('updates existing provider by id without duplicates', () => {
    const settings = createSettings({
      customProviders: [
        {
          name: 'Acme',
          url: 'https://old.acme.dev/v1',
          models: ['acme-old'],
        },
      ],
    });

    upsertCustomProviderInSettings(
      settings,
      {
        name: 'Acme',
        url: 'https://new.acme.dev/v1',
        apiKey: 'new-key',
        models: ['acme-2'],
      },
      'acme',
    );

    expect(settings.customProviders).toHaveLength(1);
    expect(settings.customProviders[0]).toEqual({
      name: 'Acme',
      url: 'https://new.acme.dev/v1',
      apiKey: 'new-key',
      models: ['acme-2'],
    });
  });

  it('renames provider by replacing old provider id', () => {
    const settings = createSettings({
      customProviders: [
        {
          name: 'Acme',
          url: 'https://llm.acme.dev/v1',
          models: ['acme-1'],
        },
      ],
    });

    upsertCustomProviderInSettings(
      settings,
      {
        name: 'Acme Prod',
        url: 'https://prod.acme.dev/v1',
        models: ['acme-prod-1'],
      },
      'acme',
    );

    expect(settings.customProviders).toHaveLength(1);
    expect(settings.customProviders[0]?.name).toBe('Acme Prod');
  });
});

describe('custom provider model mutations', () => {
  it('adds model id once', () => {
    const settings = createSettings({
      customProviders: [
        {
          name: 'Acme',
          url: 'https://llm.acme.dev/v1',
          models: ['acme-1'],
        },
      ],
    });

    const first = addModelToCustomProviderInSettings(settings, 'acme', 'acme-2');
    const duplicate = addModelToCustomProviderInSettings(settings, 'acme', 'acme-2');

    expect(first).toBe(true);
    expect(duplicate).toBe(true);
    expect(settings.customProviders[0]?.models).toEqual(['acme-1', 'acme-2']);
  });

  it('removes model id and provider', () => {
    const settings = createSettings({
      customProviders: [
        {
          name: 'Acme',
          url: 'https://llm.acme.dev/v1',
          models: ['acme-1', 'acme-2'],
        },
      ],
    });

    const removed = removeModelFromCustomProviderInSettings(settings, 'acme', 'acme-2');
    removeCustomProviderFromSettings(settings, 'acme');

    expect(removed).toBe(true);
    expect(settings.customProviders).toEqual([]);
  });

  it('adds the models an endpoint lists and counts only the new ones', () => {
    const settings = createSettings({
      customProviders: [{ name: 'Acme', url: 'https://llm.acme.dev/v1', models: ['acme-1'] }],
    });

    const added = addModelsToCustomProviderInSettings(settings, 'acme', ['acme-1', 'acme-2', ' acme-3 ', '']);

    expect(added).toBe(2);
    expect(settings.customProviders[0]?.models).toEqual(['acme-1', 'acme-2', 'acme-3']);
  });
});

describe('custom provider headers and auth scheme', () => {
  function acmeSettings(provider: Partial<CustomProviderSetting> = {}): GlobalSettings {
    return createSettings({
      customProviders: [{ name: 'Acme', url: 'https://llm.acme.dev/v1', models: [], ...provider }],
    });
  }

  it('saves a new header as secret unless marked plain, and removes it by name ignoring case', () => {
    const settings = acmeSettings();

    expect(addHeaderToCustomProviderInSettings(settings, 'acme', { name: 'X-Org', value: 'org-1' })).toBeUndefined();
    expect(
      addHeaderToCustomProviderInSettings(settings, 'acme', { name: 'X-Region', value: 'eu', secret: false }),
    ).toBeUndefined();
    expect(settings.customProviders[0]?.headers).toEqual([
      { name: 'X-Org', value: 'org-1', secret: true },
      { name: 'X-Region', value: 'eu', secret: false },
    ]);

    expect(removeHeaderFromCustomProviderInSettings(settings, 'acme', 'x-org')).toBe(true);
    expect(settings.customProviders[0]?.headers).toEqual([{ name: 'X-Region', value: 'eu', secret: false }]);
  });

  it.each([
    { case: 'the bearer auth header', authScheme: undefined, header: { name: 'authorization', value: 'Basic abc' } },
    { case: 'the x-api-key auth header', authScheme: 'x-api-key' as const, header: { name: 'X-Api-Key', value: 'k' } },
    { case: 'a name already saved', authScheme: undefined, header: { name: 'x-org', value: 'org-2' } },
    { case: 'a header the HTTP client owns', authScheme: undefined, header: { name: 'Host', value: 'evil.test' } },
    { case: 'an empty value', authScheme: undefined, header: { name: 'X-Team', value: '  ' } },
  ])('refuses $case and leaves the saved headers alone', ({ authScheme, header }) => {
    const saved = [{ name: 'X-Org', value: 'org-1', secret: true }];
    const settings = acmeSettings({ authScheme, headers: saved });

    expect(addHeaderToCustomProviderInSettings(settings, 'acme', header)).toEqual(expect.any(String));
    expect(settings.customProviders[0]?.headers).toEqual(saved);
  });

  it('refuses an auth scheme whose header a saved custom header already uses', () => {
    const settings = acmeSettings({ headers: [{ name: 'x-api-key', value: 'gateway-key', secret: true }] });

    expect(setCustomProviderAuthSchemeInSettings(settings, 'acme', 'x-api-key')).toMatch(/x-api-key/);
    expect(settings.customProviders[0]?.authScheme).toBeUndefined();

    removeHeaderFromCustomProviderInSettings(settings, 'acme', 'x-api-key');
    expect(setCustomProviderAuthSchemeInSettings(settings, 'acme', 'x-api-key')).toBeUndefined();
    expect(settings.customProviders[0]?.authScheme).toBe('x-api-key');
  });
});

describe('headersForCustomProviderUrlChange', () => {
  const headers = [
    { name: 'X-Secret', value: 'secret-value', secret: true },
    { name: 'X-Legacy', value: 'saved-before-flags' },
    { name: 'X-Region', value: 'eu', secret: false },
  ];

  it('keeps every header when only the path changes', () => {
    expect(headersForCustomProviderUrlChange(headers, 'https://llm.acme.dev/v1', 'https://llm.acme.dev/v2/')).toEqual({
      kept: headers,
      removed: [],
    });
  });

  it.each([
    ['another host', 'https://proxy.example.com/v1'],
    ['another port', 'https://llm.acme.dev:8443/v1'],
    ['plain HTTP', 'http://llm.acme.dev/v1'],
  ])('drops secret and unflagged headers when the URL moves to %s', (_case, nextUrl) => {
    expect(headersForCustomProviderUrlChange(headers, 'https://llm.acme.dev/v1', nextUrl)).toEqual({
      kept: [{ name: 'X-Region', value: 'eu', secret: false }],
      removed: [
        { name: 'X-Secret', value: 'secret-value', secret: true },
        { name: 'X-Legacy', value: 'saved-before-flags' },
      ],
    });
  });
});
