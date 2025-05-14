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
import { useRouter } from "next/navigation";
import type { FC, ReactElement, ReactNode, SyntheticEvent } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { BookIcon, BurgerIcon, JarvisIcon } from "./svgs/Icons";
import { InformationIcon } from "./svgs/information-icon";
import { SpinnerIcon } from "./svgs/spinner";
import { ScrollArea } from "./ui/scroll-area";

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
  setIsAgentMode: (isAgentMode: boolean) => void;
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
  placeholder = "Search or ask AI..",
  searchOptions,
  onUseAgent,
  closeModal,
}) => {
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const [error, setError] = useState<ReactElement | string>("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [search, setSearch] = useState("");
  // https://github.com/shuding/nextra/pull/3514
  // defer pagefind results update for prioritizing user input state
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const handleSearch = async (value: string) => {
      if (!value) {
        setResults([]);
        setError("");
        return;
      }
      setIsSearchLoading(true);
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
          setIsSearchLoading(false);
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
      setIsSearchLoading(false);
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
  const inputRef = useRef<HTMLInputElement>(null!);

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
          isSearchLoading || isSearchEmpty ? "h-fit" : "h-[500px]",
        )}
      >
        <ScrollArea className="h-full">
          <ComboboxOptions
            transition
            static
            modal={false}
            unmount={true}
            className={cn(
              "x:motion-reduce:transition-none",
              // From https://headlessui.com/react/combobox#adding-transitions
              "x:origin-top x:transition x:duration-200 x:ease-out x:data-closed:scale-95 x:data-closed:opacity-0 x:empty:invisible",
              error || (isSearchLoading && !isSearchEmpty)
                ? [
                    "x:md:min-h-28 x:grow x:flex x:justify-center x:text-sm x:gap-2 x:px-8",
                    error
                      ? "x:text-red-500 x:items-start"
                      : "x:text-gray-400 x:items-center",
                  ]
                : // headlessui adds max-height as style, use !important to override
                  "max-h-none!",
              "x:w-full",
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
            ) : isSearchLoading && !isSearchEmpty ? (
              <>
                <SpinnerIcon
                  height="20"
                  className="x:shrink-0 x:animate-spin"
                />
              </>
            ) : results.length ? (
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
                    key="use-ai"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-accent-green shrink-0">
                        <JarvisIcon className="w-6 h-6 shrink-0" />
                      </span>
                      <span className="flex flex-col text-lg font-medium text-left text-icons-5">
                        <span id="use-ai-text" className="text-icons-5">
                          Tell me about{" "}
                          <span className="text-accent-green">{search}</span>
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
                {results.map((searchResult) => (
                  <Result key={searchResult.url} data={searchResult} />
                ))}
              </div>
            ) : (
              deferredSearch && emptyResult
            )}
          </ComboboxOptions>
        </ScrollArea>
      </div>
    </Combobox>
  );
};

const Result: FC<{
  data: PagefindResult;
}> = ({ data }) => {
  return (
    <>
      {data.sub_results.map((subResult) => (
        <ComboboxOption
          key={subResult.url}
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
              dangerouslySetInnerHTML={{ __html: subResult.excerpt }}
            />
          </div>
        </ComboboxOption>
      ))}
    </>
  );
};
