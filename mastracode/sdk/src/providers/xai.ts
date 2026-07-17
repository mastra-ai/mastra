/**
 * xAI (Grok) OAuth Provider
 *
 * Uses OAuth tokens from AuthStorage to authenticate with the xAI API.
 * The xAI API speaks an OpenAI-compatible chat format, and the OAuth access
 * token is accepted as a bearer API key, so we plug `@ai-sdk/openai-compatible`
 * into `https://api.x.ai/v1` with a custom fetch that injects the (auto-refreshed)
 * access token.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { MastraModelConfig } from '@mastra/core/llm';
import { AuthStorage } from '../auth/storage.js';
import type { CredentialStore } from '../auth/types.js';

const XAI_PROVIDER_ID = 'xai';
const XAI_BASE_URL = 'https://api.x.ai/v1';

// Singleton auth storage instance (shared with claude-max.ts / github-copilot.ts when not overridden).
let authStorageInstance: AuthStorage | null = null;

/** Get or create the shared AuthStorage instance. */
export function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) {
    authStorageInstance = new AuthStorage();
  }
  return authStorageInstance;
}

/** Set a custom AuthStorage instance (useful for tests / TUI integration). */
export function setAuthStorage(storage: AuthStorage | undefined): void {
  authStorageInstance = storage ?? null;
}

/**
 * Build a fetch wrapper that authenticates with xAI OAuth.
 * Injects the access token (auto-refreshed by AuthStorage) as a bearer token,
 * preserving non-auth headers from the caller.
 */
export function buildXAIOAuthFetch(opts: { authStorage?: CredentialStore } = {}): typeof fetch {
  return (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const storage = opts.authStorage ?? getAuthStorage();
    storage.reload();

    const cred = storage.get(XAI_PROVIDER_ID);
    if (!cred || cred.type !== 'oauth') {
      throw new Error('Not logged in to xAI. Run /login first.');
    }

    // getApiKey() refreshes the access token if it has expired.
    const accessToken = await storage.getApiKey(XAI_PROVIDER_ID);
    if (!accessToken) {
      throw new Error('Failed to refresh xAI token. Please /login again.');
    }

    // Preserve existing headers, strip auth-related ones. Explicit init
    // headers override headers carried by an incoming Request.
    const headers = new Headers(url instanceof Request ? url.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    headers.delete('authorization');
    headers.delete('x-api-key');

    headers.set('Authorization', `Bearer ${accessToken}`);

    try {
      return await fetch(url, { ...init, headers });
    } catch (error) {
      if (error && typeof error === 'object') {
        Object.assign(error as Record<string, unknown>, {
          requestUrl: url instanceof URL ? url.toString() : typeof url === 'string' ? url : (url as Request).url,
        });
      }
      throw error;
    }
  }) as typeof fetch;
}

/**
 * Creates an xAI model using OAuth authentication.
 * Uses OAuth tokens from AuthStorage (auto-refreshes when needed).
 */
export function xaiProvider(
  modelId: string,
  options?: { headers?: Record<string, string>; authStorage?: CredentialStore },
): MastraModelConfig {
  const provider = createOpenAICompatible({
    name: XAI_PROVIDER_ID,
    baseURL: XAI_BASE_URL,
    apiKey: 'oauth-placeholder', // real auth injected by the custom fetch
    headers: options?.headers,
    fetch: buildXAIOAuthFetch({ authStorage: options?.authStorage }),
  });
  return provider.chatModel(modelId);
}
