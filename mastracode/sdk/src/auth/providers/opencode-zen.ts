import type { ApiKeyCredential, OAuthLoginCallbacks, OAuthProviderInterface } from '../types.js';

/** Where OpenCode Zen hands out API keys (also the sign-in page). */
export const OPENCODE_ZEN_AUTH_URL = 'https://opencode.ai/auth';

/**
 * OpenCode Zen is an API-key provider, not OAuth: its login flow opens the
 * key page in the browser and prompts for a paste. Submitting empty keeps the
 * anonymous free tier (the flow reports "cancelled" rather than storing junk).
 */
export const opencodeZenAuthProvider: OAuthProviderInterface = {
  id: 'opencode',
  name: 'OpenCode Zen',

  async login(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredential> {
    callbacks.onAuth({
      url: OPENCODE_ZEN_AUTH_URL,
      instructions:
        'Sign in, then create and copy your API key. Free models also work without any key — just skip this.',
    });
    const key = await callbacks.onPrompt({
      message: 'OpenCode Zen API key',
      placeholder: 'paste your key, or leave empty to use only free models',
      allowEmpty: true,
    });
    const trimmed = key.trim();
    if (!trimmed) {
      throw new Error('Login cancelled');
    }
    return { type: 'api_key', key: trimmed };
  },

  // API keys never expire; the interface still demands a refresh hook.
  async refreshToken(credentials) {
    return credentials;
  },

  getApiKey(credentials) {
    return credentials.type === 'api_key' ? credentials.key : '';
  },
};
