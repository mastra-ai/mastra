"use client";

import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import cn from "clsx";
import { Search } from "lucide-react";
import { addBasePath } from "next/dist/client/add-base-path";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type {
  FC,
  FocusEventHandler,
  ReactElement,
  ReactNode,
  SyntheticEvent,
} from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { InformationIcon } from "./svgs/information-icon";
import { SpinnerIcon } from "./svgs/spinner";
import { ScrollArea } from "./ui/scroll-area";
import { JarvisIcon } from "./svgs/Icons";
import { Button } from "./ui/button";

/**
 * Options that can be passed to `pagefind.search()`.
 * @remarks Copied from https://github.com/CloudCannon/pagefind/blob/2a0aa90cfb78bb8551645ac9127a1cd49cf54add/pagefind_web_js/types/index.d.ts#L72-L82
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

type PagefindResult = {
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
  closeModal: () => void;
};

const DEV_SEARCH_NOTICE = (
  <>
    <p>
      Search isn&apos;t available in development because Nextra&nbsp;4 uses
      Pagefind package, which indexes built `.html` files instead of
      `.md`/`.mdx`.
    </p>
    <p className="x:mt-2">
      To test search during development, run `next build` and then restart your
      app with `next dev`.
    </p>
  </>
);

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
  errorText = "Failed to load search index.",
  loading = "Loading…",
  placeholder = "Search documentation…",
  searchOptions,
  setIsSearching,
  onUseAgent,
  closeModal,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ReactElement | string>("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [search, setSearch] = useState("");
  // https://github.com/shuding/nextra/pull/3514
  // defer pagefind results update for prioritizing user input state
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (!!search) {
      setIsSearching?.(true);
    } else {
      setIsSearching?.(false);
    }
  }, [setIsSearching, search]);

  useEffect(() => {
    const handleSearch = async (value: string) => {
      if (!value) {
        setResults([]);
        setError("");
        return;
      }
      setIsLoading(true);
      // @ts-expect-error - allow
      if (!window.pagefind) {
        try {
          await importPagefind();
        } catch (error) {
          const message =
            error instanceof Error
              ? process.env.NODE_ENV !== "production" &&
                error.message.includes("Failed to fetch")
                ? DEV_SEARCH_NOTICE // This error will be tree-shaked in production
                : `${error.constructor.name}: ${error.message}`
              : String(error);
          setError(message);
          setIsLoading(false);
          return;
        }
      }
      // @ts-expect-error - allow
      const response = await window.pagefind!.debouncedSearch<PagefindResult>(
        value,
        searchOptions,
      );
      if (!response) return;

      // @ts-expect-error - allow
      const data = await Promise.all(response.results.map((o) => o.data()));
      setIsLoading(false);
      setError("");
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
    };
    handleSearch(deferredSearch);
  }, [deferredSearch]); // eslint-disable-line react-hooks/exhaustive-deps -- ignore searchOptions

  const router = useRouter();
  const [, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null!);

  const handleFocus: FocusEventHandler = (event) => {
    const isFocus = event.type === "focus";
    setFocused(isFocus);
  };

  const handleChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setSearch(value);
  };

  const handleSelect = (searchResult: PagefindResult | null) => {
    if (!searchResult) return;
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
    setSearch("");
  };

  return (
    <Combobox onChange={handleSelect}>
      <div
        className={cn(
          className,
          "w-full p-4 py-2 flex items-center gap-[14px]",
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
              "outline-none caret-accent-green text-icons-6 focus:outline-none w-full placeholder:text-icons-4 placeholder:text-base placeholder:font-normal",
            )
          }
          autoComplete="off"
          type="search"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleFocus}
          value={search}
          placeholder={placeholder}
          autoFocus
        />
        {!!search && (
          <AgentBadge
            title="Ask Magent"
            onClick={() => onUseAgent({ searchQuery: search })}
          />
        )}
      </div>
      <ScrollArea className="max-h-[500px]">
        <ComboboxOptions
          transition
          modal={false}
          // anchor="bottom"
          className={cn(
            "nextra-search-results", // for user styling
            "nextra-scrollbar x:max-md:h-full",
            // "x:border x:border-gray-200 x:text-gray-100 x:dark:border-neutral-800",
            // "x:z-30 x:rounded-xl x:py-2.5 x:shadow-xl",
            // "x:contrast-more:border x:contrast-more:border-gray-900 x:contrast-more:dark:border-gray-50",
            // "x:backdrop-blur-md x:bg-nextra-bg/70",
            "x:motion-reduce:transition-none",
            // From https://headlessui.com/react/combobox#adding-transitions
            "x:origin-top x:transition x:duration-200 x:ease-out x:data-closed:scale-95 x:data-closed:opacity-0 x:empty:invisible",
            error || isLoading
              ? [
                  "x:md:min-h-28 x:grow x:flex x:justify-center x:text-sm x:gap-2 x:px-8",
                  error
                    ? "x:text-red-500 x:items-start"
                    : "x:text-gray-400 x:items-center",
                ]
              : // headlessui adds max-height as style, use !important to override
                // "x:md:max-h-[min(calc(100vh-5rem),400px)]!",
                "x:w-full x:md:w-[576px]",
          )}
        >
          {error ? (
            <>
              <InformationIcon height="1.25em" className="x:shrink-0" />
              <div className="x:grid">
                <b className="x:mb-2">{errorText}</b>
                {error}
              </div>
            </>
          ) : isLoading ? (
            <>
              <SpinnerIcon height="20" className="x:shrink-0 x:animate-spin" />
              {loading}
            </>
          ) : results.length ? (
            results.map((searchResult) => (
              <Result
                key={searchResult.url}
                data={searchResult}
                closeModal={closeModal}
              />
            ))
          ) : (
            deferredSearch && emptyResult
          )}
        </ComboboxOptions>
      </ScrollArea>
    </Combobox>
  );
};

const Result: FC<{ data: PagefindResult; closeModal: () => void }> = ({
  data,
  closeModal,
}) => {
  return (
    <>
      <div
        className={cn(
          "x:mx-2.5 x:mb-2 x:not-first:mt-6 x:select-none x:border-b x:border-black/10 x:px-2.5 x:pb-1.5 x:text-xs x:font-semibold x:uppercase x:text-gray-600 x:dark:border-white/20 x:dark:text-gray-300",
          "x:contrast-more:border-gray-600 x:contrast-more:text-gray-900 x:contrast-more:dark:border-gray-50 x:contrast-more:dark:text-gray-50",
        )}
      >
        {data.meta.title}
      </div>
      {data.sub_results.map((subResult) => (
        <ComboboxOption
          key={subResult.url}
          as={NextLink}
          value={subResult}
          href={subResult.url}
          onClick={() => {
            closeModal();
          }}
          className={({ focus }) =>
            cn(
              "x:mx-2.5 x:break-words x:rounded-md",
              "x:contrast-more:border",
              focus
                ? "x:text-primary-600 x:contrast-more:border-current x:bg-primary-500/10"
                : "x:text-gray-800 x:dark:text-gray-300 x:contrast-more:border-transparent",
              "x:block x:scroll-m-12 x:px-2.5 x:py-2",
            )
          }
        >
          <div className="x:text-base x:font-semibold x:leading-5">
            {subResult.title}
          </div>
          <div
            className={cn(
              "x:mt-1 x:text-sm x:leading-[1.35rem] x:text-gray-600 x:dark:text-gray-400 x:contrast-more:dark:text-gray-50",
              "x:[&_mark]:bg-primary-600/80 x:[&_mark]:text-white",
            )}
            dangerouslySetInnerHTML={{ __html: subResult.excerpt }}
          />
        </ComboboxOption>
      ))}
    </>
  );
};

function AgentBadge({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex items-center gap-2 px-2 py-1 text-xs font-medium rounded-sm cursor-pointer bg-surface-5 text-accent-green whitespace-nowrap"
      onClick={onClick}
    >
      <span className="relative w-3 h-3">
        <JarvisIcon className="w-full h-full" />
      </span>
      <span className="">{title}</span>
    </Button>
  );
}
