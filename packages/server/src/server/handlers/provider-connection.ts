import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';

/** @deprecated Checks environment configuration only; router models expose hasAuth(). */
export function isProviderConnected(providerId: string, customProviders?: Record<string, ProviderConfig>): boolean {
  if (providerId === 'google-vertex' || providerId.startsWith('google.vertex')) {
    return !!(process.env.GOOGLE_VERTEX_PROJECT && process.env.GOOGLE_VERTEX_LOCATION);
  }

  const cleanId = providerId.replace(/\..*/, '');
  const registry: Record<string, ProviderConfig> = PROVIDER_REGISTRY;
  let provider = registry[cleanId] ?? customProviders?.[cleanId];

  if (!provider && !cleanId.includes('/')) {
    const matchesProvider = ([id]: [string, ProviderConfig]) => {
      const parts = id.split('/');
      return parts.length === 2 && parts[1] === cleanId;
    };
    provider =
      Object.entries(registry).find(matchesProvider)?.[1] ??
      Object.entries(customProviders ?? {}).find(matchesProvider)?.[1];
  }

  if (!provider) return false;
  const envVars = Array.isArray(provider.apiKeyEnvVar) ? provider.apiKeyEnvVar : [provider.apiKeyEnvVar];
  return cleanId === 'google'
    ? envVars.some(envVar => !!process.env[envVar])
    : envVars.every(envVar => !!process.env[envVar]);
}
