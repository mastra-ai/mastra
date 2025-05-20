"use client";

import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import cn from "clsx";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FC, SyntheticEvent } from "react";
import { useRef, useState, useEffect } from "react";
import {
  PagefindResult,
  PagefindSearchOptions,
  useDebounceSearch,
} from "../hooks/use-debounced-search";
import { BookIcon, BurgerIcon, JarvisIcon } from "./svgs/Icons";
import { SpinnerIcon } from "./svgs/spinner";

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
  searchOptions?: PagefindSearchOptions;
  onUseAgent: ({ searchQuery }: { searchQuery: string }) => void;
  closeModal: () => void;
};

/**
 * A built-in search component provides a seamless and fast search
 * experience out of the box. Under the hood, it leverages the
 * [Pagefind package](https://pagefind.app) — a fully client-side search engine optimized for static
 * sites. Pagefind indexes your content at build time and enables highly performant,
 * zero-JavaScript-dependency searches at runtime.
 *
 * @see [Nextra search setup guide](https://nextra.site/docs/guide/search)
 */
export const CustomSearch: FC<SearchProps> = ({
  className,
  placeholder = "Search or ask AI..",
  searchOptions,
  onUseAgent,
  closeModal,
}) => {
  const { isSearchLoading, results, search, setSearch } = useDebounceSearch(
    300,
    searchOptions,
  );

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null!);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

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

  const handleChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setSearch(value);
  };

  const handleSelect = (searchResult: PagefindResult | null) => {
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

  const handleBlur = () => {
    closeModal();
  };

  const isSearchEmpty = !search;

  return (
    <Combobox onChange={handleSelect}>
      <div
        className={cn(
          className,
          "w-full p-2 py-1 md:p-4 md:py-[10px] flex items-center gap-[14px]",
        )}
      >
        <span className="relative" onClick={() => inputRef.current.focus()}>
          <Search className="w-4 h-4 md:w-5 md:h-5 dark:text-icons-3 text-[var(--light-color-accent-3)]" />
        </span>
        <ComboboxInput
          ref={inputRef}
          spellCheck={false}
          className={() =>
            cn(
              "x:[&::-webkit-search-cancel-button]:appearance-none",
              "outline-none caret-[var(--light-green-accent-2)]  dark:caret-accent-green dark:text-icons-6 text-[var(--light-color-text-4)] focus:outline-none w-full placeholder-[var(--light-color-text-4)] dark:placeholder:text-icons-4 placeholder:text-base md:placeholder:text-lg placeholder:font-normal",
            )
          }
          autoComplete="off"
          type="search"
          autoFocus
          onChange={handleChange}
          value={search}
          placeholder={placeholder}
          onBlur={handleBlur}
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
          <ComboboxOptions
            transition
            static
            modal={false}
            unmount={true}
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
                            <ComboboxOption
                              className={({ focus }) =>
                                cn(
                                  "w-full flex items-center font-medium justify-between gap-2 cursor-pointer text-base rounded-md px-2 md:px-4 py-2 bg-[url('/image/bloom-2.png')] bg-cover mb-2 bg-right",
                                  focus
                                    ? "dark:bg-surface-5 bg-[var(--light-color-surface-2)]"
                                    : "dark:bg-surface-4 bg-[var(--light-color-surface-2)]",
                                )
                              }
                              value={{ url: "use-ai" }}
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
                            </ComboboxOption>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Rest are search results
                  const resultIndex = virtualItem.index - 1; // Subtract 1 because first item is AI option
                  const subResult = flattenedResults[resultIndex];

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
                      <ComboboxOption
                        value={subResult}
                        className={({ focus }) =>
                          cn(
                            "flex flex-col gap-2 md:gap-3 p-2 md:p-4 rounded-md cursor-pointer",
                            focus
                              ? "dark:bg-surface-5 bg-[var(--light-color-surface-2)] "
                              : "bg-[var(--light-color-surface-15)] dark:bg-surface-4",
                          )
                        }
                      >
                        <div className="flex gap-2 md:gap-[14px] items-center">
                          <BookIcon className="w-4 h-4 md:w-5 md:h-5 text-icons-3" />
                          <span className="text-base font-medium truncate md:text-lg dark:text-icons-6 text-[var(--light-color-text-4)]">
                            {subResult.title}
                          </span>
                        </div>
                        <div className="ml-2 flex items-center gap-2 md:gap-[14px] truncate border-l-2 dark:border-borders-2 border-[var(--light-border-code)] pl-2 md:pl-4">
                          <BurgerIcon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-icons-3" />
                          <div
                            className="text-base md:text-lg font-normal truncate text-icons-3 [&_mark]:text-[var(--light-green-accent-2)] dark:[&_mark]:text-accent-green [&_mark]:bg-transparent"
                            dangerouslySetInnerHTML={{
                              __html: subResult.excerpt,
                            }}
                          />
                        </div>
                      </ComboboxOption>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </ComboboxOptions>
        </div>
      </div>
    </Combobox>
  );
};
