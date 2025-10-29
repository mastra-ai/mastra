import { algoliasearch, type SearchClient } from "algoliasearch";
import { useEffect, useRef, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

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
 * Structure of hierarchy in Algolia search results (DocSearch v3 format)
 */
interface AlgoliaHierarchy {
  lvl0?: string;
  lvl1?: string;
  lvl2?: string;
  lvl3?: string;
  lvl4?: string;
  lvl5?: string;
  lvl6?: string;
}

/**
 * Structure of raw hit object from Algolia with our specific fields
 */
interface AlgoliaHit {
  objectID: string;
  content?: string;
  url?: string;
  url_without_anchor?: string;
  anchor?: string;
  hierarchy?: AlgoliaHierarchy;
  type?: string;
  lang?: string;
  section?: string;
  priority?: number;
  depth?: number;
  _highlightResult?: {
    hierarchy?: {
      lvl0?: { value: string; matchLevel: string };
      lvl1?: { value: string; matchLevel: string };
      lvl2?: { value: string; matchLevel: string };
      lvl3?: { value: string; matchLevel: string };
      lvl4?: { value: string; matchLevel: string };
      lvl5?: { value: string; matchLevel: string };
      lvl6?: { value: string; matchLevel: string };
    };
    content?: { value: string; matchLevel: string; matchedWords?: string[] };
  };
  _snippetResult?: {
    content?: { value: string; matchLevel: string };
  };
}

export type AlgoliaResult = {
  excerpt: string;
  title: string;
  url: string;
  objectID: string;
  section?: string; // Section type: docs, guides, reference, examples
  priority?: number; // Priority score for ranking
  depth?: number; // URL path depth for ranking
  _highlightResult?: {
    hierarchy?: {
      lvl0?: { value: string; matchLevel: string };
      lvl1?: { value: string; matchLevel: string };
      lvl2?: { value: string; matchLevel: string };
      lvl3?: { value: string; matchLevel: string };
      lvl4?: { value: string; matchLevel: string };
      lvl5?: { value: string; matchLevel: string };
      lvl6?: { value: string; matchLevel: string };
    };
    content?: { value: string; matchLevel: string; matchedWords?: string[] };
  };
  _snippetResult?: {
    content?: { value: string; matchLevel: string };
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
  hasMore: boolean;
  loadMore: () => void;
  isLoadingMore: boolean;
}

/**
 * A hook that provides debounced search functionality using Algolia
 * @param debounceTime Time in milliseconds to debounce the search
 * @param searchOptions Options to pass to Algolia search
 * @returns Search state and setter function
 */
export function useAlgoliaSearch(
  debounceTime = 100,
  searchOptions?: AlgoliaSearchOptions,
): UseAlgoliaSearchResult {
  const { siteConfig } = useDocusaurusContext();
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<AlgoliaResult[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreAbortControllerRef = useRef<AbortController | null>(null);

  // Initialize Algolia client
  const algoliaClient = useRef<SearchClient | null>(null);

  const hasMore = currentPage < totalPages - 1;

  useEffect(() => {
    // Initialize Algolia client with your credentials from site config
    const { algoliaAppId: appId, algoliaSearchApiKey: apiKey } =
      siteConfig.customFields || {};

    if (appId && apiKey) {
      algoliaClient.current = algoliasearch(appId as string, apiKey as string);
    } else {
      console.warn(
        "Algolia credentials not found. Please set algoliaAppId and algoliaSearchApiKey in docusaurus.config.js customFields.",
      );
    }
  }, [siteConfig]);

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
      setCurrentPage(0);
      setTotalPages(0);
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

        const indexName = searchOptions?.indexName || "docs_crawler"; // Default index name

        const searchRequest = {
          indexName: indexName,
          query: search,
          params: {
            hitsPerPage: searchOptions?.hitsPerPage || 20,
            attributesToRetrieve: searchOptions?.attributesToRetrieve || [
              "hierarchy",
              "content",
              "anchor",
              "url",
              "url_without_anchor",
              "type",
              "section",
              "lang",
              "priority",
              "depth",
            ],
            attributesToHighlight: searchOptions?.attributesToHighlight || [
              "hierarchy.lvl1",
              "hierarchy.lvl2",
              "hierarchy.lvl3",
              "content",
            ],
            attributesToSnippet: searchOptions?.attributesToSnippet || [
              "content:30",
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

              // Build hierarchical title with format "h1: h2" or "h1: h3" etc.
              const buildHierarchicalTitle = (): string => {
                const levels: string[] = [];
                const highlightedLevels: string[] = [];

                // Collect all hierarchy levels (skip lvl0 as it's usually just the section name like "Docs")
                const hierarchyKeys = [
                  "lvl1",
                  "lvl2",
                  "lvl3",
                  "lvl4",
                  "lvl5",
                  "lvl6",
                ] as const;

                for (const key of hierarchyKeys) {
                  const value = typedHit.hierarchy?.[key];
                  const highlightedValue =
                    typedHit._highlightResult?.hierarchy?.[key]?.value;

                  if (value) {
                    levels.push(value);
                    highlightedLevels.push(highlightedValue || value);
                  }
                }

                // If we have multiple levels, format as "h1: h2" or "h1: h3" (showing first and last)
                if (highlightedLevels.length > 1) {
                  return stripColon(
                    `${highlightedLevels[0]}: ${highlightedLevels[highlightedLevels.length - 1]}`,
                  );
                } else if (highlightedLevels.length === 1) {
                  return stripColon(highlightedLevels[0]);
                } else if (typedHit.hierarchy?.lvl0) {
                  return (
                    stripColon(
                      typedHit._highlightResult?.hierarchy?.lvl0?.value || "",
                    ) || stripColon(typedHit.hierarchy.lvl0)
                  );
                }

                return "Untitled";
              };

              const displayTitle = buildHierarchicalTitle();

              // Prioritize snippet result, then highlighted content, then fallback
              let excerpt = "";

              if (typedHit._snippetResult?.content?.value) {
                // Use Algolia's snippet if available (already highlighted)
                excerpt = typedHit._snippetResult.content.value;
              } else if (typedHit._highlightResult?.content?.value) {
                // Use highlighted content
                excerpt = typedHit._highlightResult.content.value;
              } else if (typedHit.content) {
                // Fallback to extracting snippet from raw content
                excerpt = extractRelevantSnippet(typedHit.content, search, 200);
              } else {
                excerpt = displayTitle;
              }

              // Single result per hit (Algolia already handles ranking and deduplication)
              const subResults: AlgoliaResult["sub_results"] = [
                {
                  title: displayTitle,
                  excerpt: excerpt,
                  url: toRelativePath(typedHit.url || ""),
                },
              ];

              return {
                objectID: typedHit.objectID,
                title: displayTitle,
                excerpt: excerpt,
                url: toRelativePath(typedHit.url || ""),
                section: typedHit.section,
                priority: typedHit.priority,
                depth: typedHit.depth,
                _highlightResult: typedHit._highlightResult,
                _snippetResult: typedHit._snippetResult,
                sub_results: subResults,
              };
            },
          );

          // Update pagination metadata
          if ("nbPages" in firstResult) {
            setTotalPages(firstResult.nbPages || 1);
            setCurrentPage(firstResult.page || 0);
          }

          setIsSearchLoading(false);
          setResults(transformedResults);
        } else {
          setIsSearchLoading(false);
          setResults([]);
          setCurrentPage(0);
          setTotalPages(0);
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

  // Function to load more results
  const loadMore = async () => {
    if (!hasMore || isLoadingMore || !algoliaClient.current || !search) {
      return;
    }

    setIsLoadingMore(true);

    // Cancel previous load more request
    if (loadMoreAbortControllerRef.current) {
      loadMoreAbortControllerRef.current.abort();
    }

    loadMoreAbortControllerRef.current = new AbortController();
    const { signal } = loadMoreAbortControllerRef.current;

    try {
      const indexName = searchOptions?.indexName || "docs_crawler";
      const nextPage = currentPage + 1;

      const searchRequest = {
        indexName,
        query: search,
        params: {
          page: nextPage,
          hitsPerPage: searchOptions?.hitsPerPage || 20,
          attributesToRetrieve: searchOptions?.attributesToRetrieve || [
            "hierarchy",
            "content",
            "anchor",
            "url",
            "url_without_anchor",
            "type",
            "section",
            "lang",
            "priority",
            "depth",
          ],
          attributesToHighlight: searchOptions?.attributesToHighlight || [
            "hierarchy.lvl1",
            "hierarchy.lvl2",
            "hierarchy.lvl3",
            "content",
          ],
          attributesToSnippet: searchOptions?.attributesToSnippet || [
            "content:30",
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

      const { results: algoliaResults } = await algoliaClient.current.search([
        searchRequest,
      ]);

      if (signal.aborted) return;

      const firstResult = algoliaResults[0];
      if ("hits" in firstResult) {
        const transformedResults: AlgoliaResult[] = firstResult.hits.map(
          (hit) => {
            const typedHit = hit as AlgoliaHit;

            const buildHierarchicalTitle = (): string => {
              const hierarchyKeys = [
                "lvl1",
                "lvl2",
                "lvl3",
                "lvl4",
                "lvl5",
                "lvl6",
              ] as const;
              const highlightedLevels: string[] = [];

              for (const key of hierarchyKeys) {
                const value = typedHit.hierarchy?.[key];
                const highlightedValue =
                  typedHit._highlightResult?.hierarchy?.[key]?.value;
                if (value) {
                  highlightedLevels.push(highlightedValue || value);
                }
              }

              if (highlightedLevels.length > 1) {
                const nextLevel =
                  highlightedLevels[highlightedLevels.length - 1];
                if (nextLevel) {
                  return stripColon(`${highlightedLevels[0]}: ${nextLevel}`);
                } else {
                  return stripColon(highlightedLevels[0]);
                }
              } else if (highlightedLevels.length === 1) {
                return stripColon(highlightedLevels[0]);
              } else if (typedHit.hierarchy?.lvl0) {
                return (
                  stripColon(
                    typedHit._highlightResult?.hierarchy?.lvl0?.value || "",
                  ) || stripColon(typedHit.hierarchy.lvl0)
                );
              }
              return "Untitled";
            };

            const displayTitle = buildHierarchicalTitle();
            const excerpt =
              typedHit._snippetResult?.content?.value ||
              typedHit._highlightResult?.content?.value ||
              displayTitle;

            return {
              objectID: typedHit.objectID,
              title: displayTitle,
              excerpt,
              url: toRelativePath(typedHit.url || ""),
              section: typedHit.section,
              priority: typedHit.priority,
              depth: typedHit.depth,
              _highlightResult: typedHit._highlightResult,
              _snippetResult: typedHit._snippetResult,
              sub_results: [
                {
                  title: displayTitle,
                  excerpt,
                  url: toRelativePath(typedHit.url || ""),
                },
              ],
            };
          },
        );

        // Append new results to existing ones
        setResults((prevResults) => [...prevResults, ...transformedResults]);
        setCurrentPage(nextPage);
        setIsLoadingMore(false);
      } else {
        setIsLoadingMore(false);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (!signal.aborted) {
        console.error("Algolia load more error:", error);
        setIsLoadingMore(false);
      }
    }
  };

  return {
    isSearchLoading,
    results,
    search,
    setSearch,
    hasMore,
    loadMore,
    isLoadingMore,
  };
}

function stripColon(title: string) {
  return title.charAt(title.length - 1) === ":" ? title.slice(0, -1) : title;
}

/**
 * Convert absolute URLs to relative paths to prevent issues with preview branches
 * @param url - URL from Algolia (could be absolute or relative)
 * @returns Relative path with hash if present
 */
function toRelativePath(url: string): string {
  if (!url) return "";

  try {
    // Try to parse as URL - if it's absolute, extract pathname + hash
    const urlObj = new URL(url);
    return urlObj.pathname + urlObj.hash;
  } catch {
    // If URL parsing fails, it's likely already a relative path
    return url;
  }
}
