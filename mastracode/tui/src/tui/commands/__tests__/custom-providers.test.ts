import type { GlobalSettings, StorageSettings } from '@mastra/code-sdk/onboarding/settings';
import { describe, expect, it } from 'vitest';

import {
  addHeaderToCustomProviderInSettings,
  addModelToCustomProviderInSettings,
  endpointModelsToOffer,
  headersForCustomProviderUrlChange,
  removeCustomProviderFromSettings,
  removeModelFromCustomProviderInSettings,
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
});

describe('custom provider headers', () => {
  it('refuses a header whose name a saved header already uses in another case', () => {
    const saved = [{ name: 'X-Org', value: 'org-1', secret: true }];
    const settings = createSettings({
      customProviders: [{ name: 'Acme', url: 'https://llm.acme.dev/v1', models: [], headers: saved }],
    });

    expect(addHeaderToCustomProviderInSettings(settings, 'acme', { name: 'x-org', value: 'org-2' })).toBeTruthy();
    expect(settings.customProviders[0]?.headers).toEqual(saved);
  });

  it.each([
    ['the same origin', 'https://llm.acme.dev/v2/', ['X-Secret', 'X-Legacy', 'X-Region']],
    ['another host', 'https://proxy.example.com/v1', ['X-Region']],
    ['another port', 'https://llm.acme.dev:8443/v1', ['X-Region']],
  ])('keeps secret headers only on the same origin: %s', (_case, nextUrl, keptNames) => {
    const headers = [
      { name: 'X-Secret', value: 'secret-value', secret: true },
      { name: 'X-Legacy', value: 'saved-before-flags' },
      { name: 'X-Region', value: 'eu', secret: false },
    ];

    const { kept } = headersForCustomProviderUrlChange(headers, 'https://llm.acme.dev/v1', nextUrl);

    expect(kept.map(header => header.name)).toEqual(keptNames);
  });
});

describe('endpointModelsToOffer', () => {
  it('leaves out configured ids, ids saved under the provider prefix and menu labels', () => {
    const offered = endpointModelsToOffer(
      ['acme/acme-small', 'acme-small', 'acme/acme-large', 'other/acme-large', 'Done', 'Add all'],
      { name: 'Acme', models: ['acme-small'] },
      ['Add all', 'Done'],
    );

    expect(offered).toEqual(['acme-large', 'other/acme-large']);
  });
});
