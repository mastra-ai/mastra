import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { removeCustomPackFromSettings } from '@mastra/code-sdk/onboarding/custom-packs';
import { buildProviderAccess, listModelPacks } from '@mastra/factory/routes/config';
import type { PackContext } from '@mastra/factory/routes/config';

/**
 * The web settings panel surfaces model packs through the same primitives the
 * TUI's `/models-pack` command uses: provider-access derivation +
 * `getAvailableModePacks`. Custom packs live in the model-packs storage domain
 * (the TUI keeps `customModelPacks` in global settings). These tests exercise
 * the server-side bridge against fakes and an isolated settings file so the
 * user's real settings are never touched.
 */
describe('web model packs (TUI /models-pack parity)', () => {
  const catalog = (models: { provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }[]) => ({
    listAvailableModels: async () => models,
  });

  let auth: AuthStorage;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mc-packs-'));
    auth = new AuthStorage(join(tmpDir, 'auth.json'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('derives provider access — a usable key on any provider grants apikey access', async () => {
    // anthropic/openai access comes from credentials stored under the bare
    // provider id (e.g. /login); a model that reports a usable key grants
    // apikey access to any *other* provider via the fallback sweep.
    const access = await buildProviderAccess({
      controller: catalog([
        { provider: 'anthropic', hasApiKey: true },
        { provider: 'cohere', hasApiKey: true },
        { provider: 'unreachable', hasApiKey: false },
      ]),
      authStorage: auth,
    });
    expect(access.cohere).toBe('apikey'); // not a named provider → fallback sweep
    expect(access.unreachable).toBeFalsy(); // no key → not added / not reachable
  });

  it('lists a built-in pack for a reachable provider and drops the synthetic placeholder', async () => {
    // anthropic access comes from a credential stored under the bare provider id
    // (mirrors `/login` storing an api_key or oauth cred), matching the TUI's
    // accessLevel('anthropic') derivation.
    auth.set('anthropic', { type: 'api_key', key: 'sk-ant' });
    const access = await buildProviderAccess({
      controller: catalog([{ provider: 'anthropic', hasApiKey: true }]),
      authStorage: auth,
    });
    // Sanity: anthropic is reachable, so the built-in anthropic pack must list.
    expect(access.anthropic).toBe('apikey');

    const emptyPackStorage = { list: async () => [] } as unknown as PackContext['storage'];
    const packs = await listModelPacks({
      controller: catalog([{ provider: 'anthropic', hasApiKey: true }]),
      authStorage: auth,
      packContext: { storage: emptyPackStorage, orgId: 'local', userId: 'local' },
      activePackId: null,
    });
    const anthropic = packs.find(p => p.id === 'anthropic');
    expect(anthropic).toBeDefined();
    expect(anthropic!.models.build).toBeTruthy();
    expect(anthropic!.models.fast).toBeTruthy();
    // The "choose each model" placeholder must not leak into the web list.
    expect(packs.some(p => p.id === 'custom')).toBe(false);
    // Nothing is active when no active pack id is supplied.
    expect(packs.every(p => !p.active)).toBe(true);
  });

  it('round-trips a custom pack through settings and removes it', () => {
    const settingsPath = join(tmpDir, 'settings.json');
    const settings = loadSettings(settingsPath);
    settings.customModelPacks.push({
      name: 'my-pack',
      models: { build: 'a/build', plan: 'a/plan', fast: 'a/fast' },
      createdAt: new Date().toISOString(),
    });
    saveSettings(settings, settingsPath);

    const reloaded = loadSettings(settingsPath);
    expect(reloaded.customModelPacks.map(p => p.name)).toContain('my-pack');

    removeCustomPackFromSettings(reloaded, 'custom:my-pack');
    saveSettings(reloaded, settingsPath);
    expect(loadSettings(settingsPath).customModelPacks.some(p => p.name === 'my-pack')).toBe(false);
  });
});
