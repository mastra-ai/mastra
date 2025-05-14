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
import type { FC, ReactNode, SyntheticEvent } from "react";
import { useRef } from "react";
import {
  PagefindResult,
  PagefindSearchOptions,
  useDebounceSearch,
} from "../hooks/use-debounced-search";
import { BookIcon, BurgerIcon, JarvisIcon } from "./svgs/Icons";
import { SpinnerIcon } from "./svgs/spinner";

type SearchProps = {
  /**
   * Not found text.
   * @default 'No results found.'
   */
  emptyResult?: ReactNode;
  /**
   * Error text.
   * @default 'Failed to load search index.'
   * */
  errorText?: ReactNode;
  /**
   * Loading text.
   * @default 'Loading…'
   */
  loading?: ReactNode;
  /**
   * Placeholder text.
   * @default 'Search documentation…'
   */
  placeholder?: string;
  /** CSS class name. */
  className?: string;
  searchOptions?: PagefindSearchOptions;
  isAgentMode?: boolean;
  setIsSearching?: (isSearching: boolean) => void;
  onUseAgent: ({ searchQuery }: { searchQuery: string }) => void;
  setIsAgentMode: (isAgentMode: boolean) => void;
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
  emptyResult = "No results found.",
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

  // Virtual list for search results
  const virtualizer = useVirtualizer({
    count: results.length
      ? results.flatMap((r) => r.sub_results).length + 1
      : 0, // +1 for the AI option
    getScrollElement: () => resultsContainerRef.current,
    estimateSize: () => 100, // Approximate height of each result item
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
          "w-full p-4 py-[10px] flex items-center gap-[14px]",
        )}
      >
        <span className="relative" onClick={() => inputRef.current.focus()}>
          <Search className="w-5 h-5 text-icons-3" />
        </span>
        <ComboboxInput
          ref={inputRef}
          spellCheck={false}
          className={() =>
            cn(
              "x:[&::-webkit-search-cancel-button]:appearance-none",
              "outline-none caret-accent-green text-icons-6 focus:outline-none w-full placeholder:text-icons-4 placeholder:text-lg placeholder:font-normal",
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
              <div>
                {results.length > 0 && (
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
                              <div className="border-t-[0.5px] border-borders-1 pt-3">
                                <ComboboxOption
                                  className={({ focus }) =>
                                    cn(
                                      "w-full flex items-center font-medium justify-between gap-2 cursor-pointer text-base rounded-md px-4 py-2 bg-[url('/image/bloom-2.png')] bg-cover mb-2 bg-right",
                                      focus ? "bg-surface-5" : "bg-surface-4",
                                    )
                                  }
                                  value={{ url: "use-ai" }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-accent-green shrink-0">
                                      <JarvisIcon className="w-6 h-6 shrink-0" />
                                    </span>
                                    <span className="flex flex-col text-lg font-medium text-left text-icons-5">
                                      <span
                                        id="use-ai-text"
                                        className="text-icons-5"
                                      >
                                        Tell me about{" "}
                                        <span className="text-accent-green">
                                          {search}
                                        </span>
                                      </span>
                                      <span className="text-icons-3 text-[15px] text-left font-normal">
                                        Use AI to answer your question
                                      </span>
                                    </span>
                                  </div>
                                  <span className="flex items-center h-8 px-3 text-sm font-medium rounded-sm bg-tag-green-2 text-accent-green justify-self-end">
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
                                "flex flex-col gap-3 p-4 rounded-md cursor-pointer",
                                focus ? "bg-surface-5" : "bg-surface-4",
                              )
                            }
                          >
                            <div className="flex gap-[14px] items-center">
                              <BookIcon className="w-5 h-5 text-icons-3" />
                              <span className="text-lg font-medium truncate text-icons-6">
                                {subResult.title}
                              </span>
                            </div>
                            <div className="ml-2 flex items-center gap-[14px] truncate border-l-2 border-borders-2 pl-4">
                              <BurgerIcon className="w-4 h-4 shrink-0 text-icons-3" />
                              <div
                                className="text-lg font-normal truncate text-icons-3 [&_mark]:text-accent-green [&_mark]:bg-transparent"
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
                )}
                {results.length === 0 && emptyResult}
              </div>
            ) : null}
          </ComboboxOptions>
        </div>
      </div>
    </Combobox>
  );
};
