import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { listProviders } from '@mastra/factory/routes/config';

/**
 * The web settings panel manages provider API keys through the same
 * `AuthStorage`-backed surface the TUI's `/api-keys` command uses. `listProviders`
 * is the server-side bridge: it dedupes the model catalog into providers and
 * reports where each provider's credential comes from (stored / env / none).
 */
describe('web provider listing (TUI /api-keys parity)', () => {
  const catalog = (models: { provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }[]) => ({
    listAvailableModels: async () => models,
  });

  let auth: AuthStorage;
  let tmpDir: string;
  const ENV_VAR = 'TEST_PROVIDER_ENV_KEY';

  beforeEach(() => {
    // Isolate credential writes to a temp file so the test never touches the
    // user's real auth.json.
    tmpDir = mkdtempSync(join(tmpdir(), 'mc-auth-'));
    auth = new AuthStorage(join(tmpDir, 'auth.json'));
    delete process.env[ENV_VAR];
  });
  afterEach(() => {
    delete process.env[ENV_VAR];
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('classifies a stored key as source "stored"', async () => {
    auth.setStoredApiKey('acme', 'sk-123');
    const providers = await listProviders({
      controller: catalog([{ provider: 'acme', hasApiKey: true }]),
      authStorage: auth,
    });
    expect(providers).toEqual([{ provider: 'acme', envVar: undefined, source: 'stored' }]);
  });

  it('classifies an env-var-backed key as source "env"', async () => {
    process.env[ENV_VAR] = 'sk-from-env';
    const providers = await listProviders({
      controller: catalog([{ provider: 'acme', hasApiKey: true, apiKeyEnvVar: ENV_VAR }]),
      authStorage: auth,
    });
    expect(providers[0].source).toBe('env');
  });

  it('classifies a provider with no credentials as source "none"', async () => {
    const providers = await listProviders({
      controller: catalog([{ provider: 'acme', hasApiKey: false }]),
      authStorage: auth,
    });
    expect(providers[0].source).toBe('none');
  });

  it('dedupes providers across models and sorts alphabetically', async () => {
    const providers = await listProviders({
      controller: catalog([
        { provider: 'zeta', hasApiKey: false },
        { provider: 'acme', hasApiKey: false },
        { provider: 'acme', hasApiKey: false },
        { provider: 'mid', hasApiKey: false },
      ]),
      authStorage: auth,
    });
    expect(providers.map(p => p.provider)).toEqual(['acme', 'mid', 'zeta']);
  });

  it('prefers a stored key over an env var for the same provider', async () => {
    process.env[ENV_VAR] = 'sk-from-env';
    auth.setStoredApiKey('acme', 'sk-stored');
    const providers = await listProviders({
      controller: catalog([{ provider: 'acme', hasApiKey: true, apiKeyEnvVar: ENV_VAR }]),
      authStorage: auth,
    });
    expect(providers[0].source).toBe('stored');
  });

  it('removing a stored key clears it from storage', async () => {
    auth.setStoredApiKey('acme', 'sk-123');
    expect(auth.hasStoredApiKey('acme')).toBe(true);
    auth.remove('apikey:acme');
    expect(auth.hasStoredApiKey('acme')).toBe(false);
  });
});
