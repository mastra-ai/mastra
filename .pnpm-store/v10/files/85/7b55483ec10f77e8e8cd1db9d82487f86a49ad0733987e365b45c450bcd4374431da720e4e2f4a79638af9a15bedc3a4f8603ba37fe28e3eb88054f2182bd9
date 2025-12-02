/**
 * @vitest-environment happy-dom
 */
import { test, expect, describe, vi } from "vitest";
import ws from "ws";

import { ConvexReactClient, createMutation, useQuery } from "./client.js";
import { ConvexProvider } from "./index.js";
import React from "react";
import { renderHook } from "@testing-library/react";
import { anyApi, makeFunctionReference } from "../server/api.js";

const address = "https://127.0.0.1:3001";

const testConvexReactClient = () =>
  new ConvexReactClient(address, {
    webSocketConstructor: ws as unknown as typeof WebSocket,
  });

describe("ConvexReactClient", () => {
  test("can be constructed", () => {
    const client = testConvexReactClient();
    expect(typeof client).not.toEqual("undefined");
  });
});
describe("createMutation", () => {
  test("Optimistic updates can be created", () => {
    const client = testConvexReactClient();
    createMutation(anyApi.myMutation.default, client).withOptimisticUpdate(
      () => {
        // no update
      },
    );
  });

  test("Specifying an optimistic update twice produces an error", () => {
    const client = testConvexReactClient();
    const mutation = createMutation(
      anyApi.myMutation.default,
      client,
    ).withOptimisticUpdate(() => {
      // no update
    });
    expect(() => {
      mutation.withOptimisticUpdate(() => {
        // no update
      });
    }).toThrow("Already specified optimistic update for mutation myMutation");
  });

  test("Using a mutation as an event handler directly throws a useful error", () => {
    const client = testConvexReactClient();

    const fakeSyntheticEvent: any = {
      bubbles: false,
      cancelable: true,
      defaultPrevented: false,
      isTrusted: false,
      nativeEvent: {},
      preventDefault: () => undefined,
      isDefaultPrevented: false,
      stopPropagation: () => undefined,
      isPropagationStopped: false,
      persist: () => undefined,
      timeStamp: 0,
      type: "something",
    };
    const myMutation = createMutation(anyApi.myMutation.default, client);
    expect(() => myMutation(fakeSyntheticEvent)).toThrow(
      "Convex function called with SyntheticEvent object.",
    );
  });
});

describe("useQuery", () => {
  function createClientWithQuery() {
    const client = testConvexReactClient();
    // Use an optimistic update to set up a query to have a result.
    void client.mutation(
      anyApi.myMutation.default,
      {},
      {
        optimisticUpdate: (localStore) => {
          localStore.setQuery(anyApi.myQuery.default, {}, "queryResult");
        },
      },
    );
    return client;
  }

  test("returns the result", () => {
    const client = createClientWithQuery();
    const wrapper = ({ children }: any) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
    const { result } = renderHook(() => useQuery(anyApi.myQuery.default), {
      wrapper,
    });
    expect(result.current).toStrictEqual("queryResult");
  });

  test("returns undefined when skipped", () => {
    const client = createClientWithQuery();
    const wrapper = ({ children }: any) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
    const { result } = renderHook(
      () => useQuery(anyApi.myQuery.default, "skip"),
      {
        wrapper,
      },
    );
    expect(result.current).toStrictEqual(undefined);
  });

  test("Optimistic update handlers can’t be async", () => {
    const client = testConvexReactClient();
    const mutation = createMutation(
      anyApi.myMutation.default,
      client,
      // @ts-expect-error
    ).withOptimisticUpdate(async () => {});

    // Calling the mutation should warn in the console
    const consoleWarnSpy = vi.spyOn(console, "warn");
    void mutation();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Optimistic update handler returned a Promise. Optimistic updates should be synchronous.",
    );
  });
});

// Intentionally disabled because we're only testing types
describe.skip("useQuery typing", () => {
  test("useQuery with no args query", () => {
    const queryWithNoArgs = makeFunctionReference<
      "query",
      Record<string, never>
    >("foo");
    useQuery(queryWithNoArgs, {});
    // @ts-expect-error This should be an error
    useQuery(queryWithNoArgs, { x: 3 });
    useQuery(queryWithNoArgs, "skip");
    const x: number | null = null;
    useQuery(queryWithNoArgs, x === null ? "skip" : {});
    // This should be an error, but isn't :(, probably a bug in TypeScript
    useQuery(queryWithNoArgs, x === null ? "skip" : { x });
    // @ts-expect-error This should be an error
    useQuery(queryWithNoArgs, x === null ? "skip" : { x: 3 });
  });

  test("useQuery with query taking args", () => {
    const queryWithArgs = makeFunctionReference<"query", { x: number }>("foo");
    // @ts-expect-error This should be an error
    useQuery(queryWithArgs);
    // @ts-expect-error This should be an error
    useQuery(queryWithArgs, { x: "not a number" });
    useQuery(queryWithArgs, { x: 42 });
    useQuery(queryWithArgs, "skip");
    const x: number | null = null;
    useQuery(queryWithArgs, x === null ? "skip" : { x });
    // @ts-expect-error This should be an error
    useQuery(queryWithArgs, x === null ? null : { x: "not a number" });
  });
});

describe("async query fetch", () => {
  const client = testConvexReactClient();

  function optimisticUpdate() {
    // Use an optimistic update to set up a query to have a result.
    void client.mutation(
      anyApi.myMutation.default,
      {},
      {
        optimisticUpdate: (localStore) => {
          localStore.setQuery(anyApi.myQuery.default, {}, "queryResult");
        },
      },
    );
  }

  test("returns after optimistic update", async () => {
    const queryResult = client.query(anyApi.myQuery.default, {});
    optimisticUpdate();
    expect(await queryResult).toStrictEqual("queryResult");
  });

  test("returns existing result", async () => {
    optimisticUpdate();
    const queryResult = client.query(anyApi.myQuery.default, {});
    expect(await queryResult).toStrictEqual("queryResult");
  });
});
