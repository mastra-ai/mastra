import { useMemo } from 'react';
import { Provider } from '@mastra/client-js';
import { cleanProviderId } from '../utils';

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
 * Check if a provider ID matches, handling gateway prefix fallback.
 * e.g., 'custom' matches 'acme/custom'
 */
const providerMatches = (modelProvider: string, targetProvider: string): boolean => {
  const cleanTarget = cleanProviderId(targetProvider);
  const cleanModel = cleanProviderId(modelProvider);

  // Direct match
  if (cleanModel === cleanTarget) {
    return true;
  }

  // Gateway prefix fallback: 'custom' should match 'acme/custom'
  if (!cleanTarget.includes('/')) {
    const parts = modelProvider.split('/');
    if (parts.length === 2 && parts[1] === cleanTarget) {
      return true;
    }
  }

  return false;
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
      filtered = filtered.filter(m => providerMatches(m.provider, currentProvider));
    }

    if (isSearching && searchTerm) {
      filtered = filtered.filter(m => m.model.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return [...filtered].sort((a, b) => a.model.localeCompare(b.model));
  }, [allModels, searchTerm, currentProvider, isSearching]);
};
