import { algoliasearch, type SearchClient } from "algoliasearch";
import { useEffect, useRef, useState } from "react";

/**
 * Options that can be passed to Algolia search.
 */
export type AlgoliaSearchOptions = {
  /**
   * The index to search in
   */
  indexName: string;
  /**
   * Maximum number of hits to return
   */
  hitsPerPage?: number;
  /**
   * Filters to apply to the search (e.g., "locale:en" to filter by locale)
   */
  filters?: string;
  /**
   * Facet filters to apply
   */
  facetFilters?: string[][];
  /**
   * Attributes to retrieve
   */
  attributesToRetrieve?: string[];
  /**
   * Attributes to highlight
   */
  attributesToHighlight?: string[];
  /**
   * Highlight pre tag
   */
  highlightPreTag?: string;
  /**
   * Highlight post tag
   */
  highlightPostTag?: string;
};

export type AlgoliaResult = {
  excerpt: string;
  title: string;
  url: string;
  objectID: string;
  _highlightResult?: {
    [key: string]: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
  };
  sub_results: {
    excerpt: string;
    title: string;
    url: string;
  }[];
};

interface UseAlgoliaSearchResult {
  isSearchLoading: boolean;
  results: AlgoliaResult[];
  search: string;
  setSearch: (value: string) => void;
}

/**
 * A hook that provides debounced search functionality using Algolia
 * @param debounceTime Time in milliseconds to debounce the search
 * @param searchOptions Options to pass to Algolia search
 * @returns Search state and setter function
 */
export function useAlgoliaSearch(
  debounceTime = 300,
  searchOptions?: AlgoliaSearchOptions,
): UseAlgoliaSearchResult {
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [results, setResults] = useState<AlgoliaResult[]>([]);
  const [search, setSearch] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize Algolia client
  const algoliaClient = useRef<SearchClient | null>(null);

  useEffect(() => {
    // Initialize Algolia client with your credentials
    // You'll need to set these environment variables
    const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
    const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY;

    if (appId && apiKey) {
      algoliaClient.current = algoliasearch(appId, apiKey);
    } else {
      console.warn(
        "Algolia credentials not found. Please set NEXT_PUBLIC_ALGOLIA_APP_ID and NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY environment variables.",
      );
    }
  }, []);

  useEffect(() => {
    // Clear previous timer on each search change
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Cancel previous search request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!search) {
      setResults([]);
      setIsSearchLoading(false);
      return;
    }

    if (!algoliaClient.current) {
      console.error("Algolia client not initialized");
      return;
    }

    setIsSearchLoading(true);

    // Create new abort controller for this search
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Set a new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Check if the request was aborted
        if (signal.aborted) return;

        if (!algoliaClient.current) {
          setIsSearchLoading(false);
          return;
        }

        const indexName = searchOptions?.indexName || "crawler_mastra crawler"; // Default index name

        const searchRequest = {
          indexName: indexName,
          query: search,
          params: {
            hitsPerPage: searchOptions?.hitsPerPage || 20,
            attributesToRetrieve: searchOptions?.attributesToRetrieve || [
              "title",
              "content",
              "url",
              "hierarchy",
            ],
            attributesToHighlight: searchOptions?.attributesToHighlight || [
              "title",
              "content",
            ],
            highlightPreTag: searchOptions?.highlightPreTag || "<mark>",
            highlightPostTag: searchOptions?.highlightPostTag || "</mark>",
            ...(searchOptions?.filters && { filters: searchOptions.filters }),
            ...(searchOptions?.facetFilters && {
              facetFilters: searchOptions.facetFilters,
            }),
          },
        };

        const { results } = await algoliaClient.current.search([searchRequest]);

        // Check if the request was aborted
        if (signal.aborted) return;

        // Transform Algolia results to match the expected format
        const firstResult = results[0];
        if ("hits" in firstResult) {
          const transformedResults: AlgoliaResult[] = firstResult.hits.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (hit: any) => {
              // Extract highlighted content for excerpt
              const excerpt =
                hit._highlightResult?.content?.value ||
                hit.content?.substring(0, 200) + "..." ||
                hit._highlightResult?.title?.value ||
                hit.title ||
                "";

              return {
                objectID: hit.objectID,
                title: hit.title || "",
                excerpt: excerpt,
                url: hit.url || "",
                _highlightResult: hit._highlightResult,
                sub_results: [
                  {
                    title: hit.title || "",
                    excerpt: excerpt,
                    url: hit.url || "",
                  },
                ],
              };
            },
          );

          setIsSearchLoading(false);
          setResults(transformedResults);
        } else {
          setIsSearchLoading(false);
          setResults([]);
        }
      } catch (error) {
        // Ignore AbortError
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (!signal.aborted) {
          console.error("Algolia search error:", error);
          setIsSearchLoading(false);
          setResults([]);
        }
      }
    }, debounceTime);

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [search, debounceTime, searchOptions]);

  return {
    isSearchLoading,
    results,
    search,
    setSearch,
  };
}
