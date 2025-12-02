/**
 * @vitest-environment custom-vitest-environment.ts
 */

import { RequestForQueries, useQueriesHelper } from "./use_queries.js";
import { test, expect, vi } from "vitest";
import FakeWatch from "../test/fake_watch.js";
import { act, renderHook } from "@testing-library/react";
import { FunctionReference, anyApi, getFunctionName } from "../server/api.js";

test("Adding a new query", () => {
  const values: Record<string, unknown> = {};
  const createWatch = vi.fn((query: FunctionReference<"query">) => {
    const watch = new FakeWatch<any>();
    watch.value = values[getFunctionName(query)];
    return watch;
  }) as any;

  // Request 1 query.
  let queries: RequestForQueries = {
    query1: {
      query: anyApi.query1.default,
      args: {},
    },
  };
  const { result, rerender } = renderHook(() =>
    useQueriesHelper(queries, createWatch),
  );

  // Initially the query is loading (undefined).
  expect(result.current).toStrictEqual({
    query1: undefined,
  });
  expect(createWatch.mock.calls.length).toBe(3);

  // When the query loads, we get the result.
  act(() => {
    values.query1 = "query1 result";
    createWatch.mock.results[1].value.setValue("query1 result");
  });
  expect(result.current).toStrictEqual({
    query1: "query1 result",
  });

  // Add a second query, it's initially loading.
  queries = {
    query1: {
      query: anyApi.query1.default,
      args: {},
    },
    query2: {
      query: anyApi.query2.default,
      args: {},
    },
  };
  rerender();
  expect(result.current).toStrictEqual({
    query1: "query1 result",
    query2: undefined,
  });
  expect(createWatch.mock.calls.length).toBe(9);

  // When the query resolves, we also get the result.
  act(() => {
    values.query2 = "query2 result";
    createWatch.mock.results[6].value.setValue("query2 result");
  });
  expect(result.current).toStrictEqual({
    query1: "query1 result",
    query2: "query2 result",
  });
});

test("Swapping queries and unsubscribing", () => {
  const createWatch = vi.fn(() => new FakeWatch<any>()) as any;

  // Request 1 query.
  let queries: RequestForQueries = {
    query: {
      query: anyApi.query1.default,
      args: {},
    },
  };
  const { rerender, unmount } = renderHook(() =>
    useQueriesHelper(queries, createWatch),
  );

  // One watch was created and we're listening to it.
  expect(createWatch.mock.calls.length).toBe(3);
  expect(createWatch.mock.results[1].value.numCallbacks()).toBe(1);

  // Switch to a different query.
  queries = {
    query1: {
      query: anyApi.query2.default,
      args: {},
    },
  };
  rerender();

  // Now 2 different watches have been created and we're only listening to the second.
  expect(createWatch.mock.calls.length).toBe(6);
  expect(createWatch.mock.results[1].value.numCallbacks()).toBe(0);
  expect(createWatch.mock.results[4].value.numCallbacks()).toBe(1);

  // After unmount, we've unsubscribed to all the queries.
  unmount();
  expect(createWatch.mock.calls.length).toBe(6);
  expect(createWatch.mock.results[1].value.numCallbacks()).toBe(0);
  expect(createWatch.mock.results[4].value.numCallbacks()).toBe(0);
});

test("Local results on initial render", () => {
  const value: string | undefined = "query1 result";
  const createWatch = vi.fn(() => {
    const watch = new FakeWatch<any>();
    watch.value = value;
    return watch;
  }) as any;

  // Request 1 query.
  const queries: RequestForQueries = {
    query1: {
      query: anyApi.query1.default,
      args: {},
    },
  };
  const { result } = renderHook(() => {
    const result = useQueriesHelper(queries, createWatch);
    // This is the important part of this test! We check that
    // we immediately render the new value:
    expect(result.query1).toEqual(value);
    return result;
  });

  expect(result.current).toStrictEqual({
    query1: "query1 result",
  });
  expect(createWatch.mock.calls.length).toBe(3);
});
