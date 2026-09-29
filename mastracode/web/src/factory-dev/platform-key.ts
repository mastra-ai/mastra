import {
  PlatformApiClient,
  isPlatformKeyRejected,
  platformApiClientConfigFromEnv,
} from '@mastra/factory/integrations/platform/api-client';

import { loadEnvironmentValue } from './settings.js';

const KEY_CHECK_TIMEOUT_MS = 5_000;
const INTEGRATIONS_ROUTING_ENV_VARS = ['MASTRA_INTEGRATIONS_API_URL', 'MASTRA_PLATFORM_REGION'] as const;

export type SavedPlatformKeyCheck =
  | { outcome: 'accepted' }
  | { outcome: 'rejected' }
  | { outcome: 'unchecked'; reason: string };

export async function checkSavedPlatformKey({
  secretKey,
  env,
  envFile,
  fetchImpl,
}: {
  secretKey: string;
  env: NodeJS.ProcessEnv;
  envFile: string;
  fetchImpl?: typeof fetch;
}): Promise<SavedPlatformKeyCheck> {
  const routing: NodeJS.ProcessEnv = {};
  for (const name of INTEGRATIONS_ROUTING_ENV_VARS) {
    routing[name] = env[name] ?? (await loadEnvironmentValue(envFile, name));
  }
  const config = platformApiClientConfigFromEnv({ ...routing, MASTRA_PLATFORM_SECRET_KEY: secretKey });
  try {
    await new PlatformApiClient({ ...config, fetchImpl }).request('GET', '/v2/connections', undefined, {
      signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
    });
    return { outcome: 'accepted' };
  } catch (error) {
    if (isPlatformKeyRejected(error)) return { outcome: 'rejected' };
    return { outcome: 'unchecked', reason: error instanceof Error ? error.message : String(error) };
  }
}
