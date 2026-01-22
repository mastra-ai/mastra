import { useMemo } from 'react';
import { useAgentsModelProviders } from '../../hooks/use-agents-model-providers';
import { cleanProviderId } from '../agent-metadata/utils';
import { Provider } from '@mastra/client-js';

export interface ModelInfo {
  provider: string;
  providerName: string;
  model: string;
}

/**
 * Hook to get all models flattened with their provider info
 */
export const useAllModels = (providers: Provider[]): ModelInfo[] => {
  return useMemo(() => {
    return providers.flatMap(provider =>
      provider.models.map(model => ({
        provider: provider.id,
        providerName: provider.name,
        model: model,
      })),
    );
  }, [providers]);
};

/**
 * Hook to filter and sort providers based on search and connection status
 */
export const useFilteredProviders = (providers: Provider[], searchTerm: string, isSearching: boolean): Provider[] => {
  return useMemo(() => {
    const term = isSearching ? searchTerm : '';

    let filtered = providers;
    if (term) {
      filtered = providers.filter(
        p => p.id.toLowerCase().includes(term.toLowerCase()) || p.name.toLowerCase().includes(term.toLowerCase()),
      );
    }

    // Define popular providers in order
    const popularProviders = ['openai', 'anthropic', 'google', 'openrouter', 'netlify'];

    const getPopularityIndex = (providerId: string) => {
      const cleanId = providerId.toLowerCase().split('.')[0];
      const index = popularProviders.indexOf(cleanId);
      return index === -1 ? popularProviders.length : index;
    };

    // Sort by: 1) connection status, 2) popularity, 3) alphabetically
    return [...filtered].sort((a, b) => {
      if (a.connected && !b.connected) return -1;
      if (!a.connected && b.connected) return 1;

      const aPopularity = getPopularityIndex(a.id);
      const bPopularity = getPopularityIndex(b.id);
      if (aPopularity !== bPopularity) {
        return aPopularity - bPopularity;
      }

      return a.name.localeCompare(b.name);
    });
  }, [providers, searchTerm, isSearching]);
};

/**
 * Hook to filter models by provider and search term
 */
export const useFilteredModels = (
  allModels: ModelInfo[],
  currentProvider: string,
  searchTerm: string,
  isSearching: boolean,
): ModelInfo[] => {
  return useMemo(() => {
    let filtered = allModels;

    if (currentProvider) {
      filtered = filtered.filter(m => m.provider === currentProvider);
    }

    if (isSearching && searchTerm) {
      filtered = filtered.filter(m => m.model.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return [...filtered].sort((a, b) => a.model.localeCompare(b.model));
  }, [allModels, searchTerm, currentProvider, isSearching]);
};

/**
 * Combined hook for model picker data
 */
export const useModelPickerData = (selectedProvider: string) => {
  const { data: dataProviders, isLoading: providersLoading } = useAgentsModelProviders();
  const providers = dataProviders?.providers || [];
  const currentModelProvider = cleanProviderId(selectedProvider);
  const allModels = useAllModels(providers);
  const currentProvider = providers.find((p: Provider) => p.id === currentModelProvider);

  return {
    providers,
    providersLoading,
    allModels,
    currentModelProvider,
    currentProvider,
  };
};
