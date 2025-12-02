import { test, expect } from "vitest";
import { Long } from "../vendor/long.js";

import { ConvexReactClient } from "./client.js";
import {
  ClientMessage,
  QuerySetModification,
  WireServerMessage,
} from "../browser/sync/protocol.js";
import {
  nodeWebSocket,
  withInMemoryWebSocket,
} from "../browser/sync/client_node_test_helpers.js";
import { anyApi } from "../server/api.js";

const testReactClient = (address: string) =>
  new ConvexReactClient(address, {
    webSocketConstructor: nodeWebSocket,
    unsavedChangesWarning: false,
  });

test("ConvexReactClient ends subscriptions on close", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const client = testReactClient(address);
    const watch = client.watchQuery(anyApi.myQuery.default, {});
    let timesCallbackRan = 0;
    watch.onUpdate(() => timesCallbackRan++);

    expect((await receive()).type).toEqual("Connect");
    const modify = expectQuerySetModification(await receive());
    expect(modify.modifications).toEqual([
      {
        args: [{}],
        queryId: 0,
        type: "Add",
        udfPath: "myQuery:default",
      },
    ]);
    expect(timesCallbackRan).toEqual(0);

    send(transition());

    // After the callback has been registered but before the callback has been
    // run, close the client.
    const closePromise = client.close();

    expect(timesCallbackRan).toEqual(0);

    // After the internal client has closed, same nothing.
    await closePromise;
    expect(timesCallbackRan).toEqual(0);
  });
});

const expectQuerySetModification = (
  message: ClientMessage,
): QuerySetModification => {
  expect(message.type).toEqual("ModifyQuerySet");
  if (message.type !== "ModifyQuerySet") throw new Error("Wrong message!");
  return message;
};

function transition(): WireServerMessage {
  return {
    type: "Transition",
    startVersion: { querySet: 0, identity: 0, ts: Long.fromNumber(0) },
    endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(1) },
    modifications: [
      {
        type: "QueryUpdated",
        queryId: 0,
        value: 0.0,
        logLines: [],
        journal: null,
      },
    ],
  };
}
