import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import cn from 'clsx';
import { SearchIcon, SpinnerIcon, Zap } from './search-icons';
import { useHistory } from '@docusaurus/router';
import type { FC, SyntheticEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AlgoliaResult, AlgoliaSearchOptions, useAlgoliaSearch } from '../hooks/use-algolia-search';
import { BookIcon, BurgerIcon } from './search-icons';
import { Button } from './ui/button';
import { DialogClose } from '@radix-ui/react-dialog';

// Custom hook for responsive design
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
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
};

// Union type for search results
type SearchResult = AlgoliaResult | FlattenedResult;

/**
 * A built-in search component provides a seamless and fast search
 * experience out of the box. Under the hood, it leverages Algolia
 * for powerful, fast search capabilities with highlighting and filtering.
 *
 * @see [Algolia documentation](https://www.algolia.com/doc/)
 */
export const CustomSearchWithoutAI: FC<SearchProps> = ({
  className,
  placeholder = 'What are you searching for?',
  searchOptions,
  closeModal,
}) => {
  const { isSearchLoading, results, search, setSearch } = useAlgoliaSearch(300, searchOptions);

  const history = useHistory();
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
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Virtual list for search results
  const virtualizer = useVirtualizer({
    count: results.length ? results.flatMap(r => r.sub_results).length : 0,
    getScrollElement: () => resultsContainerRef.current,
    estimateSize: () => (isMobile ? 90 : 100), // Smaller size for mobile screens
    overscan: 5,
  });

  // Flatten sub_results for virtualization
  const flattenedResults = results.length
    ? results.flatMap(result =>
        result.sub_results.map(sub => ({
          parentUrl: result.url,
          ...sub,
        })),
      )
    : [];

  const totalItems = flattenedResults.length;
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
    // Calling before navigation so selector `html:not(:has(*:focus))` in styles.css will work,
    // and we'll have padding top since input is not focused
    inputRef.current.blur();
    const [url, hash] = searchResult.url.split('#');
    const isSamePathname = location.pathname === url;
    // `useHash` hook doesn't work with NextLink, and clicking on search
    // result from same page doesn't scroll to the heading
    if (isSamePathname) {
      location.href = `#${hash}`;
    } else {
      history.push({
        pathname: searchResult.url,
        hash: hash,
      });
    }
    closeModal();
    setSearch('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!search) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev < totalItems - 1 ? prev + 1 : 0;
          // Scroll to the selected item
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(newIndex, { align: 'auto' });
          });
          return newIndex;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : totalItems - 1;
          // Scroll to the selected item
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(newIndex, { align: 'auto' });
          });
          return newIndex;
        });
        break;
      case 'Enter':
        event.preventDefault();
        if (event.nativeEvent.isComposing) {
          return;
        }
        const resultIndex = selectedIndex;
        const selectedResult = flattenedResults[resultIndex];
        if (selectedResult) {
          handleSelect(selectedResult);
        }
        break;
      case 'Escape':
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
          'border-b-[0.5px] w-full px-2 py-1 md:px-4 border-b-(--border) md:py-[10px] flex items-center gap-[14px]',
        )}
      >
        <span className="relative" onClick={() => inputRef.current.focus()}>
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-(--mastra-icons-3)" viewBox="0 0 12 12">
            <g fill="#212121">
              <line
                x1="7.652"
                y1="7.652"
                x2="10.75"
                y2="10.75"
                fill="none"
                stroke="#212121"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
              ></line>
              <circle
                cx="5"
                cy="5"
                r="3.75"
                fill="none"
                stroke="#212121"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
              ></circle>
            </g>
          </svg>
        </span>
        <input
          ref={inputRef}
          spellCheck={false}
          className={cn(
            'x:[&::-webkit-search-cancel-button]:appearance-none',
            'outline-none placeholder:text-sm caret-[var(--light-green-accent-2)]  dark:caret-accent-green dark:text-icons-6 text-[var(--light-color-text-4)] focus:outline-none w-full placeholder-[var(--light-color-text-4)] dark:placeholder:text-icons-4 placeholder:font-normal',
          )}
          autoComplete="off"
          type="search"
          autoFocus
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          value={search}
          placeholder={placeholder}
        />
        <DialogClose>
          <Button variant="ghost" size="icon" onClick={closeModal}>
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24">
              <g fill="#212121" strokeLinejoin="round" strokeLinecap="round">
                <line
                  x1="19"
                  y1="19"
                  x2="5"
                  y2="5"
                  fill="none"
                  stroke="#212121"
                  strokeLinecap="round"
                  strokeMiterlimit="10"
                  strokeWidth="1.5"
                ></line>
                <line
                  x1="19"
                  y1="5"
                  x2="5"
                  y2="19"
                  fill="none"
                  stroke="#212121"
                  strokeLinecap="round"
                  strokeMiterlimit="10"
                  strokeWidth="1.5"
                ></line>
              </g>
            </svg>
          </Button>
        </DialogClose>
      </div>
      <div
        className={cn(
          'relative px-2 overflow-hidden',
          isSearchLoading || isSearchEmpty || !results.length ? 'h-fit' : 'h-[500px]',
        )}
      >
        <div ref={resultsContainerRef} className="h-full overflow-auto" id="docs-search-results">
          <div
            className={cn(
              'x:motion-reduce:transition-none',
              'x:origin-top x:transition x:duration-200 x:ease-out x:data-closed:scale-95 x:data-closed:opacity-0 x:empty:invisible',
              isSearchLoading && !isSearchEmpty
                ? [
                    'x:md:min-h-28 x:grow x:flex x:justify-center x:text-sm x:gap-2 x:px-8',
                    'x:text-gray-400 x:items-center',
                  ]
                : 'max-h-none!',
              'x:w-full',
            )}
          >
            {isSearchLoading && !isSearchEmpty ? (
              <>
                <SpinnerIcon height="20" className="x:shrink-0 x:animate-spin" />
              </>
            ) : search ? (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map(virtualItem => {
                  // Rest are search results
                  const resultIndex = virtualItem.index;
                  const subResult = flattenedResults[resultIndex];
                  const isSelected = selectedIndex === virtualItem.index;

                  if (!subResult) return null;

                  return (
                    <div
                      key={subResult.url}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div
                        className={cn(
                          'flex flex-col gap-1 p-2 md:p-4 rounded-md cursor-pointer',
                          isSelected
                            ? 'dark:bg-surface-5 bg-[var(--light-color-surface-2)] '
                            : 'bg-[var(--light-color-surface-15)] dark:bg-surface-4',
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
      label: 'Search for Agents',
      search: 'Agents',
    },
    {
      label: 'Search for Workflows',
      search: 'Workflows',
    },
    {
      label: 'Search for Tools and MCP',
      search: 'Tools MCP',
    },
    {
      label: 'Search for Memory',
      search: 'Memory',
    },
    {
      label: 'Search for Evals',
      search: 'Evals',
    },
    {
      label: 'Search for RAG',
      search: 'RAG',
    },
    {
      label: 'Search for Voice',
      search: 'Voice',
    },
  ];

  return (
    <div className="py-2 ">
      <ul className="flex flex-col w-full">
        {searches.map(search => (
          <Button
            key={search.search}
            variant="ghost"
            onClick={() => setSearch(search.search)}
            className={cn(
              'p-2 md:p-3 rounded-md cursor-pointer w-full text-left justify-start h-auto',
              'hover:dark:bg-surface-5 hover:bg-(--mastra-surface-2) ',
              'bg-[var(--light-color-surface-15)] dark:bg-surface-4',
            )}
          >
            <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="currentColor"
                d="M13.2 6.90023V3.29688L18.8034 8.90023H15.2C14.0954 8.90023 13.2 8.0048 13.2 6.90023Z"
              ></path>
              <path
                fill="currentColor"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M11.4 3.29736H7.84183C6.18497 3.29736 4.84183 4.64051 4.84183 6.29736V18.704C4.84183 20.3609 6.18497 21.704 7.84183 21.704H16.1581C17.815 21.704 19.1581 20.3609 19.1581 18.704V10.6999H15.6C13.2804 10.6999 11.4 8.81945 11.4 6.49985V3.29736ZM13.2 6.49958C13.2 7.82507 14.2745 8.89958 15.6 8.89958H18.5939C18.594 8.89967 18.594 8.89976 18.5941 8.89985H15.6C14.2745 8.89985 13.2 7.82534 13.2 6.49985V6.49958Z"
                opacity="0.6"
              ></path>
            </svg>
            <span className="text-sm font-normal truncate dark:text-icons-6 text-[var(--light-color-text-4)]">
              {search.label}
            </span>
          </Button>
        ))}
      </ul>
    </div>
  );
}
