"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import cn from "clsx";
import { Search, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FC, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlgoliaResult,
  AlgoliaSearchOptions,
  useAlgoliaSearch,
} from "../hooks/use-algolia-search";
import { BookIcon, BurgerIcon, JarvisIcon } from "./svgs/Icons";
import { SpinnerIcon } from "./svgs/spinner";
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
  onUseAgent: ({ searchQuery }: { searchQuery: string }) => void;
  closeModal: () => void;
};

// Type for flattened search results
type FlattenedResult = {
  excerpt: string;
  title: string;
  url: string;
  parentUrl: string;
};

// Union type for search results
type SearchResult = AlgoliaResult | FlattenedResult | { url: "use-ai" };

/**
 * A built-in search component provides a seamless and fast search
 * experience out of the box. Under the hood, it leverages Algolia
 * for powerful, fast search capabilities with highlighting and filtering.
 *
 * @see [Algolia documentation](https://www.algolia.com/doc/)
 */
export const CustomSearch: FC<SearchProps> = ({
  className,
  placeholder = "Search or ask AI..",
  searchOptions,
  onUseAgent,
  closeModal,
}) => {
  const { isSearchLoading, results, search, setSearch } = useAlgoliaSearch(
    300,
    searchOptions,
  );

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null!);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

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
    count: results.length
      ? results.flatMap((r) => r.sub_results).length + 1
      : 1, // +1 for the AI option
    getScrollElement: () => resultsContainerRef.current,
    estimateSize: () => (isMobile ? 90 : 100), // Smaller size for mobile screens
    overscan: 5,
  });

  // Flatten sub_results for virtualization
  const flattenedResults = results.length
    ? results.flatMap((result) =>
        result.sub_results.map((sub) => ({
          parentUrl: result.url,
          ...sub,
        })),
      )
    : [];

  const totalItems = flattenedResults.length + 1; // +1 for AI option

  const handleChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setSearch(value);
    // Set first item as selected when there's a search query, reset when empty
    setSelectedIndex(value ? 0 : -1);
  };

  // Auto-select first item when search results change
  useEffect(() => {
    if (search && (results.length > 0 || isSearchLoading)) {
      setSelectedIndex(0);
    } else if (!search) {
      setSelectedIndex(-1);
    }
  }, [search, results.length, isSearchLoading]);

  const handleSelect = (searchResult: SearchResult | null) => {
    if (!searchResult) return;
    if (searchResult.url === "use-ai") {
      onUseAgent({ searchQuery: `Tell me about ${search}` });
      setSearch("");
      return;
    }
    // Calling before navigation so selector `html:not(:has(*:focus))` in styles.css will work,
    // and we'll have padding top since input is not focused
    inputRef.current.blur();
    const [url, hash] = searchResult.url.split("#");
    const isSamePathname = location.pathname === url;
    // `useHash` hook doesn't work with NextLink, and clicking on search
    // result from same page doesn't scroll to the heading
    if (isSamePathname) {
      location.href = `#${hash}`;
    } else {
      router.push(searchResult.url);
    }
    closeModal();
    setSearch("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!search) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev < totalItems - 1 ? prev + 1 : 0;
          // Scroll to the selected item
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(newIndex, { align: "auto" });
          });
          return newIndex;
        });
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : totalItems - 1;
          // Scroll to the selected item
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(newIndex, { align: "auto" });
          });
          return newIndex;
        });
        break;
      case "Enter":
        event.preventDefault();
        if (event.nativeEvent.isComposing) {
          return;
        }
        if (selectedIndex === 0) {
          handleSelect({ url: "use-ai" });
        } else if (selectedIndex > 0) {
          const resultIndex = selectedIndex - 1;
          const selectedResult = flattenedResults[resultIndex];
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

  const isSearchEmpty = !search;

  return (
    <div className="w-full">
      <div
        className={cn(
          className,
          "w-full p-2 py-1 md:p-4 md:py-[10px] flex items-center gap-[14px]",
        )}
      >
        <span className="relative" onClick={() => inputRef.current.focus()}>
          <Search className="w-4 h-4 md:w-5 md:h-5 dark:text-icons-3 text-[var(--light-color-accent-3)]" />
        </span>
        <input
          ref={inputRef}
          spellCheck={false}
          className={cn(
            "x:[&::-webkit-search-cancel-button]:appearance-none",
            "outline-none caret-[var(--light-green-accent-2)]  dark:caret-accent-green dark:text-icons-6 text-[var(--light-color-text-4)] focus:outline-none w-full placeholder-[var(--light-color-text-4)] dark:placeholder:text-icons-4 placeholder:text-base md:placeholder:text-lg placeholder:font-normal",
          )}
          autoComplete="off"
          type="search"
          autoFocus
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          value={search}
          placeholder={placeholder}
        />
      </div>
      <div
        className={cn(
          "relative overflow-hidden",
          isSearchLoading || isSearchEmpty || !results.length
            ? "h-fit"
            : "h-[500px]",
        )}
      >
        <div
          ref={resultsContainerRef}
          className="h-full overflow-auto"
          id="docs-search-results"
        >
          <div
            className={cn(
              "x:motion-reduce:transition-none",
              "x:origin-top x:transition x:duration-200 x:ease-out x:data-closed:scale-95 x:data-closed:opacity-0 x:empty:invisible",
              isSearchLoading && !isSearchEmpty
                ? [
                    "x:md:min-h-28 x:grow x:flex x:justify-center x:text-sm x:gap-2 x:px-8",
                    "x:text-gray-400 x:items-center",
                  ]
                : "max-h-none!",
              "x:w-full",
            )}
          >
            {isSearchLoading && !isSearchEmpty ? (
              <>
                <SpinnerIcon
                  height="20"
                  className="x:shrink-0 x:animate-spin"
                />
              </>
            ) : search ? (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  // First item is the AI suggestion
                  if (virtualItem.index === 0) {
                    const isSelected = selectedIndex === 0;
                    return (
                      <div
                        key="use-ai"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <div className="mt-3">
                          <div className="border-t-[0.5px] border-[var(--light-border-code)] dark:border-borders-1 pt-3">
                            <div
                              className={cn(
                                "w-full flex items-center font-medium justify-between gap-2 cursor-pointer text-base rounded-md px-2 md:px-4 py-2 bg-[url('/image/bloom-2.png')] bg-cover mb-2 bg-right",
                                isSelected
                                  ? "dark:bg-surface-5 bg-[var(--light-color-surface-2)]"
                                  : "dark:bg-surface-4 bg-[var(--light-color-surface-2)]",
                              )}
                              onClick={() => handleSelect({ url: "use-ai" })}
                              onMouseEnter={() => setSelectedIndex(0)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="dark:text-accent-green text-[var(--light-green-accent-2)] shrink-0">
                                  <JarvisIcon className="w-4.5 h-4.5 md:w-6 md:h-6 shrink-0" />
                                </span>
                                <span className="flex flex-col text-base font-medium text-left md:text-lg text-icons-5">
                                  <span
                                    id="use-ai-text"
                                    className="truncate  max-w-[200px] md:max-w-full"
                                  >
                                    <span className="dark:text-icons-5 text-[var(--light-color-text-4)]">
                                      {" "}
                                      Tell me about{" "}
                                    </span>
                                    <span className="dark:text-accent-green text-[var(--light-green-accent-2)]">
                                      {search}
                                    </span>
                                  </span>
                                  <span className="text-icons-3 max-w-[150px] md:max-w-full truncate text-sm md:text-[15px] text-left font-normal">
                                    Ask the Mastra docs agent
                                  </span>
                                </span>
                              </div>
                              <span className="flex items-center opacity-90 dark:opacity-100 h-6 px-2 text-xs font-medium rounded-sm md:h-8 md:px-3 md:text-sm dark:bg-tag-green-2 bg-[var(--light-color-surface-15)] dark:text-accent-green text-[var(--light-color-text-4)] justify-self-end">
                                experimental
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Rest are search results
                  const resultIndex = virtualItem.index - 1; // Subtract 1 because first item is AI option
                  const subResult = flattenedResults[resultIndex];
                  const isSelected = selectedIndex === virtualItem.index;

                  if (!subResult) return null;

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
                          "flex flex-col gap-1 p-2 md:p-4 rounded-md cursor-pointer",
                          isSelected
                            ? "dark:bg-surface-5 bg-[var(--light-color-surface-2)] "
                            : "bg-[var(--light-color-surface-15)] dark:bg-surface-4",
                        )}
                        onClick={() => handleSelect(subResult)}
                        onMouseEnter={() => setSelectedIndex(virtualItem.index)}
                      >
                        <div className="flex gap-2 md:gap-[14px] items-center">
                          <BookIcon className="w-4 h-4 md:w-5 md:h-5 text-icons-3" />
                          <span className="text-base font-medium truncate md:text-lg dark:text-icons-6 text-[var(--light-color-text-4)]">
                            {subResult.title}
                          </span>
                        </div>
                        <div className="ml-2 flex items-center gap-2 truncate border-l-2 dark:border-borders-2 border-[var(--light-border-code)] pl-2 md:pl-6">
                          <BurgerIcon className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0 text-icons-3" />
                          <div
                            className="text-sm md:text-base font-normal truncate text-icons-3 [&_mark]:text-[var(--light-green-accent-2)] dark:[&_mark]:text-accent-green [&_mark]:bg-transparent"
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
            ) : (
              <EmptyState setSearch={setSearch} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function EmptyState({ setSearch }: { setSearch: (search: string) => void }) {
  const searches = [
    {
      label: "Search for RAG",
      search: "RAG",
    },
    {
      label: "Search for Workflows",
      search: "Workflows",
    },
    {
      label: "Search for Tools and MCP",
      search: "Tools MCP",
    },
    {
      label: "Search for Memory",
      search: "Memory",
    },
    {
      label: "Search for Evals",
      search: "Evals",
    },
    {
      label: "Search for Voice",
      search: "Voice",
    },
  ];

  return (
    <div className="pt-4 ">
      <p className="px-2 mb-2 text-sm font-medium text-icons-3 md:px-3">
        Top searches
      </p>
      <ul className="flex flex-col w-full">
        {searches.map((search) => (
          <Button
            key={search.search}
            variant="ghost"
            onClick={() => setSearch(search.search)}
            className={cn(
              "p-2 md:p-3 rounded-md cursor-pointer w-full text-left justify-start h-auto",
              "hover:dark:bg-surface-5 hover:bg-[var(--light-color-surface-2)] ",
              "bg-[var(--light-color-surface-15)] dark:bg-surface-4",
            )}
          >
            <Zap className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-accent-green" />
            <span className="text-sm font-normal truncate dark:text-icons-6 text-[var(--light-color-text-4)]">
              {search.label}
            </span>
          </Button>
        ))}
      </ul>
    </div>
  );
}
