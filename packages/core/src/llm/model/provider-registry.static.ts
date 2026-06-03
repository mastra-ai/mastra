/**
 * Browser-safe provider registry reads.
 *
 * This module intentionally has NO `node:*` imports and does NOT touch the
 * gateway-backed `GatewayRegistry`. It reads provider data directly from the
 * checked-in static `provider-registry.json`, which is exactly what the runtime
 * registry resolves to when dynamic loading is disabled (the case in browsers,
 * where `MASTRA_DEV` is unset). Keeping it dependency-free lets browser-facing
 * code (e.g. the agent-builder allowlist) import it without dragging Node
 * builtins into the bundle.
 */

import staticRegistry from './provider-registry.json';

/**
 * Get all statically-registered provider IDs.
 */
export function getRegisteredProvidersStatic(): string[] {
  return Object.keys(staticRegistry.providers);
}

/**
 * Check if a provider is registered in the static registry.
 */
export function isProviderRegisteredStatic(providerId: string): boolean {
  return Object.prototype.hasOwnProperty.call(staticRegistry.providers, providerId);
}

/**
 * Parse a model string to extract provider and model ID.
 * Examples:
 *   "openai/gpt-4o" -> { provider: "openai", modelId: "gpt-4o" }
 *   "fireworks/accounts/etc/model" -> { provider: "fireworks", modelId: "accounts/etc/model" }
 *   "gpt-4o" -> { provider: null, modelId: "gpt-4o" }
 */
export function parseModelString(modelString: string): { provider: string | null; modelId: string } {
  const firstSlashIndex = modelString.indexOf('/');

  if (firstSlashIndex !== -1) {
    // Has at least one slash - extract everything before first slash as provider
    const provider = modelString.substring(0, firstSlashIndex);
    const modelId = modelString.substring(firstSlashIndex + 1);

    if (provider && modelId) {
      return {
        provider,
        modelId,
      };
    }
  }

  // No slash or invalid format
  return {
    provider: null,
    modelId: modelString,
  };
}
