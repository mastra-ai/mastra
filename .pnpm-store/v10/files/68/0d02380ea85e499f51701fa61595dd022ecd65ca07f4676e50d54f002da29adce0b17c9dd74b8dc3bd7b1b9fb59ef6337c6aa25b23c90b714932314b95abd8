"use strict";
import { useMemo, useState } from "react";
import { ConvexError, convexToJson } from "../values/index.js";
import { useQueries } from "./use_queries.js";
import {
  getFunctionName
} from "../server/api.js";
import { useConvex } from "./client.js";
import { compareValues } from "../values/compare.js";
const splitQuery = (key, splitCursor, continueCursor) => (prevState) => {
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
        endCursor: splitCursor
      }
    }
  };
  queries[splitKey2] = {
    query: prevState.query,
    args: {
      ...prevState.args,
      paginationOpts: {
        ...prevState.queries[key].args.paginationOpts,
        cursor: splitCursor,
        endCursor: continueCursor
      }
    }
  };
  const ongoingSplits = { ...prevState.ongoingSplits };
  ongoingSplits[key] = [splitKey1, splitKey2];
  return {
    ...prevState,
    nextPageKey,
    queries,
    ongoingSplits
  };
};
const completeSplitQuery = (key) => (prevState) => {
  const completedSplit = prevState.ongoingSplits[key];
  if (completedSplit === void 0) {
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
      ...prevState.pageKeys.slice(pageIndex + 1)
    ];
  }
  return {
    ...prevState,
    queries,
    pageKeys,
    ongoingSplits
  };
};
export function usePaginatedQuery(query, args, options) {
  const { user } = usePaginatedQueryInternal(query, args, options);
  return user;
}
export const includePage = Symbol("includePageKeys");
export const page = Symbol("page");
export function usePaginatedQueryInternal(query, args, options) {
  if (typeof options?.initialNumItems !== "number" || options.initialNumItems < 0) {
    throw new Error(
      `\`options.initialNumItems\` must be a positive number. Received \`${options?.initialNumItems}\`.`
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
        args: argsObject,
        id,
        nextPageKey: 1,
        pageKeys: skip ? [] : [0],
        queries: skip ? {} : {
          0: {
            query,
            args: {
              ...argsObject,
              paginationOpts: {
                numItems: options.initialNumItems,
                cursor: null,
                id
              }
            }
          }
        },
        ongoingSplits: {},
        skip
      };
    };
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(convexToJson(argsObject)),
    queryName,
    options.initialNumItems,
    skip
  ]);
  const [state, setState] = useState(createInitialState);
  let currState = state;
  if (getFunctionName(query) !== getFunctionName(state.query) || JSON.stringify(convexToJson(argsObject)) !== JSON.stringify(convexToJson(state.args)) || skip !== state.skip) {
    currState = createInitialState();
    setState(currState);
  }
  const convexClient = useConvex();
  const logger = convexClient.logger;
  const resultsObject = useQueries(currState.queries);
  const isIncludingPageKeys = options[includePage] ?? false;
  const [results, maybeLastResult] = useMemo(() => {
    let currResult = void 0;
    const allItems = [];
    for (const pageKey of currState.pageKeys) {
      currResult = resultsObject[pageKey];
      if (currResult === void 0) {
        break;
      }
      if (currResult instanceof Error) {
        if (currResult.message.includes("InvalidCursor") || currResult instanceof ConvexError && typeof currResult.data === "object" && currResult.data?.isConvexSystemError === true && currResult.data?.paginationError === "InvalidCursor") {
          logger.warn(
            "usePaginatedQuery hit error, resetting pagination state: " + currResult.message
          );
          setState(createInitialState);
          return [[], void 0];
        } else {
          throw currResult;
        }
      }
      const ongoingSplit = currState.ongoingSplits[pageKey];
      if (ongoingSplit !== void 0) {
        if (resultsObject[ongoingSplit[0]] !== void 0 && resultsObject[ongoingSplit[1]] !== void 0) {
          setState(completeSplitQuery(pageKey));
        }
      } else if (currResult.splitCursor && (currResult.pageStatus === "SplitRecommended" || currResult.pageStatus === "SplitRequired" || currResult.page.length > options.initialNumItems * 2)) {
        setState(
          splitQuery(
            pageKey,
            currResult.splitCursor,
            currResult.continueCursor
          )
        );
      }
      if (currResult.pageStatus === "SplitRequired") {
        return [allItems, void 0];
      }
      allItems.push(
        ...isIncludingPageKeys ? currResult.page.map((i) => ({
          ...i,
          [page]: pageKey.toString()
        })) : currResult.page
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
    isIncludingPageKeys
  ]);
  const statusObject = useMemo(() => {
    if (maybeLastResult === void 0) {
      if (currState.nextPageKey === 1) {
        return {
          status: "LoadingFirstPage",
          isLoading: true,
          loadMore: (_numItems) => {
          }
        };
      } else {
        return {
          status: "LoadingMore",
          isLoading: true,
          loadMore: (_numItems) => {
          }
        };
      }
    }
    if (maybeLastResult.isDone) {
      return {
        status: "Exhausted",
        isLoading: false,
        loadMore: (_numItems) => {
        }
      };
    }
    const continueCursor = maybeLastResult.continueCursor;
    let alreadyLoadingMore = false;
    return {
      status: "CanLoadMore",
      isLoading: false,
      loadMore: (numItems) => {
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
                  id: prevState.id
                }
              }
            };
            return {
              ...prevState,
              nextPageKey: prevState.nextPageKey + 1,
              pageKeys,
              queries
            };
          });
        }
      }
    };
  }, [maybeLastResult, currState.nextPageKey]);
  return {
    user: {
      results,
      ...statusObject
    },
    internal: { state: currState }
  };
}
let paginationId = 0;
function nextPaginationId() {
  paginationId++;
  return paginationId;
}
export function resetPaginationId() {
  paginationId = 0;
}
export function optimisticallyUpdateValueInPaginatedQuery(localStore, query, args, updateValue) {
  const expectedArgs = JSON.stringify(convexToJson(args));
  for (const queryResult of localStore.getAllQueries(query)) {
    if (queryResult.value !== void 0) {
      const { paginationOpts: _, ...innerArgs } = queryResult.args;
      if (JSON.stringify(convexToJson(innerArgs)) === expectedArgs) {
        const value = queryResult.value;
        if (typeof value === "object" && value !== null && Array.isArray(value.page)) {
          localStore.setQuery(query, queryResult.args, {
            ...value,
            page: value.page.map(updateValue)
          });
        }
      }
    }
  }
}
export function insertAtTop(options) {
  const { paginatedQuery, argsToMatch, localQueryStore, item } = options;
  const queries = localQueryStore.getAllQueries(paginatedQuery);
  const queriesThatMatch = queries.filter((q) => {
    if (argsToMatch === void 0) {
      return true;
    }
    return Object.keys(argsToMatch).every(
      // @ts-expect-error -- This should be safe since both should be plain objects
      (k) => compareValues(argsToMatch[k], q.args[k]) === 0
    );
  });
  const firstPage = queriesThatMatch.find(
    (q) => q.args.paginationOpts.cursor === null
  );
  if (firstPage === void 0 || firstPage.value === void 0) {
    return;
  }
  localQueryStore.setQuery(paginatedQuery, firstPage.args, {
    ...firstPage.value,
    page: [item, ...firstPage.value.page]
  });
}
export function insertAtBottomIfLoaded(options) {
  const { paginatedQuery, localQueryStore, item, argsToMatch } = options;
  const queries = localQueryStore.getAllQueries(paginatedQuery);
  const queriesThatMatch = queries.filter((q) => {
    if (argsToMatch === void 0) {
      return true;
    }
    return Object.keys(argsToMatch).every(
      // @ts-expect-error -- This should be safe since both should be plain objects
      (k) => compareValues(argsToMatch[k], q.args[k]) === 0
    );
  });
  const lastPage = queriesThatMatch.find(
    (q) => q.value !== void 0 && q.value.isDone
  );
  if (lastPage === void 0) {
    return;
  }
  localQueryStore.setQuery(paginatedQuery, lastPage.args, {
    ...lastPage.value,
    page: [...lastPage.value.page, item]
  });
}
export function insertAtPosition(options) {
  const {
    paginatedQuery,
    sortOrder,
    sortKeyFromItem,
    localQueryStore,
    item,
    argsToMatch
  } = options;
  const queries = localQueryStore.getAllQueries(paginatedQuery);
  const queryGroups = {};
  for (const query of queries) {
    if (argsToMatch !== void 0 && !Object.keys(argsToMatch).every(
      (k) => (
        // @ts-ignore why is this not working?
        argsToMatch[k] === query.args[k]
      )
    )) {
      continue;
    }
    const key = JSON.stringify(
      Object.fromEntries(
        Object.entries(query.args).map(([k, v]) => [
          k,
          k === "paginationOpts" ? v.id : v
        ])
      )
    );
    queryGroups[key] ?? (queryGroups[key] = []);
    queryGroups[key].push(query);
  }
  for (const pageQueries of Object.values(queryGroups)) {
    insertAtPositionInPages({
      pageQueries,
      paginatedQuery,
      sortOrder,
      sortKeyFromItem,
      localQueryStore,
      item
    });
  }
}
function insertAtPositionInPages(options) {
  const {
    pageQueries,
    sortOrder,
    sortKeyFromItem,
    localQueryStore,
    item,
    paginatedQuery
  } = options;
  const insertedKey = sortKeyFromItem(item);
  const loadedPages = pageQueries.filter(
    (q) => q.value !== void 0 && q.value.page.length > 0
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
  const firstLoadedPage = sortedPages[0];
  if (firstLoadedPage === void 0) {
    return;
  }
  const firstPageKey = sortKeyFromItem(firstLoadedPage.value.page[0]);
  const isBeforeFirstPage = sortOrder === "asc" ? compareValues(insertedKey, firstPageKey) <= 0 : compareValues(insertedKey, firstPageKey) >= 0;
  if (isBeforeFirstPage) {
    if (firstLoadedPage.args.paginationOpts.cursor === null) {
      localQueryStore.setQuery(paginatedQuery, firstLoadedPage.args, {
        ...firstLoadedPage.value,
        page: [item, ...firstLoadedPage.value.page]
      });
    } else {
      return;
    }
    return;
  }
  const lastLoadedPage = sortedPages[sortedPages.length - 1];
  if (lastLoadedPage === void 0) {
    return;
  }
  const lastPageKey = sortKeyFromItem(
    lastLoadedPage.value.page[lastLoadedPage.value.page.length - 1]
  );
  const isAfterLastPage = sortOrder === "asc" ? compareValues(insertedKey, lastPageKey) >= 0 : compareValues(insertedKey, lastPageKey) <= 0;
  if (isAfterLastPage) {
    if (lastLoadedPage.value.isDone) {
      localQueryStore.setQuery(paginatedQuery, lastLoadedPage.args, {
        ...lastLoadedPage.value,
        page: [...lastLoadedPage.value.page, item]
      });
    }
    return;
  }
  const successorPageIndex = sortedPages.findIndex(
    (p) => sortOrder === "asc" ? compareValues(sortKeyFromItem(p.value.page[0]), insertedKey) > 0 : compareValues(sortKeyFromItem(p.value.page[0]), insertedKey) < 0
  );
  const pageToUpdate = successorPageIndex === -1 ? sortedPages[sortedPages.length - 1] : sortedPages[successorPageIndex - 1];
  if (pageToUpdate === void 0) {
    return;
  }
  const indexWithinPage = pageToUpdate.value.page.findIndex(
    (e) => sortOrder === "asc" ? compareValues(sortKeyFromItem(e), insertedKey) >= 0 : compareValues(sortKeyFromItem(e), insertedKey) <= 0
  );
  const newPage = indexWithinPage === -1 ? [...pageToUpdate.value.page, item] : [
    ...pageToUpdate.value.page.slice(0, indexWithinPage),
    item,
    ...pageToUpdate.value.page.slice(indexWithinPage)
  ];
  localQueryStore.setQuery(paginatedQuery, pageToUpdate.args, {
    ...pageToUpdate.value,
    page: newPage
  });
}
//# sourceMappingURL=use_paginated_query.js.map
