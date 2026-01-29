import { useMemo } from 'react';
import { Provider } from '@mastra/client-js';
import { ModelInfo } from '../types';
import {
  flattenProviderModels,
  filterAndSortModels,
  getConnectedModels,
} from '../utils/provider-utils';

/**
 * Hook to get all models flattened with their provider info
 */
export const useAllModels = (providers: Provider[]): ModelInfo[] => {
  return useMemo(() => flattenProviderModels(providers), [providers]);
};

/**
 * Hook to filter and sort models by provider and search term
 */
export const useFilteredModels = (
  allModels: ModelInfo[],
  currentProvider: string,
  searchTerm: string,
  isSearching: boolean,
): ModelInfo[] => {
  return useMemo(
    () => filterAndSortModels(allModels, currentProvider, searchTerm, isSearching),
    [allModels, currentProvider, searchTerm, isSearching],
  );
};

/**
 * Hook to get only models from connected providers
 */
export const useConnectedModels = (providers: Provider[], allModels: ModelInfo[]): ModelInfo[] => {
  return useMemo(() => getConnectedModels(providers, allModels), [providers, allModels]);
};
