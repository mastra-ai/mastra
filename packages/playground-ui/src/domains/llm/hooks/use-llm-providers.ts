import { useMemo } from 'react';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { Provider } from '@mastra/client-js';
import { sortProviders, filterAndSortProviders } from '../utils/provider-utils';

/**
 * Fetches LLM model providers from the Mastra client
 */
export const useLLMProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents-model-providers'],
    queryFn: () => client.listAgentsModelProviders(),
    retry: false,
  });
};

/**
 * Hook to get sorted providers (connected first, then by popularity)
 */
export const useSortedProviders = (providers: Provider[]): Provider[] => {
  return useMemo(() => sortProviders(providers), [providers]);
};

/**
 * Hook to filter and sort providers based on search term
 */
export const useFilteredProviders = (
  providers: Provider[],
  searchTerm: string,
  isSearching: boolean,
): Provider[] => {
  return useMemo(
    () => filterAndSortProviders(providers, searchTerm, isSearching),
    [providers, searchTerm, isSearching],
  );
};
