import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { MastraModelConfig } from '@mastra/core/llm';
import { ProviderAuthRequiredError } from '../auth/provider-auth-error.js';
import { AuthStorage } from '../auth/storage.js';
import type { CredentialStore } from '../auth/types.js';

const PROVIDER_ID = 'cursor';
const DEFAULT_BASE_URL = 'https://api2.cursor.sh/v1';

/** Fallback catalog from Pi's cursor provider. Live usable models need Cursor's protobuf API. */
export const CURSOR_MODELS = [
  'claude-fable-5-thinking-high',
  'claude-opus-5-thinking-high',
  'cursor-grok-4.6-high',
  'gpt-5.6-sol-high',
] as const;

let authStorageInstance: AuthStorage | null = null;

export function setAuthStorage(storage: AuthStorage | undefined): void {
  authStorageInstance = storage ?? null;
}

function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) authStorageInstance = new AuthStorage();
  return authStorageInstance;
}

export function cursorApiBaseUrl(): string {
  const override = process.env.CURSOR_API_ENDPOINT?.trim() || process.env.CURSOR_API_BASE_URL?.trim();
  return (override || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function buildCursorOAuthFetch(options: { credentialStore?: CredentialStore } = {}): typeof fetch {
  return (async (input: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const store = options.credentialStore ?? getAuthStorage();
    store.reload();
    const credential = store.get(PROVIDER_ID);
    if (!credential || credential.type !== 'oauth') {
      throw new ProviderAuthRequiredError('Not logged in to Cursor.');
    }
    const token = await store.getApiKey(PROVIDER_ID);
    if (!token) throw new ProviderAuthRequiredError('Failed to refresh the Cursor token.');

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.delete('authorization');
    headers.delete('x-api-key');
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-cursor-client-type', 'cli');
    return fetch(input, { ...init, headers });
  }) as typeof fetch;
}

export function cursorProvider(
  modelId: string,
  options?: { headers?: Record<string, string>; authStorage?: CredentialStore },
): MastraModelConfig {
  const provider = createOpenAICompatible({
    name: PROVIDER_ID,
    baseURL: cursorApiBaseUrl(),
    apiKey: 'oauth-placeholder',
    headers: options?.headers,
    fetch: buildCursorOAuthFetch({ credentialStore: options?.authStorage }),
  });
  return provider.chatModel(modelId);
}
