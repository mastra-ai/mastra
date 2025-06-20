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
   * Attributes to snippet
   */
  attributesToSnippet?: string[];
  /**
   * Highlight pre tag
   */
  highlightPreTag?: string;
  /**
   * Highlight post tag
   */
  highlightPostTag?: string;
  /**
   * Snippet ellipsis text
   */
  snippetEllipsisText?: string;
};

/**
 * Structure of hierarchy section in Algolia results
 */
interface AlgoliaHierarchySection {
  title?: string;
  content?: string;
  anchor?: string;
}

/**
 * Structure of raw hit object from Algolia with our specific fields
 */
interface AlgoliaHit {
  objectID: string;
  title?: string;
  content?: string;
  url?: string;
  hierarchy?: AlgoliaHierarchySection[];
  _highlightResult?: Record<
    string,
    {
      value: string;
      matchLevel: string;
      matchedWords?: string[];
    }
  >;
  _snippetResult?: Record<
    string,
    {
      value: string;
      matchLevel: string;
    }
  >;
}

export type AlgoliaResult = {
  excerpt: string;
  title: string;
  url: string;
  objectID: string;
  _highlightResult?: Record<
    string,
    {
      value: string;
      matchLevel: string;
      matchedWords?: string[];
    }
  >;
  _snippetResult?: Record<
    string,
    {
      value: string;
      matchLevel: string;
    }
  >;
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
            attributesToSnippet: searchOptions?.attributesToSnippet || [
              "content:15",
            ],
            highlightPreTag: searchOptions?.highlightPreTag || "<mark>",
            highlightPostTag: searchOptions?.highlightPostTag || "</mark>",
            snippetEllipsisText: searchOptions?.snippetEllipsisText || "…",
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
            (hit) => {
              // Type assertion to our expected structure
              const typedHit = hit as AlgoliaHit;

              // Helper function to extract relevant snippet around search terms
              const extractRelevantSnippet = (
                content: string,
                searchTerm: string,
                maxLength: number = 200,
              ): string => {
                if (!content || !searchTerm)
                  return content?.substring(0, maxLength) + "..." || "";

                const lowerContent = content.toLowerCase();
                const lowerSearchTerm = searchTerm.toLowerCase();
                const searchWords = lowerSearchTerm
                  .split(/\s+/)
                  .filter((word) => word.length > 2);

                // Find the first occurrence of any search word
                let bestIndex = -1;
                for (const word of searchWords) {
                  const index = lowerContent.indexOf(word);
                  if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
                    bestIndex = index;
                  }
                }

                if (bestIndex === -1) {
                  return content.substring(0, maxLength) + "...";
                }

                // Extract snippet around the found term
                const start = Math.max(0, bestIndex - 50);
                const end = Math.min(content.length, start + maxLength);

                let snippet = content.substring(start, end);

                // Clean up the snippet
                if (start > 0) snippet = "..." + snippet;
                if (end < content.length) snippet = snippet + "...";

                return snippet;
              };

              // Prioritize snippet result, then highlighted content, then fallback
              let excerpt = "";

              if (typedHit._snippetResult?.content?.value) {
                // Use Algolia's snippet if available
                excerpt = typedHit._snippetResult.content.value;
              } else if (typedHit._highlightResult?.content?.value) {
                // Use highlighted content and extract relevant snippet
                const highlightedContent =
                  typedHit._highlightResult.content.value;
                excerpt = extractRelevantSnippet(
                  highlightedContent,
                  search,
                  200,
                );
              } else if (typedHit.content) {
                // Fallback to extracting snippet from raw content
                excerpt = extractRelevantSnippet(typedHit.content, search, 200);
              } else if (typedHit._highlightResult?.title?.value) {
                excerpt = typedHit._highlightResult.title.value;
              } else {
                excerpt = typedHit.title || "";
              }

              // Create multiple sub_results if we have hierarchy or can detect sections
              const subResults: AlgoliaResult["sub_results"] = [];

              if (typedHit.hierarchy && Array.isArray(typedHit.hierarchy)) {
                // If we have hierarchy information, create sub-results for different sections
                typedHit.hierarchy.forEach(
                  (section: AlgoliaHierarchySection) => {
                    if (
                      section.content &&
                      section.content
                        .toLowerCase()
                        .includes(search.toLowerCase())
                    ) {
                      subResults.push({
                        title: section.title || typedHit.title || "",
                        excerpt: extractRelevantSnippet(
                          section.content,
                          search,
                          180,
                        ),
                        url: `${typedHit.url}${section.anchor ? `#${section.anchor}` : ""}`,
                      });
                    }
                  },
                );

                // If no hierarchy sections matched, add the main result
                if (subResults.length === 0) {
                  subResults.push({
                    title: typedHit.title || "",
                    excerpt: excerpt,
                    url: typedHit.url || "",
                  });
                }
              } else {
                // Single sub-result with the main excerpt
                subResults.push({
                  title: typedHit.title || "",
                  excerpt: excerpt,
                  url: typedHit.url || "",
                });
              }

              return {
                objectID: typedHit.objectID,
                title: typedHit.title || "",
                excerpt: excerpt,
                url: typedHit.url || "",
                _highlightResult: typedHit._highlightResult,
                _snippetResult: typedHit._snippetResult,
                sub_results: subResults,
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
