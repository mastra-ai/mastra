import { cleanProviderId } from '@mastra/playground-ui/domains/llm';

/**
 * Finds a provider from a list by provider ID, handling both:
 * 1. Standard providers (e.g., 'openai' matches 'openai')
 * 2. Custom gateway providers where the model's provider doesn't include the gateway prefix
 *    (e.g., 'custom' matches 'acme/custom' in the registry)
 *
 * This is needed because custom gateway providers are stored in the registry with
 * gateway prefix (e.g., 'acme/custom'), but the model router extracts only the
 * provider part without the prefix (e.g., 'custom').
 *
 * @example
 * // Direct match
 * findProviderById([{id: 'openai', ...}], 'openai') // returns {id: 'openai', ...}
 *
 * // Gateway prefix fallback
 * findProviderById([{id: 'acme/custom', ...}], 'custom') // returns {id: 'acme/custom', ...}
 */
export const findProviderById = <T extends { id: string }>(providers: T[], providerId: string): T | undefined => {
  const cleanId = cleanProviderId(providerId);

  // First, try direct match
  const directMatch = providers.find(p => cleanProviderId(p.id) === cleanId);
  if (directMatch) {
    return directMatch;
  }

  // If not found and doesn't contain a slash, check for gateway prefix pattern
  // This handles custom gateway providers stored as "gateway/provider" in the registry
  if (!cleanId.includes('/')) {
    return providers.find(p => {
      const parts = p.id.split('/');
      return parts.length === 2 && parts[1] === cleanId;
    });
  }

  return undefined;
};

/**
 * Resolves an agent's `provider` and `modelId` to the provider id and model name used by the
 * providers list. The server reports a prefixed gateway model (`acme/custom/gpt-4o`) as provider
 * `acme` and model `custom/gpt-4o`, while the providers list has provider `acme/custom` with model
 * `gpt-4o`.
 *
 * @example
 * resolveProviderModel([{id: 'acme/custom', models: ['gpt-4o']}], 'acme', 'custom/gpt-4o')
 * // returns { provider: 'acme/custom', model: 'gpt-4o' }
 */
export const resolveProviderModel = (
  providers: { id: string; models: readonly string[] }[],
  providerId: string,
  modelId: string,
): { provider: string; model: string } => {
  const cleanId = cleanProviderId(providerId);
  const directMatch = findProviderById(providers, cleanId);
  if (directMatch?.models.includes(modelId)) {
    return { provider: directMatch.id, model: modelId };
  }

  const slashIndex = modelId.indexOf('/');
  if (slashIndex !== -1) {
    const prefixedId = `${cleanId}/${modelId.slice(0, slashIndex)}`;
    const prefixedMatch = providers.find(p => p.id === prefixedId);
    if (prefixedMatch) {
      return { provider: prefixedMatch.id, model: modelId.slice(slashIndex + 1) };
    }
  }

  return { provider: directMatch?.id ?? cleanId, model: modelId };
};
