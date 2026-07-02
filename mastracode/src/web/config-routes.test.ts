import { afterEach, describe, expect, it } from 'vitest';

import type { AuthStorage } from '../auth/storage.js';
import { listProviders } from './config-routes.js';

function makeAuthStorage(opts: { loggedIn?: string[]; storedKeys?: string[] }): AuthStorage {
  const loggedIn = new Set(opts.loggedIn ?? []);
  const storedKeys = new Set(opts.storedKeys ?? []);
  return {
    isLoggedIn: (provider: string) => loggedIn.has(provider),
    hasStoredApiKey: (provider: string) => storedKeys.has(provider),
  } as unknown as AuthStorage;
}

function makeAgentController(models: { provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }[]) {
  return { listAvailableModels: async () => models };
}

describe('listProviders', () => {
  const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  });

  it('labels an OAuth-logged-in provider as oauth (not stored)', async () => {
    const auth = makeAuthStorage({ loggedIn: ['anthropic'], storedKeys: ['anthropic'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe('oauth');
  });

  it('maps the openai catalog provider to the openai-codex OAuth slot', async () => {
    const auth = makeAuthStorage({ loggedIn: ['openai-codex'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('oauth');
  });

  it('falls back to stored when not OAuth but a stored key exists', async () => {
    const auth = makeAuthStorage({ storedKeys: ['anthropic'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('stored');
  });

  it('reports env when only the env var is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-env';
    const auth = makeAuthStorage({});

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('env');
  });

  it('reports none when no credentials are present', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const auth = makeAuthStorage({});

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('none');
  });
});
