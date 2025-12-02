"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var use_paginated_query_exports = {};
__export(use_paginated_query_exports, {
  includePage: () => includePage,
  insertAtBottomIfLoaded: () => insertAtBottomIfLoaded,
  insertAtPosition: () => insertAtPosition,
  insertAtTop: () => insertAtTop,
  optimisticallyUpdateValueInPaginatedQuery: () => optimisticallyUpdateValueInPaginatedQuery,
  page: () => page,
  resetPaginationId: () => resetPaginationId,
  usePaginatedQuery: () => usePaginatedQuery,
  usePaginatedQueryInternal: () => usePaginatedQueryInternal
});
module.exports = __toCommonJS(use_paginated_query_exports);
var import_react = require("react");
var import_values = require("../values/index.js");
var import_use_queries = require("./use_queries.js");
var import_api = require("../server/api.js");
var import_client = require("./client.js");
var import_compare = require("../values/compare.js");
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
function usePaginatedQuery(query, args, options) {
  const { user } = usePaginatedQueryInternal(query, args, options);
  return user;
}
const includePage = Symbol("includePageKeys");
const page = Symbol("page");
function usePaginatedQueryInternal(query, args, options) {
  if (typeof options?.initialNumItems !== "number" || options.initialNumItems < 0) {
    throw new Error(
      `\`options.initialNumItems\` must be a positive number. Received \`${options?.initialNumItems}\`.`
    );
  }
  const skip = args === "skip";
  const argsObject = skip ? {} : args;
  const queryName = (0, import_api.getFunctionName)(query);
  const createInitialState = (0, import_react.useMemo)(() => {
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
    JSON.stringify((0, import_values.convexToJson)(argsObject)),
    queryName,
    options.initialNumItems,
    skip
  ]);
  const [state, setState] = (0, import_react.useState)(createInitialState);
  let currState = state;
  if ((0, import_api.getFunctionName)(query) !== (0, import_api.getFunctionName)(state.query) || JSON.stringify((0, import_values.convexToJson)(argsObject)) !== JSON.stringify((0, import_values.convexToJson)(state.args)) || skip !== state.skip) {
    currState = createInitialState();
    setState(currState);
  }
  const convexClient = (0, import_client.useConvex)();
  const logger = convexClient.logger;
  const resultsObject = (0, import_use_queries.useQueries)(currState.queries);
  const isIncludingPageKeys = options[includePage] ?? false;
  const [results, maybeLastResult] = (0, import_react.useMemo)(() => {
    let currResult = void 0;
    const allItems = [];
    for (const pageKey of currState.pageKeys) {
      currResult = resultsObject[pageKey];
      if (currResult === void 0) {
        break;
      }
      if (currResult instanceof Error) {
        if (currResult.message.includes("InvalidCursor") || currResult instanceof import_values.ConvexError && typeof currResult.data === "object" && currResult.data?.isConvexSystemError === true && currResult.data?.paginationError === "InvalidCursor") {
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
  const statusObject = (0, import_react.useMemo)(() => {
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
function resetPaginationId() {
  paginationId = 0;
}
function optimisticallyUpdateValueInPaginatedQuery(localStore, query, args, updateValue) {
  const expectedArgs = JSON.stringify((0, import_values.convexToJson)(args));
  for (const queryResult of localStore.getAllQueries(query)) {
    if (queryResult.value !== void 0) {
      const { paginationOpts: _, ...innerArgs } = queryResult.args;
      if (JSON.stringify((0, import_values.convexToJson)(innerArgs)) === expectedArgs) {
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
function insertAtTop(options) {
  const { paginatedQuery, argsToMatch, localQueryStore, item } = options;
  const queries = localQueryStore.getAllQueries(paginatedQuery);
  const queriesThatMatch = queries.filter((q) => {
    if (argsToMatch === void 0) {
      return true;
    }
    return Object.keys(argsToMatch).every(
      // @ts-expect-error -- This should be safe since both should be plain objects
      (k) => (0, import_compare.compareValues)(argsToMatch[k], q.args[k]) === 0
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
function insertAtBottomIfLoaded(options) {
  const { paginatedQuery, localQueryStore, item, argsToMatch } = options;
  const queries = localQueryStore.getAllQueries(paginatedQuery);
  const queriesThatMatch = queries.filter((q) => {
    if (argsToMatch === void 0) {
      return true;
    }
    return Object.keys(argsToMatch).every(
      // @ts-expect-error -- This should be safe since both should be plain objects
      (k) => (0, import_compare.compareValues)(argsToMatch[k], q.args[k]) === 0
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
function insertAtPosition(options) {
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
      return (0, import_compare.compareValues)(aKey, bKey);
    } else {
      return (0, import_compare.compareValues)(bKey, aKey);
    }
  });
  const firstLoadedPage = sortedPages[0];
  if (firstLoadedPage === void 0) {
    return;
  }
  const firstPageKey = sortKeyFromItem(firstLoadedPage.value.page[0]);
  const isBeforeFirstPage = sortOrder === "asc" ? (0, import_compare.compareValues)(insertedKey, firstPageKey) <= 0 : (0, import_compare.compareValues)(insertedKey, firstPageKey) >= 0;
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
  const isAfterLastPage = sortOrder === "asc" ? (0, import_compare.compareValues)(insertedKey, lastPageKey) >= 0 : (0, import_compare.compareValues)(insertedKey, lastPageKey) <= 0;
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
    (p) => sortOrder === "asc" ? (0, import_compare.compareValues)(sortKeyFromItem(p.value.page[0]), insertedKey) > 0 : (0, import_compare.compareValues)(sortKeyFromItem(p.value.page[0]), insertedKey) < 0
  );
  const pageToUpdate = successorPageIndex === -1 ? sortedPages[sortedPages.length - 1] : sortedPages[successorPageIndex - 1];
  if (pageToUpdate === void 0) {
    return;
  }
  const indexWithinPage = pageToUpdate.value.page.findIndex(
    (e) => sortOrder === "asc" ? (0, import_compare.compareValues)(sortKeyFromItem(e), insertedKey) >= 0 : (0, import_compare.compareValues)(sortKeyFromItem(e), insertedKey) <= 0
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
