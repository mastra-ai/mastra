import type { Mastra } from '@mastra/core';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';

import type { AgentModel } from '../agent-builder-creation-workflow/types';

/**
 * Enumerate the full provider/model catalog available to the running Mastra
 * instance, flattened to the `{ provider, name }` shape the agent-creation
 * workflow consumes.
 *
 * This mirrors `buildProvidersList` in
 * `packages/server/src/server/handlers/agents.ts` (static `PROVIDER_REGISTRY`
 * + dynamic gateway providers) so the editor-side model availability matches
 * what the server exposes via `GET /editor/builder/models/available`. It is
 * intentionally kept local to the editor `ee` layer rather than importing from
 * `@mastra/server` or adding to `@mastra/core`.
 */
export async function buildProviderModelCatalog(mastra: Mastra): Promise<AgentModel[]> {
  const allProviders: Record<string, ProviderConfig> = {};

  for (const [id, provider] of Object.entries(PROVIDER_REGISTRY)) {
    allProviders[id] = provider as ProviderConfig;
  }

  // Include gateway providers (defaults + user-registered), mirroring the server.
  const allGateways = mastra.listGateways();
  if (allGateways) {
    for (const gateway of Object.values(allGateways)) {
      // Skip models.dev gateway (already covered by PROVIDER_REGISTRY).
      if (gateway.id === 'models.dev') continue;
      try {
        const gatewayProviders = await gateway.fetchProviders();
        for (const [providerId, config] of Object.entries(gatewayProviders)) {
          // Apply the same prefixing logic as the server: if providerId matches
          // gateway.id it's a unified gateway (use the gateway id); otherwise
          // prefix with the gateway id (e.g. "netlify/anthropic").
          const prefixedId = providerId === gateway.id ? gateway.id : `${gateway.id}/${providerId}`;
          // Only add when not already present from PROVIDER_REGISTRY.
          if (!(prefixedId in allProviders)) {
            allProviders[prefixedId] = config;
          }
        }
      } catch (error) {
        // One bad gateway must not break resolution — warn and continue.
        console.warn(`Failed to fetch providers from gateway "${gateway.id}":`, error);
      }
    }
  }

  const entries: AgentModel[] = [];
  const seen = new Set<string>();
  for (const [provider, config] of Object.entries(allProviders)) {
    for (const name of config.models) {
      const key = `${provider}/${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ provider, name });
    }
  }

  return entries;
}
