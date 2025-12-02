/**
 * @vitest-environment custom-vitest-environment.ts
 */

import { test, expect } from "vitest";

import { BaseConvexClient } from "./client.js";
import { anyApi } from "../../server/api.js";

test("localQueryResult reflects optimistic results", async () => {
  const client = new BaseConvexClient("http://127.0.0.1:8000", () => {
    // ignore updates.
  });

  expect(client.localQueryResult("myUdf", {})).toBeUndefined();

  // don't wait for mutation to complete
  void client.mutation(
    "myUdf",
    {},
    {
      optimisticUpdate: (localQueryStore) => {
        localQueryStore.setQuery(anyApi.myUdf.default, {}, true);
      },
    },
  );
  expect(client.localQueryResult("myUdf", {})).toBe(true);
});

test("Client warns when old clientConfig format is used", async () => {
  expect(() => {
    new BaseConvexClient(
      { address: "http://127.0.0.1:8000" } as any,
      () => null,
    );
  }).toThrow("no longer supported");
});
