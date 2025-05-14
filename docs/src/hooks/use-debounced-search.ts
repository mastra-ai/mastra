import { useState, useEffect, useRef } from "react";
import { addBasePath } from "next/dist/client/add-base-path";

/**
 * Options that can be passed to `pagefind.search()`.
 */
export type PagefindSearchOptions = {
  /**
   * If set, this call will load all assets but return before searching. Prefer using `pagefind.preload()` instead.
   */
  preload?: boolean;
  /**
   * Add more verbose console logging for this search query.
   */
  verbose?: boolean;
  /**
   * The set of filters to execute with this search. Input type is extremely flexible, see the filtering docs for details.
   */
  filters?: object;
  /**
   * The set of sorts to use for this search, instead of relevancy.
   */
  sort?: object;
};

// Fix React Compiler (BuildHIR::lowerExpression) Handle Import expressions
export async function importPagefind() {
  // @ts-expect-error - allow
  window.pagefind = await import(
    /* webpackIgnore: true */ addBasePath("/_pagefind/pagefind.js")
  );
  // @ts-expect-error - allow
  await window.pagefind!.options({
    baseUrl: "/",
    // ... more search options
  });
}

export type PagefindResult = {
  excerpt: string;
  meta: {
    title: string;
  };
  raw_url: string;
  sub_results: {
    excerpt: string;
    title: string;
    url: string;
  }[];
  url: string;
};

export const DEV_SEARCH_NOTICE =
  "Search isn't available in development because Nextra 4 uses Pagefind package, which indexes built .html files instead of .md/.mdx. To test search during development, run `next build` and then restart your app with `next dev`.";

interface UseDebounceSearchResult {
  isSearchLoading: boolean;
  results: PagefindResult[];
  search: string;
  setSearch: (value: string) => void;
}

/**
 * A hook that provides debounced search functionality using Pagefind
 * @param debounceTime Time in milliseconds to debounce the search
 * @param searchOptions Options to pass to pagefind.search()
 * @returns Search state and setter function
 */
export function useDebounceSearch(
  debounceTime = 300,
  searchOptions?: PagefindSearchOptions,
): UseDebounceSearchResult {
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [search, setSearch] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    setIsSearchLoading(true);

    // Create new abort controller for this search
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Set a new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Check if the request was aborted
        if (signal.aborted) return;

        // @ts-expect-error - allow
        if (!window.pagefind) {
          try {
            await importPagefind();
          } catch (error) {
            const message =
              error instanceof Error
                ? process.env.NODE_ENV !== "production" &&
                  error.message.includes("Failed to fetch")
                  ? DEV_SEARCH_NOTICE
                  : `${error.constructor.name}: ${error.message}`
                : String(error);

            if (signal.aborted) return;
            setIsSearchLoading(false);
            console.error("error", message);
            return;
          }
        }

        // Check if the request was aborted
        if (signal.aborted) return;

        // @ts-expect-error - allow
        const response = await window.pagefind!.search(search, searchOptions);

        // Check if the request was aborted
        if (signal.aborted) return;

        if (!response) {
          setIsSearchLoading(false);
          setResults([]);
          return;
        }

        // @ts-expect-error - allow
        const data = await Promise.all(response.results.map((o) => o.data()));

        // Check if the request was aborted before setting state
        if (signal.aborted) return;

        setIsSearchLoading(false);
        setResults(
          // @ts-expect-error - allow
          data.map((newData) => ({
            ...newData,
            // @ts-expect-error - allow
            sub_results: newData.sub_results.map((r) => {
              const url = r.url.replace(/\.html$/, "").replace(/\.html#/, "#");
              return { ...r, url };
            }),
          })),
        );
      } catch (error) {
        // Ignore AbortError
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (!signal.aborted) {
          console.error("Search error:", error);
          setIsSearchLoading(false);
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
