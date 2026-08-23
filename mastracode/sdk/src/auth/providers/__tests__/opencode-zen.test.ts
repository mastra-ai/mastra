import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuthStorage } from '../../storage.js';
import type { OAuthLoginCallbacks } from '../../types.js';
import { OPENCODE_ZEN_AUTH_URL, opencodeZenAuthProvider } from '../opencode-zen.js';

function callbacksWithPrompt(responses: string[]): { callbacks: OAuthLoginCallbacks; prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    callbacks: {
      onAuth: () => {},
      onPrompt: async prompt => {
        prompts.push(prompt.message);
        return responses.shift() ?? '';
      },
    },
  };
}

describe('opencodeZenAuthProvider', () => {
  it('opens the Zen key page and stores a pasted key as an API-key credential', async () => {
    const seen: string[] = [];
    const credential = await opencodeZenAuthProvider.login({
      onAuth: info => seen.push(info.url),
      onPrompt: async () => '  sk-zen-key  ',
    });

    expect(seen).toEqual([OPENCODE_ZEN_AUTH_URL]);
    expect(credential).toEqual({ type: 'api_key', key: 'sk-zen-key' });
  });

  it('reports cancellation when the paste is empty so the free tier stays keyless', async () => {
    const { callbacks } = callbacksWithPrompt(['   ']);

    await expect(opencodeZenAuthProvider.login(callbacks)).rejects.toThrow('Login cancelled');
  });

  it('persists through AuthStorage.login into the apikey slot, not the oauth slot', async () => {
    const storage = new AuthStorage(join(tmpdir(), `opencode-zen-auth-${Date.now()}.json`));
    await storage.login('opencode', {
      onAuth: () => {},
      onPrompt: async () => 'sk-zen-stored',
    });

    expect(storage.getStoredApiKey('opencode')).toBe('sk-zen-stored');
    expect(storage.isLoggedIn('opencode')).toBe(false);
  });
});
