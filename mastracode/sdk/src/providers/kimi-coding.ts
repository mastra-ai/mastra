import { createAnthropic } from '@ai-sdk/anthropic';
import type { MastraModelConfig } from '@mastra/core/llm';
import { ProviderAuthRequiredError } from '../auth/provider-auth-error.js';
import { getKimiCodingDeviceHeaders, isKimiCodingDeviceId } from '../auth/providers/kimi-coding.js';
import { AuthStorage } from '../auth/storage.js';
import type { CredentialStore } from '../auth/types.js';

const PROVIDER_ID = 'kimi-for-coding';
// Pi's provider root is https://api.kimi.com/coding. The AI SDK expects the
// versioned Anthropic base URL and appends /messages itself.
const BASE_URL = 'https://api.kimi.com/coding/v1';

export const KIMI_CODING_MODELS = ['k3', 'k3-256k', 'kimi-for-coding', 'kimi-for-coding-highspeed'] as const;

let authStorageInstance: AuthStorage | null = null;

export function setAuthStorage(storage: AuthStorage | undefined): void {
  authStorageInstance = storage ?? null;
}

function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) authStorageInstance = new AuthStorage();
  return authStorageInstance;
}

export function buildKimiCodingOAuthFetch(options: { credentialStore?: CredentialStore } = {}): typeof fetch {
  return (async (input: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const store = options.credentialStore ?? getAuthStorage();
    store.reload();
    const credential = store.get(PROVIDER_ID);
    if (!credential || credential.type !== 'oauth') {
      throw new ProviderAuthRequiredError('Not logged in to Kimi For Coding.');
    }
    if (!isKimiCodingDeviceId(credential.deviceId)) {
      throw new ProviderAuthRequiredError('Kimi For Coding credentials are invalid. Please reconnect the account.');
    }
    const deviceHeaders = getKimiCodingDeviceHeaders(credential.deviceId);
    const token = await store.getApiKey(PROVIDER_ID);
    if (!token) throw new ProviderAuthRequiredError('Failed to refresh the Kimi For Coding token.');

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    for (const [key, value] of Object.entries(deviceHeaders)) headers.set(key, value);
    headers.delete('authorization');
    headers.delete('x-api-key');
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }) as typeof fetch;
}

export function buildKimiCodingApiKeyFetch(apiKey: string): typeof fetch {
  return (async (input: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.delete('authorization');
    headers.delete('x-api-key');
    headers.set('Authorization', `Bearer ${apiKey}`);
    return fetch(input, { ...init, headers });
  }) as typeof fetch;
}

export function kimiCodingProvider(
  modelId: string,
  options: { apiKey: string; headers?: Record<string, string>; credentialStore?: CredentialStore },
): MastraModelConfig {
  const usesOAuth = options.credentialStore?.get(PROVIDER_ID)?.type === 'oauth';
  const provider = createAnthropic({
    apiKey: 'auth-placeholder',
    baseURL: BASE_URL,
    headers: options.headers,
    fetch: usesOAuth
      ? (buildKimiCodingOAuthFetch({ credentialStore: options.credentialStore }) as any)
      : (buildKimiCodingApiKeyFetch(options.apiKey) as any),
  });
  return provider(modelId) as unknown as MastraModelConfig;
}
