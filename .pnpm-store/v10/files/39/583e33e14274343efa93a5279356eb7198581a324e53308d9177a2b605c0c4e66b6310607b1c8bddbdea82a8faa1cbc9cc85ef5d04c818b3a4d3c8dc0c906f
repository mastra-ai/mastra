import { useMemo, useState } from "react";

import { OptimisticLocalStore } from "../browser/index.js";
import {
  FunctionReturnType,
  PaginationOptions,
  paginationOptsValidator,
  PaginationResult,
} from "../server/index.js";
import { ConvexError, convexToJson, Infer, Value } from "../values/index.js";
import { useQueries } from "./use_queries.js";
import {
  FunctionArgs,
  FunctionReference,
  getFunctionName,
} from "../server/api.js";
import { BetterOmit, Expand } from "../type_utils.js";
import { useConvex } from "./client.js";
import { compareValues } from "../values/compare.js";

/**
 * A {@link server.FunctionReference} that is usable with {@link usePaginatedQuery}.
 *
 * This function reference must:
 * - Refer to a public query
 * - Have an argument named "paginationOpts" of type {@link server.PaginationOptions}
 * - Have a return type of {@link server.PaginationResult}.
 *
 * @public
 */
export type PaginatedQueryReference = FunctionReference<
  "query",
  "public",
  { paginationOpts: PaginationOptions },
  PaginationResult<any>
>;

// Incrementing integer for each page queried in the usePaginatedQuery hook.
type QueryPageKey = number;

type UsePaginatedQueryState = {
  query: FunctionReference<"query">;
  args: Record<string, Value>;
  id: number;
  nextPageKey: QueryPageKey;
  pageKeys: QueryPageKey[];
  queries: Record<
    QueryPageKey,
    {
      query: FunctionReference<"query">;
      // Use the validator type as a test that it matches the args
      // we generate.
      args: { paginationOpts: Infer<typeof paginationOptsValidator> };
    }
  >;
  ongoingSplits: Record<QueryPageKey, [QueryPageKey, QueryPageKey]>;
  skip: boolean;
};

const splitQuery =
  (key: QueryPageKey, splitCursor: string, continueCursor: string) =>
  (prevState: UsePaginatedQueryState) => {
    const queries = { ...prevState.queries };
    const splitKey1 = prevState.nextPageKey;
    const splitKey2 = prevState.nextPageKey + 1;
    const nextPageKey = prevState.nextPageKey + 2;
    queries[splitKey1] = {
      query: prevState.query,
      args: {
        ...prevState.args,
        paginationOpts: {
          ...prevState.queries[key].args.paginationOpts,
          endCursor: splitCursor,
        },
      },
    };
    queries[splitKey2] = {
      query: prevState.query,
      args: {
        ...prevState.args,
        paginationOpts: {
          ...prevState.queries[key].args.paginationOpts,
          cursor: splitCursor,
          endCursor: continueCursor,
        },
      },
    };
    const ongoingSplits = { ...prevState.ongoingSplits };
    ongoingSplits[key] = [splitKey1, splitKey2];
    return {
      ...prevState,
      nextPageKey,
      queries,
      ongoingSplits,
    };
  };

const completeSplitQuery =
  (key: QueryPageKey) => (prevState: UsePaginatedQueryState) => {
    const completedSplit = prevState.ongoingSplits[key];
    if (completedSplit === undefined) {
      return prevState;
    }
    const queries = { ...prevState.queries };
    delete queries[key];
    const ongoingSplits = { ...prevState.ongoingSplits };
    delete ongoingSplits[key];
    let pageKeys = prevState.pageKeys.slice();
    const pageIndex = prevState.pageKeys.findIndex((v) => v === key);
    if (pageIndex >= 0) {
      pageKeys = [
        ...prevState.pageKeys.slice(0, pageIndex),
        ...completedSplit,
        ...prevState.pageKeys.slice(pageIndex + 1),
      ];
    }
    return {
      ...prevState,
      queries,
      pageKeys,
      ongoingSplits,
    };
  };

/**
 * Load data reactively from a paginated query to a create a growing list.
 *
 * This can be used to power "infinite scroll" UIs.
 *
 * This hook must be used with public query references that match
 * {@link PaginatedQueryReference}.
 *
 * `usePaginatedQuery` concatenates all the pages of results into a single list
 * and manages the continuation cursors when requesting more items.
 *
 * Example usage:
 * ```typescript
 * const { results, status, isLoading, loadMore } = usePaginatedQuery(
 *   api.messages.list,
 *   { channel: "#general" },
 *   { initialNumItems: 5 }
 * );
 * ```
 *
 * If the query reference or arguments change, the pagination state will be reset
 * to the first page. Similarly, if any of the pages result in an InvalidCursor
 * error or an error associated with too much data, the pagination state will also
 * reset to the first page.
 *
 * To learn more about pagination, see [Paginated Queries](https://docs.convex.dev/database/pagination).
 *
 * @param query - A FunctionReference to the public query function to run.
 * @param args - The arguments object for the query function, excluding
 * the `paginationOpts` property. That property is injected by this hook.
 * @param options - An object specifying the `initialNumItems` to be loaded in
 * the first page.
 * @returns A {@link UsePaginatedQueryResult} that includes the currently loaded
 * items, the status of the pagination, and a `loadMore` function.
 *
 * @public
 */
export function usePaginatedQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  options: { initialNumItems: number },
): UsePaginatedQueryReturnType<Query> {
  const { user } = usePaginatedQueryInternal(query, args, options);
  return user;
}

/** @internal */
export const includePage = Symbol("includePageKeys");

/** @internal */
export const page = Symbol("page");

/**
 * @internal
 */
export function usePaginatedQueryInternal<
  Query extends PaginatedQueryReference,
>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  options: {
    initialNumItems: number;
    [includePage]?: boolean;
  },
): {
  user: UsePaginatedQueryReturnType<Query>;
  internal: { state: UsePaginatedQueryState };
} {
  if (
    typeof options?.initialNumItems !== "number" ||
    options.initialNumItems < 0
  ) {
    throw new Error(
      `\`options.initialNumItems\` must be a positive number. Received \`${options?.initialNumItems}\`.`,
    );
  }
  const skip = args === "skip";
  const argsObject = skip ? {} : args;
  const queryName = getFunctionName(query);
  const createInitialState = useMemo(() => {
    return () => {
      const id = nextPaginationId();
      return {
        query,
        args: argsObject as Record<string, Value>,
        id,
        nextPageKey: 1,
        pageKeys: skip ? [] : [0],
        queries: skip
          ? ({} as UsePaginatedQueryState["queries"])
          : {
              0: {
                query,
                args: {
                  ...argsObject,
                  paginationOpts: {
                    numItems: options.initialNumItems,
                    cursor: null,
                    id,
                  },
                },
              },
            },
        ongoingSplits: {},
        skip,
      };
    };
    // ESLint doesn't like that we're stringifying the args. We do this because
    // we want to avoid rerendering if the args are a different
    // object that serializes to the same result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(convexToJson(argsObject as Value)),
    queryName,
    options.initialNumItems,
    skip,
  ]);

  const [state, setState] =
    useState<UsePaginatedQueryState>(createInitialState);

  // `currState` is the state that we'll render based on.
  let currState = state;
  if (
    getFunctionName(query) !== getFunctionName(state.query) ||
    JSON.stringify(convexToJson(argsObject as Value)) !==
      JSON.stringify(convexToJson(state.args)) ||
    skip !== state.skip
  ) {
    currState = createInitialState();
    setState(currState);
  }
  const convexClient = useConvex();
  const logger = convexClient.logger;

  const resultsObject = useQueries(currState.queries);

  const isIncludingPageKeys = options[includePage] ?? false;
  const [results, maybeLastResult]: [
    Value[],
    undefined | PaginationResult<Value>,
  ] = useMemo(() => {
    let currResult = undefined;

    const allItems = [];
    for (const pageKey of currState.pageKeys) {
      currResult = resultsObject[pageKey];
      if (currResult === undefined) {
        break;
      }

      if (currResult instanceof Error) {
        if (
          currResult.message.includes("InvalidCursor") ||
          (currResult instanceof ConvexError &&
            typeof currResult.data === "object" &&
            currResult.data?.isConvexSystemError === true &&
            currResult.data?.paginationError === "InvalidCursor")
        ) {
          // - InvalidCursor: If the cursor is invalid, probably the paginated
          // database query was data-dependent and changed underneath us. The
          // cursor in the params or journal no longer matches the current
          // database query.

          // In all cases, we want to restart pagination to throw away all our
          // existing cursors.
          logger.warn(
            "usePaginatedQuery hit error, resetting pagination state: " +
              currResult.message,
          );
          setState(createInitialState);
          return [[], undefined];
        } else {
          throw currResult;
        }
      }
      const ongoingSplit = currState.ongoingSplits[pageKey];
      if (ongoingSplit !== undefined) {
        if (
          resultsObject[ongoingSplit[0]] !== undefined &&
          resultsObject[ongoingSplit[1]] !== undefined
        ) {
          // Both pages of the split have results now. Swap them in.
          setState(completeSplitQuery(pageKey));
        }
      } else if (
        currResult.splitCursor &&
        (currResult.pageStatus === "SplitRecommended" ||
          currResult.pageStatus === "SplitRequired" ||
          currResult.page.length > options.initialNumItems * 2)
      ) {
        // If a single page has more than double the expected number of items,
        // or if the server requests a split, split the page into two.
        setState(
          splitQuery(
            pageKey,
            currResult.splitCursor,
            currResult.continueCursor,
          ),
        );
      }
      if (currResult.pageStatus === "SplitRequired") {
        // If pageStatus is 'SplitRequired', it means the server was not able to
        // fetch the full page. So we stop results before the incomplete
        // page and return 'LoadingMore' while the page is splitting.
        return [allItems, undefined];
      }
      allItems.push(
        ...(isIncludingPageKeys
          ? currResult.page.map((i: any) => ({
              ...i,
              [page]: pageKey.toString(),
            }))
          : currResult.page),
      );
    }
    return [allItems, currResult];
  }, [
    resultsObject,
    currState.pageKeys,
    currState.ongoingSplits,
    options.initialNumItems,
    createInitialState,
    logger,
    isIncludingPageKeys,
  ]);

  const statusObject = useMemo(() => {
    if (maybeLastResult === undefined) {
      if (currState.nextPageKey === 1) {
        return {
          status: "LoadingFirstPage",
          isLoading: true,
          loadMore: (_numItems: number) => {
            // Intentional noop.
          },
        } as const;
      } else {
        return {
          status: "LoadingMore",
          isLoading: true,
          loadMore: (_numItems: number) => {
            // Intentional noop.
          },
        } as const;
      }
    }
    if (maybeLastResult.isDone) {
      return {
        status: "Exhausted",
        isLoading: false,
        loadMore: (_numItems: number) => {
          // Intentional noop.
        },
      } as const;
    }
    const continueCursor = maybeLastResult.continueCursor;
    let alreadyLoadingMore = false;
    return {
      status: "CanLoadMore",
      isLoading: false,
      loadMore: (numItems: number) => {
        if (!alreadyLoadingMore) {
          alreadyLoadingMore = true;
          setState((prevState) => {
            const pageKeys = [...prevState.pageKeys, prevState.nextPageKey];
            const queries = { ...prevState.queries };
            queries[prevState.nextPageKey] = {
              query: prevState.query,
              args: {
                ...prevState.args,
                paginationOpts: {
                  numItems,
                  cursor: continueCursor,
                  id: prevState.id,
                },
              },
            };
            return {
              ...prevState,
              nextPageKey: prevState.nextPageKey + 1,
              pageKeys,
              queries,
            };
          });
        }
      },
    } as const;
  }, [maybeLastResult, currState.nextPageKey]);

  return {
    user: {
      results,
      ...statusObject,
    },
    internal: { state: currState },
  };
}

let paginationId = 0;
/**
 * Generate a new, unique ID for a pagination session.
 *
 * Every usage of {@link usePaginatedQuery} puts a unique ID into the
 * query function arguments as a "cache-buster". This serves two purposes:
 *
 * 1. All calls to {@link usePaginatedQuery} have independent query
 * journals.
 *
 * Every time we start a new pagination session, we'll load the first page of
 * results and receive a fresh journal. Without the ID, we might instead reuse
 * a query subscription already present in our client. This isn't desirable
 * because the existing query function result may have grown or shrunk from the
 * requested `initialNumItems`.
 *
 * 2. We can restart the pagination session on some types of errors.
 *
 * Sometimes we want to restart pagination from the beginning if we hit an error.
 * Similar to (1), we'd like to ensure that this new session actually requests
 * its first page from the server and doesn't reuse a query result already
 * present in the client that may have hit the error.
 *
 * @returns The pagination ID.
 */
function nextPaginationId(): number {
  paginationId++;
  return paginationId;
}

/**
 * Reset pagination id for tests only, so tests know what it is.
 */
export function resetPaginationId() {
  paginationId = 0;
}

/**
 * The result of calling the {@link usePaginatedQuery} hook.
 *
 * This includes:
 * - `results` - An array of the currently loaded results.
 * - `isLoading` - Whether the hook is currently loading results.
 * - `status` - The status of the pagination. The possible statuses are:
 *   - "LoadingFirstPage": The hook is loading the first page of results.
 *   - "CanLoadMore": This query may have more items to fetch. Call `loadMore` to
 *   fetch another page.
 *   - "LoadingMore": We're currently loading another page of results.
 *   - "Exhausted": We've paginated to the end of the list.
 * - `loadMore(n)` A callback to fetch more results. This will only fetch more
 * results if the status is "CanLoadMore".
 *
 * @public
 */
export type UsePaginatedQueryResult<Item> = {
  results: Item[];
  loadMore: (numItems: number) => void;
} & (
  | {
      status: "LoadingFirstPage";
      isLoading: true;
    }
  | {
      status: "CanLoadMore";
      isLoading: false;
    }
  | {
      status: "LoadingMore";
      isLoading: true;
    }
  | {
      status: "Exhausted";
      isLoading: false;
    }
);

/**
 * The possible pagination statuses in {@link UsePaginatedQueryResult}.
 *
 * This is a union of string literal types.
 * @public
 */
export type PaginationStatus = UsePaginatedQueryResult<any>["status"];

/**
 * Given a {@link PaginatedQueryReference}, get the type of the arguments
 * object for the query, excluding the `paginationOpts` argument.
 *
 * @public
 */
export type PaginatedQueryArgs<Query extends PaginatedQueryReference> = Expand<
  BetterOmit<FunctionArgs<Query>, "paginationOpts">
>;

/**
 * Given a {@link PaginatedQueryReference}, get the type of the item being
 * paginated over.
 * @public
 */
export type PaginatedQueryItem<Query extends PaginatedQueryReference> =
  FunctionReturnType<Query>["page"][number];

/**
 * The return type of {@link usePaginatedQuery}.
 *
 * @public
 */
export type UsePaginatedQueryReturnType<Query extends PaginatedQueryReference> =
  UsePaginatedQueryResult<PaginatedQueryItem<Query>>;

/**
 * Optimistically update the values in a paginated list.
 *
 * This optimistic update is designed to be used to update data loaded with
 * {@link usePaginatedQuery}. It updates the list by applying
 * `updateValue` to each element of the list across all of the loaded pages.
 *
 * This will only apply to queries with a matching names and arguments.
 *
 * Example usage:
 * ```ts
 * const myMutation = useMutation(api.myModule.myMutation)
 * .withOptimisticUpdate((localStore, mutationArg) => {
 *
 *   // Optimistically update the document with ID `mutationArg`
 *   // to have an additional property.
 *
 *   optimisticallyUpdateValueInPaginatedQuery(
 *     localStore,
 *     api.myModule.paginatedQuery
 *     {},
 *     currentValue => {
 *       if (mutationArg === currentValue._id) {
 *         return {
 *           ...currentValue,
 *           "newProperty": "newValue",
 *         };
 *       }
 *       return currentValue;
 *     }
 *   );
 *
 * });
 * ```
 *
 * @param localStore - An {@link OptimisticLocalStore} to update.
 * @param query - A {@link FunctionReference} for the paginated query to update.
 * @param args - The arguments object to the query function, excluding the
 * `paginationOpts` property.
 * @param updateValue - A function to produce the new values.
 *
 * @public
 */
export function optimisticallyUpdateValueInPaginatedQuery<
  Query extends PaginatedQueryReference,
>(
  localStore: OptimisticLocalStore,
  query: Query,
  args: PaginatedQueryArgs<Query>,
  updateValue: (
    currentValue: PaginatedQueryItem<Query>,
  ) => PaginatedQueryItem<Query>,
): void {
  const expectedArgs = JSON.stringify(convexToJson(args as Value));

  for (const queryResult of localStore.getAllQueries(query)) {
    if (queryResult.value !== undefined) {
      const { paginationOpts: _, ...innerArgs } = queryResult.args as {
        paginationOpts: PaginationOptions;
      };
      if (JSON.stringify(convexToJson(innerArgs as Value)) === expectedArgs) {
        const value = queryResult.value;
        if (
          typeof value === "object" &&
          value !== null &&
          Array.isArray(value.page)
        ) {
          localStore.setQuery(query, queryResult.args, {
            ...value,
            page: value.page.map(updateValue),
          });
        }
      }
    }
  }
}

/**
 * Updates a paginated query to insert an element at the top of the list.
 *
 * This is regardless of the sort order, so if the list is in descending order,
 * the inserted element will be treated as the "biggest" element, but if it's
 * ascending, it'll be treated as the "smallest".
 *
 * Example:
 * ```ts
 * const createTask = useMutation(api.tasks.create)
 *   .withOptimisticUpdate((localStore, mutationArgs) => {
 *   insertAtTop({
 *     paginatedQuery: api.tasks.list,
 *     argsToMatch: { listId: mutationArgs.listId },
 *     localQueryStore: localStore,
 *     item: { _id: crypto.randomUUID() as Id<"tasks">, title: mutationArgs.title, completed: false },
 *   });
 * });
 * ```
 *
 * @param options.paginatedQuery - A function reference to the paginated query.
 * @param options.argsToMatch - Optional arguments that must be in each relevant paginated query.
 * This is useful if you use the same query function with different arguments to load
 * different lists.
 * @param options.localQueryStore
 * @param options.item The item to insert.
 * @returns
 */
export function insertAtTop<Query extends PaginatedQueryReference>(options: {
  paginatedQuery: Query;
  argsToMatch?: Partial<PaginatedQueryArgs<Query>>;
  localQueryStore: OptimisticLocalStore;
  item: PaginatedQueryItem<Query>;
}) {
  const { paginatedQuery, argsToMatch, localQueryStore, item } = options;
  const queries = localQueryStore.getAllQueries(paginatedQuery);
  const queriesThatMatch = queries.filter((q) => {
    if (argsToMatch === undefined) {
      return true;
    }
    return Object.keys(argsToMatch).every(
      // @ts-expect-error -- This should be safe since both should be plain objects
      (k) => compareValues(argsToMatch[k], q.args[k]) === 0,
    );
  });
  const firstPage = queriesThatMatch.find(
    (q) => q.args.paginationOpts.cursor === null,
  );
  if (firstPage === undefined || firstPage.value === undefined) {
    // first page is not loaded, so don't update it until it loads
    return;
  }
  localQueryStore.setQuery(paginatedQuery, firstPage.args, {
    ...firstPage.value,
    page: [item, ...firstPage.value.page],
  });
}

/**
 * Updates a paginated query to insert an element at the bottom of the list.
 *
 * This is regardless of the sort order, so if the list is in descending order,
 * the inserted element will be treated as the "smallest" element, but if it's
 * ascending, it'll be treated as the "biggest".
 *
 * This only has an effect if the last page is loaded, since otherwise it would result
 * in the element being inserted at the end of whatever is loaded (which is the middle of the list)
 * and then popping out once the optimistic update is over.
 *
 * @param options.paginatedQuery - A function reference to the paginated query.
 * @param options.argsToMatch - Optional arguments that must be in each relevant paginated query.
 * This is useful if you use the same query function with different arguments to load
 * different lists.
 * @param options.localQueryStore
 * @param options.element The element to insert.
 * @returns
 */
export function insertAtBottomIfLoaded<
  Query extends PaginatedQueryReference,
>(options: {
  paginatedQuery: Query;
  argsToMatch?: Partial<PaginatedQueryArgs<Query>>;
  localQueryStore: OptimisticLocalStore;
  item: PaginatedQueryItem<Query>;
}) {
  const { paginatedQuery, localQueryStore, item, argsToMatch } = options;
  const queries = localQueryStore.getAllQueries(paginatedQuery);
  const queriesThatMatch = queries.filter((q) => {
    if (argsToMatch === undefined) {
      return true;
    }
    return Object.keys(argsToMatch).every(
      // @ts-expect-error -- This should be safe since both should be plain objects
      (k) => compareValues(argsToMatch[k], q.args[k]) === 0,
    );
  });
  const lastPage = queriesThatMatch.find(
    (q) => q.value !== undefined && q.value.isDone,
  );
  if (lastPage === undefined) {
    // last page is not loaded, so don't update it since the item would immediately pop out
    // when the server updates
    return;
  }
  localQueryStore.setQuery(paginatedQuery, lastPage.args, {
    ...lastPage.value!,
    page: [...lastPage.value!.page, item],
  });
}

type LocalQueryResult<Query extends FunctionReference<"query">> = {
  args: FunctionArgs<Query>;
  value: undefined | FunctionReturnType<Query>;
};

type LoadedResult<Query extends FunctionReference<"query">> = {
  args: FunctionArgs<Query>;
  value: FunctionReturnType<Query>;
};

/**
 * This is a helper function for inserting an item at a specific position in a paginated query.
 *
 * You must provide the sortOrder and a function for deriving the sort key (an array of values) from an item in the list.
 *
 * This will only work if the server query uses the same sort order and sort key as the optimistic update.
 *
 * Example:
 * ```ts
 * const createTask = useMutation(api.tasks.create)
 *   .withOptimisticUpdate((localStore, mutationArgs) => {
 *   insertAtPosition({
 *     paginatedQuery: api.tasks.listByPriority,
 *     argsToMatch: { listId: mutationArgs.listId },
 *     sortOrder: "asc",
 *     sortKeyFromItem: (item) => [item.priority, item._creationTime],
 *     localQueryStore: localStore,
 *     item: {
 *       _id: crypto.randomUUID() as Id<"tasks">,
 *       _creationTime: Date.now(),
 *       title: mutationArgs.title,
 *       completed: false,
 *       priority: mutationArgs.priority,
 *     },
 *   });
 * });
 * ```
 * @param options.paginatedQuery - A function reference to the paginated query.
 * @param options.argsToMatch - Optional arguments that must be in each relevant paginated query.
 * This is useful if you use the same query function with different arguments to load
 * different lists.
 * @param options.sortOrder - The sort order of the paginated query ("asc" or "desc").
 * @param options.sortKeyFromItem - A function for deriving the sort key (an array of values) from an element in the list.
 * Including a tie-breaker field like `_creationTime` is recommended.
 * @param options.localQueryStore
 * @param options.item - The item to insert.
 * @returns
 */
export function insertAtPosition<
  Query extends PaginatedQueryReference,
>(options: {
  paginatedQuery: Query;
  argsToMatch?: Partial<PaginatedQueryArgs<Query>>;
  sortOrder: "asc" | "desc";
  sortKeyFromItem: (element: PaginatedQueryItem<Query>) => Value | Value[];
  localQueryStore: OptimisticLocalStore;
  item: PaginatedQueryItem<Query>;
}) {
  const {
    paginatedQuery,
    sortOrder,
    sortKeyFromItem,
    localQueryStore,
    item,
    argsToMatch,
  } = options;

  const queries: LocalQueryResult<Query>[] =
    localQueryStore.getAllQueries(paginatedQuery);
  // Group into sets of pages for the same usePaginatedQuery. Grouping is by all
  // args except paginationOpts, but including paginationOpts.id.
  const queryGroups: Record<string, LocalQueryResult<Query>[]> = {};
  for (const query of queries) {
    if (
      argsToMatch !== undefined &&
      !Object.keys(argsToMatch).every(
        (k) =>
          // @ts-ignore why is this not working?
          argsToMatch[k] === query.args[k],
      )
    ) {
      continue;
    }
    const key = JSON.stringify(
      Object.fromEntries(
        Object.entries(query.args).map(([k, v]) => [
          k,
          k === "paginationOpts" ? (v as any).id : v,
        ]),
      ),
    );
    queryGroups[key] ??= [];
    queryGroups[key].push(query);
  }
  for (const pageQueries of Object.values(queryGroups)) {
    insertAtPositionInPages({
      pageQueries,
      paginatedQuery,
      sortOrder,
      sortKeyFromItem,
      localQueryStore,
      item,
    });
  }
}

function insertAtPositionInPages<
  Query extends PaginatedQueryReference,
>(options: {
  pageQueries: LocalQueryResult<Query>[];
  paginatedQuery: Query;
  sortOrder: "asc" | "desc";
  sortKeyFromItem: (element: PaginatedQueryItem<Query>) => Value | Value[];
  localQueryStore: OptimisticLocalStore;
  item: PaginatedQueryItem<Query>;
}) {
  const {
    pageQueries,
    sortOrder,
    sortKeyFromItem,
    localQueryStore,
    item,
    paginatedQuery,
  } = options;
  const insertedKey = sortKeyFromItem(item);
  const loadedPages: LoadedResult<Query>[] = pageQueries.filter(
    (q): q is LoadedResult<Query> =>
      q.value !== undefined && q.value.page.length > 0,
  );
  const sortedPages = loadedPages.sort((a, b) => {
    const aKey = sortKeyFromItem(a.value.page[0]);
    const bKey = sortKeyFromItem(b.value.page[0]);
    if (sortOrder === "asc") {
      return compareValues(aKey, bKey);
    } else {
      return compareValues(bKey, aKey);
    }
  });

  // check if the inserted element is before the first page
  const firstLoadedPage = sortedPages[0];
  if (firstLoadedPage === undefined) {
    // no pages, so don't update until they load
    return;
  }
  const firstPageKey = sortKeyFromItem(firstLoadedPage.value.page[0]);
  const isBeforeFirstPage =
    sortOrder === "asc"
      ? compareValues(insertedKey, firstPageKey) <= 0
      : compareValues(insertedKey, firstPageKey) >= 0;
  if (isBeforeFirstPage) {
    if (firstLoadedPage.args.paginationOpts.cursor === null) {
      localQueryStore.setQuery(paginatedQuery, firstLoadedPage.args, {
        ...firstLoadedPage.value,
        page: [item, ...firstLoadedPage.value.page],
      });
    } else {
      // if the very first page is not loaded
      return;
    }
    return;
  }

  const lastLoadedPage = sortedPages[sortedPages.length - 1];
  if (lastLoadedPage === undefined) {
    // no pages, so don't update until they load
    return;
  }
  const lastPageKey = sortKeyFromItem(
    lastLoadedPage.value.page[lastLoadedPage.value.page.length - 1],
  );
  const isAfterLastPage =
    sortOrder === "asc"
      ? compareValues(insertedKey, lastPageKey) >= 0
      : compareValues(insertedKey, lastPageKey) <= 0;
  if (isAfterLastPage) {
    // Only update if the last page is done loading, otherwise it will pop out
    // when the server updates the query
    if (lastLoadedPage.value.isDone) {
      localQueryStore.setQuery(paginatedQuery, lastLoadedPage.args, {
        ...lastLoadedPage.value,
        page: [...lastLoadedPage.value.page, item],
      });
    }
    return;
  }

  // if sorted in ascending order, find the first page that starts with a key greater than the inserted element,
  // and update the page before it
  // if sorted in descending order, find the first page that starts with a key less than the inserted element,
  // and update the page before it

  const successorPageIndex = sortedPages.findIndex((p) =>
    sortOrder === "asc"
      ? compareValues(sortKeyFromItem(p.value.page[0]), insertedKey) > 0
      : compareValues(sortKeyFromItem(p.value.page[0]), insertedKey) < 0,
  );
  const pageToUpdate =
    successorPageIndex === -1
      ? sortedPages[sortedPages.length - 1]
      : sortedPages[successorPageIndex - 1];
  if (pageToUpdate === undefined) {
    // no pages, so don't update until they load
    return;
  }
  // If ascending, find the first element that is greater than or equal to the inserted element
  // If descending, find the first element that is less than or equal to the inserted element
  const indexWithinPage = pageToUpdate.value.page.findIndex((e) =>
    sortOrder === "asc"
      ? compareValues(sortKeyFromItem(e), insertedKey) >= 0
      : compareValues(sortKeyFromItem(e), insertedKey) <= 0,
  );
  const newPage =
    indexWithinPage === -1
      ? [...pageToUpdate.value.page, item]
      : [
          ...pageToUpdate.value.page.slice(0, indexWithinPage),
          item,
          ...pageToUpdate.value.page.slice(indexWithinPage),
        ];
  localQueryStore.setQuery(paginatedQuery, pageToUpdate.args, {
    ...pageToUpdate.value,
    page: newPage,
  });
}
