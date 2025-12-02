/**
 * @vitest-environment custom-vitest-environment.ts
 */
import { expect, vi, test, describe, beforeEach, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import React from "react";

import {
  anyApi,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  getFunctionName,
  makeFunctionReference,
  PaginationOptions,
  PaginationResult,
} from "../server/index.js";
import { assert, Equals } from "../test/type_testing.js";
import { compareValues, convexToJson, Value } from "../values/index.js";
import { ConvexProvider, ConvexReactClient } from "./client.js";
import {
  PaginatedQueryArgs,
  resetPaginationId,
  usePaginatedQuery,
  PaginatedQueryItem,
  insertAtTop,
  insertAtPosition,
  PaginatedQueryReference,
  usePaginatedQueryInternal,
  includePage,
  page,
} from "./use_paginated_query.js";
import { OptimisticLocalStore } from "../browser/index.js";

const address = "https://127.0.0.1:3001";

type Props = { onError: (e: Error) => void; children: any };
class ErrorBoundary extends React.Component<Props> {
  state: { error: Error | undefined } = { error: undefined };
  onError: (e: Error) => void;

  constructor(props: Props) {
    super(props);
    this.onError = props.onError;
  }

  componentDidCatch(error: Error) {
    this.onError(error);
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.state.error.toString();
    }

    return this.props.children;
  }
}

test.each([
  {
    options: undefined,
    expectedError:
      "Error: `options.initialNumItems` must be a positive number. Received `undefined`.",
  },
  {
    options: {},
    expectedError:
      "Error: `options.initialNumItems` must be a positive number. Received `undefined`.",
  },
  {
    options: { initialNumItems: -1 },
    expectedError:
      "Error: `options.initialNumItems` must be a positive number. Received `-1`.",
  },
  {
    options: { initialNumItems: "wrongType" },
    expectedError:
      "Error: `options.initialNumItems` must be a positive number. Received `wrongType`.",
  },
])("Throws an error when options is $options", ({ options, expectedError }) => {
  const convexClient = new ConvexReactClient(address);
  let lastError: Error | undefined = undefined;
  function updateError(e: Error) {
    lastError = e;
  }

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ErrorBoundary onError={updateError}>
      <ConvexProvider client={convexClient}>{children}</ConvexProvider>
    </ErrorBoundary>
  );

  renderHook(
    () =>
      // @ts-expect-error We're testing user programming errors
      usePaginatedQuery(makeFunctionReference<"query">("myQuery"), {}, options),
    {
      wrapper,
    },
  );
  expect(lastError).not.toBeUndefined();
  expect(lastError!.toString()).toEqual(expectedError);
});

test("Returns nothing when args are 'skip'", () => {
  const convexClient = new ConvexReactClient(address);
  const watchQuerySpy = vi.spyOn(convexClient, "watchQuery");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConvexProvider client={convexClient}>{children}</ConvexProvider>
  );

  const { result } = renderHook(
    () =>
      usePaginatedQuery(makeFunctionReference<"query">("myQuery"), "skip", {
        initialNumItems: 10,
      }),
    { wrapper },
  );

  expect(watchQuerySpy.mock.calls).toEqual([]);
  expect(result.current).toMatchObject({
    isLoading: true,
    results: [],
    status: "LoadingFirstPage",
  });
});

test("Initially returns LoadingFirstPage", () => {
  const convexClient = new ConvexReactClient(address);
  const watchQuerySpy = vi.spyOn(convexClient, "watchQuery");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConvexProvider client={convexClient}>{children}</ConvexProvider>
  );

  const { result } = renderHook(
    () =>
      usePaginatedQuery(
        makeFunctionReference<"query">("myQuery"),
        {},
        { initialNumItems: 10 },
      ),
    { wrapper },
  );

  expect(watchQuerySpy.mock.calls[1]).toEqual([
    makeFunctionReference("myQuery"),
    {
      paginationOpts: {
        cursor: null,
        id: expect.anything(),
        numItems: 10,
      },
    },
    { journal: undefined },
  ]);
  expect(result.current).toMatchObject({
    isLoading: true,
    results: [],
    status: "LoadingFirstPage",
  });
});

test("Updates to a new query if query name or args change", () => {
  const convexClient = new ConvexReactClient(address);
  const watchQuerySpy = vi.spyOn(convexClient, "watchQuery");

  let args: [
    query: FunctionReference<"query">,
    args: Record<string, Value>,
    options: { initialNumItems: number },
  ] = [makeFunctionReference("myQuery"), {}, { initialNumItems: 10 }];
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConvexProvider client={convexClient}>{children}</ConvexProvider>
  );

  const { rerender } = renderHook(() => usePaginatedQuery(...args), {
    wrapper,
  });

  // Starts with just the initial query.
  expect(watchQuerySpy.mock.calls.length).toBe(3);
  expect(watchQuerySpy.mock.calls[1]).toEqual([
    makeFunctionReference("myQuery"),
    {
      paginationOpts: {
        cursor: null,
        id: expect.anything(),
        numItems: 10,
      },
    },
    { journal: undefined },
  ]);

  // If we change the query name, we get a new call.
  args = [
    makeFunctionReference<"query">("myQuery2"),
    {},
    { initialNumItems: 10 },
  ];
  rerender();
  expect(watchQuerySpy.mock.calls.length).toBe(6);
  expect(watchQuerySpy.mock.calls[4]).toEqual([
    makeFunctionReference("myQuery2"),
    {
      paginationOpts: {
        cursor: null,
        id: expect.anything(),
        numItems: 10,
      },
    },
    { journal: undefined },
  ]);

  // If we add an arg, it also updates.
  args = [
    makeFunctionReference("myQuery2"),
    { someArg: 123 },
    { initialNumItems: 10 },
  ];
  rerender();
  expect(watchQuerySpy.mock.calls.length).toBe(9);
  expect(watchQuerySpy.mock.calls[7]).toEqual([
    makeFunctionReference("myQuery2"),
    {
      paginationOpts: { cursor: null, id: expect.anything(), numItems: 10 },
      someArg: 123,
    },
    { journal: undefined },
  ]);

  // Updating to a new arg object that serializes the same thing doesn't increase
  // the all count.
  args = [
    makeFunctionReference("myQuery2"),
    { someArg: 123 },
    { initialNumItems: 10 },
  ];
  rerender();
  expect(watchQuerySpy.mock.calls.length).toBe(9);
});

describe("usePaginatedQuery pages", () => {
  let client: ConvexReactClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConvexProvider client={client}>{children}</ConvexProvider>
  );
  const query: FunctionReference<"query"> = makeFunctionReference("myQuery");
  const mockPage = (
    opts: PaginationOptions,
    retval: PaginationResult<unknown>,
  ) => {
    act(() => {
      // Set a query result with an optimistic update.
      // The mutation doesn't go through because the client's websocket isn't
      // connected, so the optimistic update persists.
      void client.mutation(
        anyApi.myMutation.default,
        {},
        {
          optimisticUpdate: (localStore) => {
            localStore.setQuery(
              anyApi.myQuery.default,
              {
                paginationOpts: { ...opts, id: 1 },
              },
              retval,
            );
          },
        },
      );
    });
  };

  beforeEach(() => {
    client = new ConvexReactClient(address);
    resetPaginationId();
  });

  test("loadMore", () => {
    const { result } = renderHook(
      () => usePaginatedQuery(query, {}, { initialNumItems: 1 }),
      { wrapper },
    );
    mockPage(
      {
        numItems: 1,
        cursor: null,
      },
      {
        page: ["item1"],
        continueCursor: "abc",
        isDone: false,
      },
    );
    mockPage(
      {
        numItems: 2,
        cursor: "abc",
      },
      {
        page: ["item2"],
        continueCursor: "def",
        isDone: true,
      },
    );
    expect(result.current.status).toStrictEqual("CanLoadMore");
    expect(result.current.results).toStrictEqual(["item1"]);
    act(() => {
      result.current.loadMore(2);
    });
    expect(result.current.status).toStrictEqual("Exhausted");
    expect(result.current.results).toStrictEqual(["item1", "item2"]);
  });

  test("single page updating", () => {
    const { result } = renderHook(
      () => usePaginatedQuery(query, {}, { initialNumItems: 1 }),
      { wrapper },
    );
    mockPage(
      {
        numItems: 1,
        cursor: null,
      },
      {
        page: ["item1"],
        continueCursor: "abc",
        isDone: true,
      },
    );
    expect(result.current.status).toStrictEqual("Exhausted");
    expect(result.current.results).toStrictEqual(["item1"]);
    mockPage(
      {
        numItems: 1,
        cursor: null,
      },
      {
        page: ["item2", "item3"],
        continueCursor: "def",
        isDone: true,
      },
    );
    expect(result.current.status).toStrictEqual("Exhausted");
    expect(result.current.results).toStrictEqual(["item2", "item3"]);
  });

  test("page split", () => {
    const { result } = renderHook(
      () => usePaginatedQuery(query, {}, { initialNumItems: 1 }),
      { wrapper },
    );
    mockPage(
      {
        numItems: 1,
        cursor: null,
      },
      {
        page: ["item1", "item2", "item3", "item4"],
        continueCursor: "abc",
        splitCursor: "mid",
        isDone: true,
      },
    );
    expect(result.current.status).toStrictEqual("Exhausted");
    expect(result.current.results).toStrictEqual([
      "item1",
      "item2",
      "item3",
      "item4",
    ]);
    mockPage(
      {
        numItems: 1,
        cursor: null,
        endCursor: "mid",
      },
      {
        page: ["item1S", "item2S"],
        continueCursor: "mid",
        isDone: false,
      },
    );
    mockPage(
      {
        numItems: 1,
        cursor: "mid",
        endCursor: "abc",
      },
      {
        page: ["item3S", "item4S"],
        continueCursor: "abc",
        isDone: true,
      },
    );
    expect(result.current.status).toStrictEqual("Exhausted");
    expect(result.current.results).toStrictEqual([
      "item1S",
      "item2S",
      "item3S",
      "item4S",
    ]);
  });

  describe("usePaginatedQueryInternal", () => {
    it("doesn’t expose the page keys by default", () => {
      const { result } = renderHook(
        () => usePaginatedQueryInternal(query, {}, { initialNumItems: 1 }),
        { wrapper },
      );
      mockPage(
        {
          numItems: 1,
          cursor: null,
        },
        {
          page: [{ name: "item1" }],
          continueCursor: "abc",
          isDone: true,
        },
      );
      const item = result.current.user.results[0];
      expect(page in item).to.be.false;
      expect("0" in result.current.internal.state.queries).to.be.true;
    });

    it("exposes the page keys when asked", () => {
      const { result } = renderHook(
        () =>
          usePaginatedQueryInternal(
            query,
            {},
            { initialNumItems: 1, [includePage]: true },
          ),
        { wrapper },
      );
      mockPage(
        {
          numItems: 1,
          cursor: null,
        },
        {
          page: [{ name: "item1" }],
          continueCursor: "abc",
          isDone: true,
        },
      );
      const item = result.current.user.results[0];
      expect(item[page]).to.equal("0");
    });
  });
});

describe("PaginatedQueryArgs", () => {
  test("basic", () => {
    type MyQueryFunction = FunctionReference<
      "query",
      "public",
      { paginationOpts: PaginationOptions; property: string },
      PaginationResult<string>
    >;
    type Args = PaginatedQueryArgs<MyQueryFunction>;
    type ExpectedArgs = { property: string };
    assert<Equals<Args, ExpectedArgs>>();
  });
});

describe("PaginatedQueryItem", () => {
  test("interface return type", () => {
    interface ReturnType {
      property: string;
    }
    type MyQueryFunction = FunctionReference<
      "query",
      "public",
      { paginationOpts: PaginationOptions; property: string },
      PaginationResult<ReturnType>
    >;
    type ActualReturnType = PaginatedQueryItem<MyQueryFunction>;
    assert<Equals<ActualReturnType, ReturnType>>();
  });
});

class LocalQueryStoreFake implements OptimisticLocalStore {
  queries: Record<
    string,
    Record<string, { args: Record<string, Value>; value: undefined | Value }>
  > = {};
  constructor() {
    this.queries = {};
  }
  setQuery(query: FunctionReference<"query">, args: any, value: any) {
    const queriesByName = this.queries[getFunctionName(query)] ?? {};
    this.queries[getFunctionName(query)] = queriesByName;
    const rawArgs = args ?? {};

    const serializedArgs = JSON.stringify(convexToJson(rawArgs));
    queriesByName[serializedArgs] = { args: rawArgs, value };
  }

  getAllQueries<Query extends FunctionReference<"query">>(
    query: Query,
  ): Array<{
    args: FunctionArgs<Query>;
    value: undefined | FunctionReturnType<Query>;
  }> {
    return Object.values(this.queries[getFunctionName(query)] ?? {}).map(
      (q) => ({
        args: q.args,
        value: q.value,
      }),
    );
  }

  getQuery(query: FunctionReference<"query">, args: any) {
    const serializedArgs = JSON.stringify(convexToJson(args));
    return this.queries[getFunctionName(query)]?.[serializedArgs];
  }
}

function getPaginatedQueryResults<
  Query extends PaginatedQueryReference,
>(options: {
  localQueryStore: LocalQueryStoreFake;
  query: Query;
  argsToMatch?: Partial<PaginatedQueryArgs<Query>>;
}) {
  const { localQueryStore, query, argsToMatch } = options;
  const allQueries = localQueryStore.getAllQueries(query);
  const relevantQueries = allQueries.filter((q) =>
    argsMatch({ args: q.args, argsToMatch }),
  );
  const loadedQueries: Array<{
    args: FunctionArgs<Query>;
    value: FunctionReturnType<Query>;
  }> = [];
  for (const query of relevantQueries) {
    expect(query.value).toBeDefined();
    loadedQueries.push({ args: query.args, value: query.value! });
  }
  const firstPage = loadedQueries.find(
    (q) => q.args.paginationOpts.cursor === null,
  );
  if (!firstPage) {
    return [];
  }
  const sortedResults = [...firstPage.value.page];
  let currentCursor = firstPage.value.continueCursor;
  while (currentCursor !== null) {
    const nextPage = loadedQueries.find(
      (r) => r.args.paginationOpts.cursor === currentCursor,
    );
    if (nextPage === undefined) {
      break;
    }
    sortedResults.push(...nextPage.value.page);
    if (nextPage.value.isDone) {
      break;
    }
    currentCursor = nextPage.value.continueCursor;
  }
  return sortedResults;
}

function argsMatch<Query extends PaginatedQueryReference>(options: {
  args: FunctionArgs<Query>;
  argsToMatch?: Partial<PaginatedQueryArgs<Query>> | undefined;
}) {
  if (options.argsToMatch === undefined) {
    return true;
  }
  return Object.keys(options.argsToMatch).every((key) => {
    // @ts-expect-error xcxc
    return compareValues(options.args[key], options.argsToMatch[key]) === 0;
  });
}
function setupPages<Query extends PaginatedQueryReference>(options: {
  localQueryStore: LocalQueryStoreFake;
  paginatedQuery: Query;
  args: PaginatedQueryArgs<Query>;
  pages: Array<Array<PaginatedQueryItem<Query>>>;
  isDone: boolean;
}) {
  let currentCursor = null;
  for (let i = 0; i < options.pages.length; i++) {
    const page = options.pages[i];
    const nextCursor = `cursor${i}`;
    options.localQueryStore.setQuery(
      options.paginatedQuery,
      {
        ...options.args,
        paginationOpts: {
          cursor: currentCursor,
          id: JSON.stringify(options.args),
          numItems: 10,
        },
      },
      {
        page,
        continueCursor: nextCursor,
        isDone: i === options.pages.length - 1 ? options.isDone : false,
      },
    );
    currentCursor = nextCursor;
  }
}

describe("insertAtTop", () => {
  test("does not insert if the query is not loaded", () => {
    const localQueryStore = new LocalQueryStoreFake();
    const paginatedQuery = anyApi.messages.list;

    insertAtTop({
      paginatedQuery,
      localQueryStore,
      item: { author: "Sarah", content: "Hello, world!" },
    });
    expect(localQueryStore.getAllQueries(paginatedQuery).length).toBe(0);
  });

  test("inserts at top", () => {
    const localQueryStore = new LocalQueryStoreFake();
    const paginatedQuery: FunctionReference<
      "query",
      "public",
      { paginationOpts: PaginationOptions },
      PaginationResult<{ author: string; content: string }>
    > = anyApi.messages.list;
    setupPages({
      localQueryStore,
      paginatedQuery,
      args: {},
      pages: [
        [
          { author: "Alice", content: "Hello, world!" },
          { author: "Bob", content: "Hello, world!" },
        ],
      ],
      isDone: false,
    });

    insertAtTop({
      paginatedQuery,
      localQueryStore,
      item: { author: "Sarah", content: "Hello, world!" },
    });
    const sortedResults = getPaginatedQueryResults({
      localQueryStore,
      query: paginatedQuery,
    });
    expect(sortedResults).toEqual([
      { author: "Sarah", content: "Hello, world!" },
      { author: "Alice", content: "Hello, world!" },
      { author: "Bob", content: "Hello, world!" },
    ]);
  });

  test("inserts at top multiple pages", () => {
    const localQueryStore = new LocalQueryStoreFake();
    const paginatedQuery = anyApi.messages.list;
    setupPages({
      localQueryStore,
      paginatedQuery,
      args: {},
      pages: [
        [
          { author: "Alice", content: "Hello, world!" },
          { author: "Bob", content: "Hello, world!" },
        ],
        [
          { author: "Charlie", content: "Hello, world!" },
          { author: "Dave", content: "Hello, world!" },
        ],
      ],
      isDone: false,
    });
    insertAtTop({
      paginatedQuery,
      localQueryStore,
      item: { author: "Sarah", content: "Hello, world!" },
    });
    const sortedResults = getPaginatedQueryResults({
      localQueryStore,
      query: paginatedQuery,
    });
    expect(sortedResults).toEqual([
      { author: "Sarah", content: "Hello, world!" },
      { author: "Alice", content: "Hello, world!" },
      { author: "Bob", content: "Hello, world!" },
      { author: "Charlie", content: "Hello, world!" },
      { author: "Dave", content: "Hello, world!" },
    ]);
  });

  test("respects filters", () => {
    const localQueryStore = new LocalQueryStoreFake();
    const paginatedQuery = anyApi.messages.list;
    setupPages({
      localQueryStore,
      paginatedQuery,
      args: { channel: "general" },
      pages: [
        [
          { author: "Alice", content: "Hello, world!" },
          { author: "Bob", content: "Hello, world!" },
        ],
      ],
      isDone: false,
    });
    setupPages({
      localQueryStore,
      paginatedQuery,
      args: { channel: "marketing" },
      pages: [
        [
          { author: "Charlie", content: "Hello, world!" },
          { author: "Dave", content: "Hello, world!" },
        ],
      ],
      isDone: false,
    });

    insertAtTop({
      paginatedQuery,
      localQueryStore,
      argsToMatch: { channel: "general" },
      item: { author: "Sarah", content: "Hello, world!" },
    });

    const sortedResults = getPaginatedQueryResults({
      localQueryStore,
      query: paginatedQuery,
      argsToMatch: { channel: "general" },
    });
    expect(sortedResults).toEqual([
      { author: "Sarah", content: "Hello, world!" },
      { author: "Alice", content: "Hello, world!" },
      { author: "Bob", content: "Hello, world!" },
    ]);
  });
});

describe("insertAtPosition", () => {
  const defaultPages = [
    [
      { author: "Dave", rank: 40 },
      { author: "Charlie", rank: 30 },
    ],
    [
      { author: "Bob", rank: 20 },
      { author: "Alice", rank: 10 },
    ],
  ];

  describe("descending", () => {
    test("inserts in middle", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 15 },
        sortOrder: "desc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Dave", rank: 40 },
        { author: "Charlie", rank: 30 },
        { author: "Bob", rank: 20 },
        { author: "Sarah", rank: 15 },
        { author: "Alice", rank: 10 },
      ]);
    });

    test("inserts at top", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 55 },
        sortOrder: "desc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Sarah", rank: 55 },
        { author: "Dave", rank: 40 },
        { author: "Charlie", rank: 30 },
        { author: "Bob", rank: 20 },
        { author: "Alice", rank: 10 },
      ]);
    });

    test("inserts at bottom if list is done", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: true,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 5 },
        sortOrder: "desc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Dave", rank: 40 },
        { author: "Charlie", rank: 30 },
        { author: "Bob", rank: 20 },
        { author: "Alice", rank: 10 },
        { author: "Sarah", rank: 5 },
      ]);
    });

    test("does not insert at bottom if list is still loading", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 5 },
        sortOrder: "desc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Dave", rank: 40 },
        { author: "Charlie", rank: 30 },
        { author: "Bob", rank: 20 },
        { author: "Alice", rank: 10 },
      ]);
    });

    test("inserts on page boundary", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 29 },
        sortOrder: "desc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Dave", rank: 40 },
        { author: "Charlie", rank: 30 },
        { author: "Sarah", rank: 29 },
        { author: "Bob", rank: 20 },
        { author: "Alice", rank: 10 },
      ]);
    });
  });

  describe("ascending", () => {
    const defaultPages = [
      [
        { author: "Alice", rank: 10 },
        { author: "Bob", rank: 20 },
      ],
      [
        { author: "Charlie", rank: 30 },
        { author: "Dave", rank: 40 },
      ],
    ];
    test("inserts in middle", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 15 },
        sortOrder: "asc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Alice", rank: 10 },
        { author: "Sarah", rank: 15 },
        { author: "Bob", rank: 20 },
        { author: "Charlie", rank: 30 },
        { author: "Dave", rank: 40 },
      ]);
    });

    test("inserts at top", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 5 },
        sortOrder: "asc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Sarah", rank: 5 },
        { author: "Alice", rank: 10 },
        { author: "Bob", rank: 20 },
        { author: "Charlie", rank: 30 },
        { author: "Dave", rank: 40 },
      ]);
    });

    test("inserts at bottom if list is done", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: true,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 50 },
        sortOrder: "asc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Alice", rank: 10 },
        { author: "Bob", rank: 20 },
        { author: "Charlie", rank: 30 },
        { author: "Dave", rank: 40 },
        { author: "Sarah", rank: 50 },
      ]);
    });

    test("does not insert at bottom if list is still loading", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 50 },
        sortOrder: "asc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Alice", rank: 10 },
        { author: "Bob", rank: 20 },
        { author: "Charlie", rank: 30 },
        { author: "Dave", rank: 40 },
      ]);
    });

    test("inserts on page boundary", () => {
      const localQueryStore = new LocalQueryStoreFake();
      const paginatedQuery = anyApi.messages.list;
      setupPages({
        localQueryStore,
        paginatedQuery,
        args: {},
        pages: defaultPages,
        isDone: false,
      });
      insertAtPosition({
        paginatedQuery,
        localQueryStore,
        item: { author: "Sarah", rank: 21 },
        sortOrder: "asc",
        sortKeyFromItem: (item) => item.rank,
      });
      const sortedResults = getPaginatedQueryResults({
        localQueryStore,
        query: paginatedQuery,
      });
      expect(sortedResults).toEqual([
        { author: "Alice", rank: 10 },
        { author: "Bob", rank: 20 },
        { author: "Sarah", rank: 21 },
        { author: "Charlie", rank: 30 },
        { author: "Dave", rank: 40 },
      ]);
    });
  });
});
