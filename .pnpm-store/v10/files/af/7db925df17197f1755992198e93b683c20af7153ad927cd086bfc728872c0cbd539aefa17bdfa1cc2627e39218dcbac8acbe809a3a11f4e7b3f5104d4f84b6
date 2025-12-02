import { Value } from "../../values/index.js";
import { test, expect, beforeEach } from "vitest";

import {
  OptimisticQueryResults,
  QueryResultsMap,
} from "./optimistic_updates_impl.js";
import { serializePathAndArgs } from "./udf_path_utils.js";
import { FunctionResult } from "./function_result.js";
import { anyApi } from "../../server/api.js";

let optimisticQuerySet: OptimisticQueryResults;
beforeEach(() => {
  optimisticQuerySet = new OptimisticQueryResults();
});

function success(value: Value): FunctionResult {
  return { success: true, value, logLines: [] };
}

test("server results are returned back if no optimistic updates exist", () => {
  const queryToken1 = serializePathAndArgs("query1", {});
  const queryToken2 = serializePathAndArgs("query2", {});
  const queryResults: QueryResultsMap = new Map([
    [
      queryToken1,
      {
        result: success("query1 result"),
        udfPath: "query1",
        args: {},
      },
    ],
    [
      queryToken2,
      {
        result: success("query2 result"),
        udfPath: "query2",
        args: {},
      },
    ],
  ]);
  const changedQueries = optimisticQuerySet.ingestQueryResultsFromServer(
    queryResults,
    new Set(),
  );

  expect(changedQueries).toEqual([queryToken1, queryToken2]);
  expect(optimisticQuerySet.queryResult(queryToken1)).toEqual("query1 result");
  expect(optimisticQuerySet.queryResult(queryToken2)).toEqual("query2 result");
});

test("errors are thrown if we receive an error from the server", () => {
  const queryToken = serializePathAndArgs("query", {});
  const serverQueryResults: QueryResultsMap = new Map([
    [
      queryToken,
      {
        result: {
          success: false,
          errorMessage: "Server Error",
          logLines: [],
        },
        udfPath: "query",
        args: {},
      },
    ],
  ]);
  const changedQueries = optimisticQuerySet.ingestQueryResultsFromServer(
    serverQueryResults,
    new Set(),
  );
  expect(changedQueries).toEqual([queryToken]);
  expect(() => optimisticQuerySet.queryResult(queryToken)).toThrow(
    "[CONVEX Q(query)] Server Error",
  );
});

test("optimistic updates edit query results", () => {
  const queryToken = serializePathAndArgs("query", {});
  function createQueryResults(value: number): QueryResultsMap {
    return new Map([
      [
        queryToken,
        {
          result: success(value),
          udfPath: "query",
          args: {},
        },
      ],
    ]);
  }

  // Add a query to our store
  const changedQueries = optimisticQuerySet.ingestQueryResultsFromServer(
    createQueryResults(100),
    new Set(),
  );
  expect(changedQueries).toEqual([queryToken]);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(100);

  // Edit the query with an optimistic update and confirm it ran.
  const changedQueries2 = optimisticQuerySet.applyOptimisticUpdate(
    (localStore) => {
      const oldResult = localStore.getQuery(anyApi.query.default, {});
      localStore.setQuery(anyApi.query.default, {}, oldResult + 1);
    },
    0,
  );
  expect(changedQueries2).toEqual([queryToken]);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(101);

  // If we receive a new query result while the update is in place, the update is
  // replayed on top.
  const changedQueries3 = optimisticQuerySet.ingestQueryResultsFromServer(
    createQueryResults(200),
    new Set(),
  );
  expect(changedQueries3).toEqual([queryToken]);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(201);

  // The update can be dropped
  const changedQueries4 = optimisticQuerySet.ingestQueryResultsFromServer(
    createQueryResults(300),
    new Set([0]),
  );
  expect(changedQueries4).toEqual([queryToken]);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(300);
});

test("optimistic updates only notify changed queries", () => {
  // Set up 2 queries
  const queryToken1 = serializePathAndArgs("query1", {});
  const queryToken2 = serializePathAndArgs("query2", {});
  const queryResults: QueryResultsMap = new Map([
    [
      queryToken1,
      {
        result: success("query1 result"),
        udfPath: "query1",
        args: {},
      },
    ],
    [
      queryToken2,
      {
        result: success("query2 result"),
        udfPath: "query2",
        args: {},
      },
    ],
  ]);
  const changedQueries = optimisticQuerySet.ingestQueryResultsFromServer(
    queryResults,
    new Set(),
  );
  // Confirm they were both added
  expect(changedQueries).toEqual([queryToken1, queryToken2]);
  expect(optimisticQuerySet.queryResult(queryToken1)).toEqual("query1 result");
  expect(optimisticQuerySet.queryResult(queryToken2)).toEqual("query2 result");

  // Update the first query
  const changedQueries2 = optimisticQuerySet.applyOptimisticUpdate(
    (localStore) => {
      localStore.setQuery(anyApi.query1.default, {}, "new query1 result");
    },
    0,
  );

  // Only the first query changed
  expect(changedQueries2).toEqual([queryToken1]);
  expect(optimisticQuerySet.queryResult(queryToken1)).toEqual(
    "new query1 result",
  );
  expect(optimisticQuerySet.queryResult(queryToken2)).toEqual("query2 result");
});

test("optimistic updates stack", () => {
  // Start our server query value at 2.
  const queryToken = serializePathAndArgs("query", {});
  const serverQueryResults: QueryResultsMap = new Map([
    [
      queryToken,
      {
        result: success(2),
        udfPath: "query",
        args: {},
      },
    ],
  ]);
  optimisticQuerySet.ingestQueryResultsFromServer(
    serverQueryResults,
    new Set(),
  );
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(2);

  // The first update adds 1.
  optimisticQuerySet.applyOptimisticUpdate((localStore) => {
    const oldResult = localStore.getQuery(anyApi.query.default, {});
    localStore.setQuery(anyApi.query.default, {}, oldResult + 1);
  }, 0);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(3);

  // The second update multiplies by 2.
  optimisticQuerySet.applyOptimisticUpdate((localStore) => {
    const oldResult = localStore.getQuery(anyApi.query.default, {});
    localStore.setQuery(anyApi.query.default, {}, oldResult * 2);
  }, 1);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(6);

  // Drop the first update. Now we're just multiplying by 2.
  optimisticQuerySet.ingestQueryResultsFromServer(
    serverQueryResults,
    new Set([0]),
  );
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(4);
  // Drop the second update. We're back to the start
  optimisticQuerySet.ingestQueryResultsFromServer(
    serverQueryResults,
    new Set([1]),
  );
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(2);
});

test("optimistic updates can set query results to undefined", () => {
  // This is an important use case because we want to allow devs to set queries
  // to be "loading"

  // set up a query
  const queryToken = serializePathAndArgs("query", {});
  const serverQueryResults: QueryResultsMap = new Map([
    [
      queryToken,
      {
        result: success("query value"),
        udfPath: "query",
        args: {},
      },
    ],
  ]);
  const changedQueries = optimisticQuerySet.ingestQueryResultsFromServer(
    serverQueryResults,
    new Set(),
  );
  expect(changedQueries).toEqual([queryToken]);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual("query value");

  // make it undefined
  optimisticQuerySet.applyOptimisticUpdate((localStore) => {
    localStore.setQuery(anyApi.query.default, {}, undefined);
  }, 0);
  expect(changedQueries).toEqual([queryToken]);
  expect(optimisticQuerySet.queryResult(queryToken)).toEqual(undefined);
});
