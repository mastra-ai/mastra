import { useMemo } from 'react';
import { Provider } from '@mastra/client-js';

/**
 * Hook to filter and sort providers based on search and connection status
 * Sort order: connected -> popular (openai, anthropic, google, openrouter, netlify) -> alphabetical
 */
export const useFilteredProviders = (
  providers: Provider[],
  searchTerm: string,
  isSearching: boolean,
): Provider[] => {
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
