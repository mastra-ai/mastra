import { Provider } from '@mastra/client-js';
import { ModelInfo } from '../types';

/**
 * Popular providers in order of priority for sorting
 */
export const POPULAR_PROVIDERS = ['openai', 'anthropic', 'google', 'openrouter', 'netlify'] as const;

/**
 * Removes provider API suffixes like .chat, .responses, .messages, .completion
 * from provider IDs to get the clean provider name.
 *
 * @example
 * cleanProviderId('cerebras.chat') // returns 'cerebras'
 * cleanProviderId('anthropic.messages') // returns 'anthropic'
 * cleanProviderId('openai.responses') // returns 'openai'
 * cleanProviderId('openai') // returns 'openai'
 */
export const cleanProviderId = (providerId: string): string => {
  return providerId.includes('.') ? providerId.split('.')[0] : providerId;
};

/**
 * Gets the popularity index for a provider ID.
 * Lower index = more popular. Returns length of popular list for non-popular providers.
 */
export const getPopularityIndex = (providerId: string): number => {
  const cleanId = providerId.toLowerCase().split('.')[0];
  const index = POPULAR_PROVIDERS.indexOf(cleanId as (typeof POPULAR_PROVIDERS)[number]);
  return index === -1 ? POPULAR_PROVIDERS.length : index;
};

/**
 * Sorts providers by: 1) connection status (connected first), 2) popularity, 3) alphabetically
 */
export const sortProviders = (providers: Provider[]): Provider[] => {
  return [...providers].sort((a, b) => {
    // First, sort by connection status - connected providers first
    if (a.connected && !b.connected) return -1;
    if (!a.connected && b.connected) return 1;

    // Then by popularity
    const aPopularity = getPopularityIndex(a.id);
    const bPopularity = getPopularityIndex(b.id);
    if (aPopularity !== bPopularity) {
      return aPopularity - bPopularity;
    }

    // Finally, alphabetically by name
    return a.name.localeCompare(b.name);
  });
};

/**
 * Filters providers by search term (matches id or name)
 */
export const filterProviders = (providers: Provider[], searchTerm: string): Provider[] => {
  if (!searchTerm) return providers;

  const term = searchTerm.toLowerCase();
  return providers.filter(
    p => p.id.toLowerCase().includes(term) || p.name.toLowerCase().includes(term),
  );
};

/**
 * Filters and sorts providers
 */
export const filterAndSortProviders = (
  providers: Provider[],
  searchTerm: string,
  isSearching: boolean,
): Provider[] => {
  const term = isSearching ? searchTerm : '';
  const filtered = filterProviders(providers, term);
  return sortProviders(filtered);
};

/**
 * Flattens providers and their models into a single ModelInfo array
 */
export const flattenProviderModels = (providers: Provider[]): ModelInfo[] => {
  return providers.flatMap(provider =>
    provider.models.map(model => ({
      provider: provider.id,
      providerName: provider.name,
      model: model,
    })),
  );
};

/**
 * Filters models by provider ID
 */
export const filterModelsByProvider = (models: ModelInfo[], providerId: string): ModelInfo[] => {
  if (!providerId) return [];
  return models.filter(m => m.provider === providerId);
};

/**
 * Filters models by search term
 */
export const filterModelsBySearch = (models: ModelInfo[], searchTerm: string): ModelInfo[] => {
  if (!searchTerm) return models;

  const term = searchTerm.toLowerCase();
  return models.filter(m => m.model.toLowerCase().includes(term));
};

/**
 * Sorts models alphabetically by model name
 */
export const sortModels = (models: ModelInfo[]): ModelInfo[] => {
  return [...models].sort((a, b) => a.model.localeCompare(b.model));
};

/**
 * Filters and sorts models by provider and search term
 */
export const filterAndSortModels = (
  models: ModelInfo[],
  providerId: string,
  searchTerm: string,
  isSearching: boolean,
): ModelInfo[] => {
  let filtered = filterModelsByProvider(models, providerId);

  if (isSearching && searchTerm) {
    filtered = filterModelsBySearch(filtered, searchTerm);
  }

  return sortModels(filtered);
};

/**
 * Gets connected models from a list of providers
 */
export const getConnectedModels = (providers: Provider[], allModels: ModelInfo[]): ModelInfo[] => {
  return allModels.filter(m => {
    const cleanId = cleanProviderId(m.provider);
    const provider = providers.find(p => cleanProviderId(p.id) === cleanId);
    return provider?.connected === true;
  });
};

/**
 * Checks if a provider is connected
 */
export const isProviderConnected = (providers: Provider[], providerId: string): boolean => {
  const cleanId = cleanProviderId(providerId);
  const provider = providers.find(p => cleanProviderId(p.id) === cleanId);
  return provider?.connected === true;
};

/**
 * Finds a provider by ID (supports both raw and cleaned IDs)
 */
export const findProvider = (providers: Provider[], providerId: string): Provider | undefined => {
  const cleanId = cleanProviderId(providerId);
  return providers.find(p => p.id === cleanId || cleanProviderId(p.id) === cleanId);
};
