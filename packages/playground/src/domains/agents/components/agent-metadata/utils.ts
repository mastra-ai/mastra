/**
 * Removes any provider API suffixes like .chat, .responses, .messages, .completion
 * from provider IDs to get the clean provider name.
 *
 * @example
 * cleanProviderId('cerebras.chat') // returns 'cerebras'
 * cleanProviderId('anthropic.messages') // returns 'anthropic'
 * cleanProviderId('openai.responses') // returns 'openai'
 * cleanProviderId('openai') // returns 'openai'
 */
export const cleanProviderId = (providerId: string): string => {
  return providerId.includes(`.`) ? providerId.split(`.`)[0] : providerId;
};

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
