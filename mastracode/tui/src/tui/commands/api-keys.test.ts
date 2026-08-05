import { afterEach, describe, expect, it } from 'vitest';

import { getProviderList } from './api-keys.js';
import type { SlashCommandContext } from './types.js';

type AuthStorageLike = NonNullable<SlashCommandContext['authStorage']>;

function makeCtx(opts: { loggedIn?: string[]; storedKeys?: string[] }): SlashCommandContext {
  const loggedIn = new Set(opts.loggedIn ?? []);
  const storedKeys = new Set(opts.storedKeys ?? []);
  const authStorage = {
    isLoggedIn: (provider: string) => loggedIn.has(provider),
    hasStoredApiKey: (provider: string) => storedKeys.has(provider),
  } as unknown as AuthStorageLike;

  return { authStorage } as unknown as SlashCommandContext;
}

describe('getProviderList', () => {
  const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  });

  it('labels an OAuth-logged-in provider as oauth (not stored)', () => {
    const ctx = makeCtx({ loggedIn: ['anthropic'], storedKeys: ['anthropic'] });

    const list = getProviderList(ctx, [{ provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]);

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe('oauth');
  });

  it('maps the openai catalog provider to the openai-codex OAuth slot', () => {
    const ctx = makeCtx({ loggedIn: ['openai-codex'] });

    const list = getProviderList(ctx, [{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]);

    expect(list[0]?.source).toBe('oauth');
  });

  it('falls back to stored when not OAuth but a stored key exists', () => {
    const ctx = makeCtx({ storedKeys: ['anthropic'] });

    const list = getProviderList(ctx, [{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]);

    expect(list[0]?.source).toBe('stored');
  });

  it('reports env when only the env var is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-env';
    const ctx = makeCtx({});

    const list = getProviderList(ctx, [{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]);

    expect(list[0]?.source).toBe('env');
  });

  it('reports none when no credentials are present', () => {
    delete process.env.ANTHROPIC_API_KEY;
    const ctx = makeCtx({});

    const list = getProviderList(ctx, [{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]);

    expect(list[0]?.source).toBe('none');
  });

  it('dedupes repeated providers across models', () => {
    const ctx = makeCtx({ loggedIn: ['anthropic'] });

    const list = getProviderList(ctx, [
      { provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
      { provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
    ]);

    expect(list).toHaveLength(1);
  });
});
