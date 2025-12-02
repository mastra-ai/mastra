import { test, expect } from "vitest";
import { withInMemoryWebSocket } from "./sync/client_node_test_helpers.js";
import {
  DefaultFunctionArgs,
  getFunctionName,
  makeFunctionReference,
} from "../server/index.js";
// This Node.js build sets up the WebSocket dependency automatically.
import { ConvexClient } from "./simple_client-node.js";

const apiQueryFunc = makeFunctionReference<
  "query",
  DefaultFunctionArgs,
  string
>("jeans style");
const apiMutationFunc = makeFunctionReference<
  "mutation",
  DefaultFunctionArgs,
  string
>("jeans style");

test("Subscriptions are deduplicated", async () => {
  // The actual implementation of this dedupliation logic is in BaseConvexClient.
  await withInMemoryWebSocket(async ({ address, receive }) => {
    const client = new ConvexClient(address, {
      unsavedChangesWarning: false,
    });
    expect((await receive()).type).toEqual("Connect");
    expect((await receive()).type).toEqual("ModifyQuerySet");

    const { unsubscribe: unsub1 } = client.onUpdate(
      apiQueryFunc,
      {},
      () => null,
    );
    expect((await receive()).type).toEqual("ModifyQuerySet");

    // The second subscribe to the same query should not send another query request.
    const { unsubscribe: unsub2 } = client.onUpdate(
      apiQueryFunc,
      {},
      () => null,
    );
    unsub1();
    void client.mutation(apiMutationFunc, {});
    // Receiving a mutation next means no third or fourth ModifyQuerySet.
    expect((await receive()).type).toEqual("Mutation");

    // Unsubscribing the second time should trigger the unsubscribe.
    unsub2();
    expect((await receive()).type).toEqual("ModifyQuerySet");

    await client.close();
  });
});

test("Optimistic updates are applied", async () => {
  await withInMemoryWebSocket(async ({ address, receive }) => {
    const client = new ConvexClient(address, {
      unsavedChangesWarning: false,
    });
    expect((await receive()).type).toEqual("Connect");
    expect((await receive()).type).toEqual("ModifyQuerySet");

    let updateCount = 0;
    let updateValue = "";
    let optimisticUpdateRan = 0;

    // Subscribe to a query, which *does not* immediately trigger an update.
    const { unsubscribe } = client.onUpdate(apiQueryFunc, {}, (value) => {
      updateCount++;
      updateValue = value;
    });
    expect((await receive()).type).toEqual("ModifyQuerySet");
    expect(client.client.localQueryResult(getFunctionName(apiQueryFunc))).toBe(
      undefined,
    );

    void client.mutation(
      apiMutationFunc,
      {},
      {
        optimisticUpdate: (localStore) => {
          optimisticUpdateRan++;
          localStore.setQuery(apiQueryFunc, {}, "optimisticValue");
        },
      },
    );
    expect((await receive()).type).toEqual("Mutation");

    // The mutation also updates the local cache
    expect(optimisticUpdateRan).toBe(1);
    expect(updateCount).toBe(1);
    expect(updateValue).toBe("optimisticValue");
    expect(client.client.localQueryResult(getFunctionName(apiQueryFunc))).toBe(
      "optimisticValue",
    );

    unsubscribe();
    expect((await receive()).type).toEqual("ModifyQuerySet");

    await client.close();
  });
});
