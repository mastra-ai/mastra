import { useMemo } from 'react';
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
