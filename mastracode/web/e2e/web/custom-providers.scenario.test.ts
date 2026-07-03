import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCustomProviderId, loadSettings, saveSettings } from '@internal/mastracode/onboarding/settings';
import type { GlobalSettings } from '@internal/mastracode/onboarding/settings';
import {
  removeCustomProviderFromSettings,
  upsertCustomProviderInSettings,
} from '@internal/mastracode/onboarding/custom-providers';

/**
 * The web settings panel manages custom OpenAI-compatible providers through the
 * same `GlobalSettings`-backed helpers the TUI's `/custom-providers` command
 * uses. These tests exercise the upsert/remove helpers plus a settings.json
 * round-trip — the exact composition the web route performs — against an
 * isolated temp settings file so the user's real settings are never touched.
 */
describe('web custom-providers (TUI /custom-providers parity)', () => {
  let tmpDir: string;
  let settingsPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mc-settings-'));
    settingsPath = join(tmpDir, 'settings.json');
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const fresh = (): GlobalSettings => loadSettings(settingsPath);

  it('adds a custom provider and persists it across a reload', () => {
    const settings = fresh();
    upsertCustomProviderInSettings(settings, {
      name: 'My LLM',
      url: 'https://api.example.com/v1',
      apiKey: 'sk-secret',
      models: ['model-a', 'model-b'],
    });
    saveSettings(settings, settingsPath);

    const reloaded = loadSettings(settingsPath);
    expect(reloaded.customProviders).toHaveLength(1);
    const saved = reloaded.customProviders[0];
    expect(saved.name).toBe('My LLM');
    expect(saved.url).toBe('https://api.example.com/v1');
    expect(saved.models).toEqual(['model-a', 'model-b']);
    expect(getCustomProviderId(saved.name)).toBe('my-llm');
  });

  it('updates an existing provider in place (no duplicate)', () => {
    const settings = fresh();
    upsertCustomProviderInSettings(settings, { name: 'My LLM', url: 'https://old.example.com', models: [] });
    upsertCustomProviderInSettings(settings, {
      name: 'My LLM',
      url: 'https://new.example.com',
      models: ['m1'],
    });
    expect(settings.customProviders).toHaveLength(1);
    expect(settings.customProviders[0].url).toBe('https://new.example.com');
    expect(settings.customProviders[0].models).toEqual(['m1']);
  });

  it('renames a provider via previousId without leaving the old entry', () => {
    const settings = fresh();
    upsertCustomProviderInSettings(settings, { name: 'Old Name', url: 'https://api.example.com', models: [] });
    const previousId = getCustomProviderId('Old Name');
    upsertCustomProviderInSettings(
      settings,
      { name: 'New Name', url: 'https://api.example.com', models: [] },
      previousId,
    );
    expect(settings.customProviders.map(p => p.name)).toEqual(['New Name']);
  });

  it('removes a custom provider by id', () => {
    const settings = fresh();
    upsertCustomProviderInSettings(settings, { name: 'Keep', url: 'https://a.example.com', models: [] });
    upsertCustomProviderInSettings(settings, { name: 'Drop', url: 'https://b.example.com', models: [] });
    removeCustomProviderFromSettings(settings, getCustomProviderId('Drop'));
    saveSettings(settings, settingsPath);

    const reloaded = loadSettings(settingsPath);
    expect(reloaded.customProviders.map(p => p.name)).toEqual(['Keep']);
  });

  it('dedupes and trims models on upsert', () => {
    const settings = fresh();
    upsertCustomProviderInSettings(settings, {
      name: 'Trimmer',
      url: 'https://api.example.com',
      models: [' m1 ', 'm1', 'm2', '  '],
    });
    expect(settings.customProviders[0].models).toEqual(['m1', 'm2']);
  });
});
