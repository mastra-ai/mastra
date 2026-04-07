import { describe, expect, it } from 'vitest';

import type { GlobalSettings, StorageSettings } from '../../../onboarding/settings.js';
import {
  addModelToCustomProviderInSettings,
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
      omObservationThreshold: null,
      omReflectionThreshold: null,
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
