import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialStore } from '../../auth/types.js';
import { DEFAULT_OM_MODEL_ID } from '../../constants.js';
import { resolveAutoOMModelId } from '../../onboarding/packs.js';
import { setCredentialStoreProvider } from '../credential-resolver.js';
import { canUseProvider } from '../model.js';

// Auto memory model as runs pick it: the SDK's credential check decides whether Gemini is usable.
function autoModelFor(mainModelId: string, requestContext?: RequestContext): string {
  return resolveAutoOMModelId(mainModelId, providerId => canUseProvider(providerId, { requestContext }));
}

describe('Auto memory model follows the credentials resolveModel can use', () => {
  let appDataDir: string;

  beforeEach(() => {
    appDataDir = mkdtempSync(join(tmpdir(), 'mastracode-auto-om-'));
    vi.stubEnv('MASTRA_APP_DATA_DIR', appDataDir);
    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
  });

  afterEach(() => {
    setCredentialStoreProvider(undefined);
    vi.unstubAllEnvs();
    rmSync(appDataDir, { recursive: true, force: true });
  });

  it('picks the connected provider, not Gemini, for a Factory account when only the server has a Google key', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'server-google-key');
    const tenantStore: CredentialStore = {
      allowEnvironmentFallback: false,
      reload() {},
      get: providerId => (providerId === 'anthropic' ? { type: 'api_key', key: 'sk-anthropic' } : undefined),
      getStoredApiKey: () => undefined,
      getApiKey: async () => undefined,
    };
    setCredentialStoreProvider(() => tenantStore);
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });

    expect(canUseProvider('google', { requestContext })).toBe(false);
    expect(autoModelFor('anthropic/claude-opus-4-6', requestContext)).toBe('anthropic/claude-haiku-4-5');
  });

  it('still picks Gemini for a local user whose Google key is only in the environment', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'local-google-key');

    expect(canUseProvider('google')).toBe(true);
    expect(autoModelFor('anthropic/claude-opus-4-6')).toBe(DEFAULT_OM_MODEL_ID);
  });

  it('accepts GOOGLE_API_KEY, which resolveModel also reads for Google', () => {
    vi.stubEnv('GOOGLE_API_KEY', 'local-google-key');

    expect(canUseProvider('google')).toBe(true);
  });

  it('does not treat an empty environment as a usable Google credential', () => {
    expect(canUseProvider('google')).toBe(false);
    expect(autoModelFor('anthropic/claude-opus-4-6')).toBe('anthropic/claude-haiku-4-5');
  });
});
