/**
 * @vitest-environment custom-vitest-environment.ts
 */
import { vi, expect, test, describe, beforeEach, afterEach } from "vitest";

import { renderHook } from "@testing-library/react";
import React from "react";
import { ConvexProvider, ConvexReactClient } from "../react/client.js";
import { usePreloadedQuery } from "../react/hydration.js";
import { anyApi } from "../server/api.js";
import { convexToJson } from "../values/value.js";
import { preloadQuery, preloadedQueryResult } from "./index.js";

const address = "https://127.0.0.1:3001";

describe("env setup", () => {
  test("requires NEXT_PUBLIC_CONVEX_URL", async () => {
    await expect(preloadQuery(anyApi.myQuery.default)).rejects.toThrow(
      "Environment variable NEXT_PUBLIC_CONVEX_URL is not set.",
    );
  });
});

describe("preloadQuery and usePreloadedQuery", () => {
  beforeEach(() => {
    global.process.env.NEXT_PUBLIC_CONVEX_URL = address;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ status: "success", value: convexToJson({ x: 42 }) }),
    } as never) as any;
  });

  afterEach(() => {
    delete global.process.env.NEXT_PUBLIC_CONVEX_URL;
  });

  test("returns server result before client loads data", async () => {
    const preloaded = await preloadQuery(anyApi.myQuery.default, {
      arg: "something",
    });
    const serverResult = preloadedQueryResult(preloaded);

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cache: "no-store",
      }),
    );

    expect(serverResult).toStrictEqual({ x: 42 });

    const client = new ConvexReactClient(address);
    const wrapper = ({ children }: any) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
    const { result: hydrationResult } = renderHook(
      () => usePreloadedQuery(preloaded),
      { wrapper },
    );
    expect(hydrationResult.current).toStrictEqual({ x: 42 });
  });

  test("returns client result after client loads data", async () => {
    const preloaded = await preloadQuery(anyApi.myQuery.default, {
      arg: "something",
    });
    const client = new ConvexReactClient(address);
    // Use an optimistic update to set up a query to have a result.
    void client.mutation(
      anyApi.myMutation.default,
      {},
      {
        optimisticUpdate: (localStore) => {
          localStore.setQuery(
            anyApi.myQuery.default,
            { arg: "something" },
            // Simplest value to return, and make sure we're correctly
            // handling it.
            null,
          );
        },
      },
    );
    const wrapper = ({ children }: any) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
    const { result: clientResult } = renderHook(
      () => usePreloadedQuery(preloaded),
      { wrapper },
    );
    expect(clientResult.current).toStrictEqual(null);
  });
});
