import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../css/utils";
import { BookOpen, Code2, FileText, Lightbulb, Search } from "lucide-react";
import type { FC, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlgoliaResult,
  AlgoliaSearchOptions,
  useAlgoliaSearch,
} from "../hooks/use-algolia-search";
import { EmptySearch } from "./empty-search";
import { BurgerIcon } from "./search-icons";
import { useHistory } from "@docusaurus/router";
import { CancelIcon } from "./copy-page-icons";
import { Button } from "./ui/button";

// Custom hook for responsive design
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return matches;
};

type SearchProps = {
  /**
   * Placeholder text.
   * @default 'Search documentation…'
   */
  placeholder?: string;
  /** CSS class name. */
  className?: string;
  searchOptions?: AlgoliaSearchOptions;
  closeModal: () => void;
};

// Type for flattened search results
type FlattenedResult = {
  excerpt: string;
  title: string;
  url: string;
  parentUrl: string;
  section?: string;
};

// Union type for search results
type SearchResult = AlgoliaResult | FlattenedResult;

// Helper function to get icon based on section
const getSectionIcon = (section?: string) => {
  switch (section?.toLowerCase()) {
    case "docs":
      return BookOpen;
    case "guides":
      return Lightbulb;
    case "reference":
      return Code2;
    case "examples":
      return FileText;
    default:
      return BookOpen; // Default fallback
  }
};

export const CustomSearch: FC<SearchProps> = ({
  className,
  placeholder = "Search docs...",
  searchOptions,
  closeModal,
}) => {
  const {
    isSearchLoading,
    results,
    search,
    setSearch,
    hasMore,
    loadMore,
    isLoadingMore,
  } = useAlgoliaSearch(300, searchOptions);

  const history = useHistory();
  const inputRef = useRef<HTMLInputElement>(null!);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Ensure input is focused when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Check if screen is mobile size
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Virtual list for search results
  const virtualizer = useVirtualizer({
    count: results.length ? results.flatMap((r) => r.sub_results).length : 0,
    getScrollElement: () => resultsContainerRef.current,
    estimateSize: () => (isMobile ? 80 : 85), // Smaller size for mobile screens
    overscan: 5,
  });

  // Flatten sub_results for virtualization
  const flattenedResults = results.length
    ? results.flatMap((result) =>
        result.sub_results.map((sub) => ({
          parentUrl: result.url,
          section: result.section,
          ...sub,
        })),
      )
    : [];

  const totalItems = flattenedResults.length;

  // Store the previous total items count to detect when new items are loaded
  const prevTotalItemsRef = useRef(totalItems);

  const handleChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setSearch(value);
    // Set first item as selected when there's a search query, reset when empty
    setSelectedIndex(value ? 0 : -1);
  };

  // Auto-select first item when search results change (but only for new searches, not pagination)
  useEffect(() => {
    if (search && (results.length > 0 || isSearchLoading)) {
      // Only reset to first item if this is a new search, not pagination
      // Check if totalItems changed from initial load (0 or 1) to having results
      if (prevTotalItemsRef.current <= 1 && totalItems > 1) {
        setSelectedIndex(0);
      }
    } else if (!search) {
      setSelectedIndex(-1);
    }

    // Update the ref for next comparison
    prevTotalItemsRef.current = totalItems;
  }, [search, results.length, isSearchLoading, totalItems]);

  const handleSelect = (searchResult: SearchResult | null) => {
    if (!searchResult) return;
    // Calling before navigation so selector `html:not(:has(*:focus))` in styles.css will work,
    // and we'll have padding top since input is not focused
    inputRef.current.blur();
    const [url, hash] = searchResult.url.split("#");
    const isSamePathname = location.pathname === url;
    // Handle same-page navigation by scrolling to hash
    if (isSamePathname) {
      location.href = `#${hash}`;
    } else {
      history.push(searchResult.url);
    }
    closeModal();
    setSearch("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const isEmptyState = !search || !results.length;
    const emptyStateItemCount = 11; // Number of items in EmptyState

    switch (event.key) {
      case "Tab":
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) => {
          const maxIndex = isEmptyState
            ? emptyStateItemCount - 1
            : totalItems - 1;
          const newIndex = prev < maxIndex ? prev + 1 : prev;

          // Scroll to the selected item (only for search results with virtualizer)
          if (!isEmptyState) {
            requestAnimationFrame(() => {
              virtualizer.scrollToIndex(newIndex, { align: "auto" });
            });

            // Check if we're approaching the end and should load more
            // Load more when we're within 10 items of the end
            if (hasMore && !isLoadingMore && newIndex >= totalItems - 10) {
              loadMore();
            }
          }

          return newIndex;
        });
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : prev;

          // Scroll to the selected item (only for search results with virtualizer)
          if (!isEmptyState) {
            requestAnimationFrame(() => {
              virtualizer.scrollToIndex(newIndex, { align: "auto" });
            });
          }
          return newIndex;
        });
        break;
      case "Enter":
        event.preventDefault();
        if (event.nativeEvent.isComposing) {
          return;
        }

        if (isEmptyState) {
          // Handle empty state selection
          handleEmptyStateSelect(selectedIndex);
        } else {
          // Handle search result selection
          const selectedResult = flattenedResults[selectedIndex];
          if (selectedResult) {
            handleSelect(selectedResult);
          }
        }
        break;
      case "Escape":
        event.preventDefault();
        closeModal();
        break;
    }
  };

  // Handler for empty state item selection
  const handleEmptyStateSelect = (index: number) => {
    const emptyStateLinks = [
      "/docs/v1/getting-started/installation",
      "/docs/v1/agents/overview",
      "/docs/v1/workflows/overview",
      "/docs/v1/server-db/local-dev-playground",
      "/docs/v1/streaming/overview",
      "/docs/v1/tools-mcp/mcp-overview",
      "/docs/v1/memory/overview",
      "/docs/v1/scorers/overview",
      "/docs/v1/rag/overview",
      "/docs/v1/observability/overview",
      "/docs/v1/deployment/overview",
    ];

    const link = emptyStateLinks[index];
    if (link) {
      inputRef.current.blur();
      history.push(link);
      closeModal();
    }
  };

  const showLoader = isSearchLoading && !!search && !results.length;

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // When the trigger element is visible and we have more results, load them
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      {
        root: resultsContainerRef.current,
        rootMargin: "100px", // Start loading 100px before reaching the bottom
        threshold: 0.1,
      },
    );

    observer.observe(loadMoreTriggerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <div className={cn("overflow-hidden w-full max-h-[600px]")}>
      <div
        className={cn(
          className,
          "flex items-center p-2 w-full border-b border-(--border)/50 dark:border-(--border) md:p-4 gap-[14px]",
        )}
      >
        <span className="relative" onClick={() => inputRef.current.focus()}>
          <Search className="w-4 h-4 md:w-5 md:h-5 dark:text-(--mastra-icons-7) text-(--mastra-icons-7)" />
        </span>
        <input
          ref={inputRef}
          spellCheck={false}
          className={cn(
            "x:[&::-webkit-search-cancel-button]:appearance-none",
            "outline-none caret-(--mastra-green-accent-3) dark:caret-(--mastra-green-accent-2) dark:text-white text-(--mastra-text-tertiary) focus:outline-none w-full placeholder:text-icons-4 dark:placeholder:text-icons-2 placeholder:text-small md:placeholder:text-base placeholder:font-medium",
          )}
          autoComplete="off"
          type="search"
          autoFocus
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          value={search}
          placeholder={placeholder}
        />

        <Button
          variant="ghost"
          onClick={closeModal}
          className="p-0 h-7 w-8 hover:bg-(--mastra-surface-2)  rounded-full flex items-center justify-center hover:text-(--mastra-icons-8)"
        >
          <CancelIcon className="w-4 h-4 dark:text-white text-(--mastra-icons-7)" />
        </Button>
      </div>

      <div className={cn("relative overflow-hidden p-1.5 h-[400px]")}>
        <div
          ref={resultsContainerRef}
          className="overflow-auto h-full"
          id="docs-search-results"
        >
          {!search || !results.length || showLoader ? (
            <EmptySearch
              selectedIndex={selectedIndex}
              onSelect={handleEmptyStateSelect}
              onHover={setSelectedIndex}
            />
          ) : (
            <div
              className={cn(
                "x:motion-reduce:transition-none",
                "x:origin-top x:transition x:duration-200 x:ease-out x:data-closed:scale-95 x:data-closed:opacity-0 x:empty:invisible",
                "x:w-full",
              )}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  if (showLoader) {
                    return;
                  }

                  // The Rest are search results
                  const resultIndex = virtualItem.index;
                  const subResult = flattenedResults[resultIndex];
                  const isSelected = selectedIndex === virtualItem.index;

                  if (!subResult) return null;

                  // Get the appropriate icon component for this section
                  const IconComponent = getSectionIcon(subResult.section);

                  return (
                    <div
                      key={subResult.url}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div
                        className={cn(
                          "flex flex-col gap-1 p-2 rounded-md cursor-pointer",
                          isSelected
                            ? "dark:bg-surface-5 bg-(--mastra-surface-2)"
                            : "bg-(--ifm-background-color) dark:bg-surface-4",
                        )}
                        onClick={() => handleSelect(subResult)}
                        onMouseEnter={() => setSelectedIndex(virtualItem.index)}
                      >
                        <span className="pl-7 text-xs font-medium capitalize text-(--mastra-icons-3)">
                          {subResult.section}
                        </span>
                        <div className="flex gap-2 items-center">
                          <IconComponent className="w-4 h-4 text-(--mastra-icons-3) shrink-0" />
                          <span
                            className="text-sm font-medium truncate dark:text-white text-(--mastra-text-tertiary) [&_mark]:text-(--mastra-green-accent-3)! [&_mark]:bg-transparent"
                            dangerouslySetInnerHTML={{
                              __html: subResult.title,
                            }}
                          />
                        </div>
                        <div className="ml-2 flex items-center gap-2 truncate border-l-2 dark:border-borders-2 border-(--border-code) pl-4">
                          <BurgerIcon className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0 text-(--mastra-icons-3)" />
                          <div
                            className="text-sm font-normal truncate text-(--mastra-icons-3) [&_mark]:text-(--mastra-green-accent-3) dark:[&_mark]:text-(--mastra-green-accent-2) [&_mark]:bg-transparent"
                            dangerouslySetInnerHTML={{
                              __html: subResult.excerpt,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Intersection observer trigger for infinite scroll */}
              {hasMore && results.length > 0 && (
                <div
                  ref={loadMoreTriggerRef}
                  className="p-4 text-sm text-center text-icons-3"
                >
                  {isLoadingMore && (
                    <div className="flex gap-2 justify-center items-center">
                      <div className="w-4 h-4 rounded-full border-2 animate-spin border-accent-green border-t-transparent" />
                      <span>Loading more results...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
