import child_process from "child_process";

import { test, expect } from "vitest";
import { Long } from "../../vendor/long.js";

import { BaseConvexClient } from "./client.js";
import {
  ActionRequest,
  MutationRequest,
  parseServerMessage,
  RequestId,
  WireServerMessage,
} from "./protocol.js";
import {
  encodeServerMessage,
  nodeWebSocket,
  UpdateQueue,
  withInMemoryWebSocket,
} from "./client_node_test_helpers.js";
import { FunctionArgs, makeFunctionReference } from "../../server/index.js";

test("BaseConvexClient protocol in node", async () => {
  await withInMemoryWebSocket(async ({ address, receive }) => {
    const client = new BaseConvexClient(
      address,
      () => {
        // ignore updates.
      },
      { webSocketConstructor: nodeWebSocket, unsavedChangesWarning: false },
    );

    expect((await receive()).type).toEqual("Connect");
    expect((await receive()).type).toEqual("ModifyQuerySet");

    await client.close();
  });
});

// Run the test above in its own Node.js subprocess to ensure that it exists
// cleanly. This is the only point of this test.
test("BaseConvexClient closes cleanly", () => {
  const p = child_process.spawnSync(
    "node_modules/.bin/vitest",
    [
      "-t",
      "BaseConvexClient protocol in node",
      "src/browser/sync/client_node.test.ts",
    ],
    {
      encoding: "utf-8",
      timeout: 35000,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        FORCE_COLOR: "false",
      },
    },
  );

  // If this is a timeout, the test didn't exit cleanly! Check for timers.
  expect(p.status).toBeFalsy();
});

test("Tests can encode longs in server messages", () => {
  const orig: WireServerMessage = {
    type: "Transition",
    startVersion: { querySet: 0, identity: 0, ts: Long.fromNumber(0) },
    endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(1) },
    modifications: [
      {
        type: "QueryUpdated",
        queryId: 0,
        value: 0.0,
        logLines: ["[LOG] 'Got stuff'"],
        journal: null,
      },
    ],
  };
  const encoded = encodeServerMessage(orig);
  const decoded = parseServerMessage(JSON.parse(encoded));
  expect(orig).toEqual(decoded);
});

// Detects an issue where actions sent before the WebSocket has connected
// are failed upon first connecting.
test("Actions can be called immediately", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const client = new BaseConvexClient(address, () => null, {
      webSocketConstructor: nodeWebSocket,
      unsavedChangesWarning: false,
    });
    const actionP = client.action("myAction", {});

    expect((await receive()).type).toEqual("Connect");
    expect((await receive()).type).toEqual("ModifyQuerySet");
    const actionRequest = await receive();
    expect(actionRequest.type).toEqual("Action");
    const requestId = (actionRequest as ActionRequest).requestId;

    send(actionSuccess(requestId));
    expect(await actionP).toBe(42);
    await client.close();
  });
});

function actionSuccess(requestId: RequestId): WireServerMessage {
  return {
    type: "ActionResponse",
    requestId: requestId,
    success: true,
    result: 42,
    logLines: [],
  };
}

test("maxObservedTimestamp is updated on mutation and transition", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const client = new BaseConvexClient(address, () => null, {
      webSocketConstructor: nodeWebSocket,
      unsavedChangesWarning: false,
    });

    expect(client.getMaxObservedTimestamp()).toBeUndefined();

    const mutationP = client.mutation("myMutation", {});

    expect((await receive()).type).toEqual("Connect");
    expect((await receive()).type).toEqual("ModifyQuerySet");
    const mutationRequest = await receive();
    expect(mutationRequest.type).toEqual("Mutation");
    const requestId = (mutationRequest as MutationRequest).requestId;

    // Send a mutation, should update the max observed timestamp.
    send({
      type: "MutationResponse",
      requestId: requestId,
      success: true,
      result: 42,
      ts: Long.fromNumber(1000),
      logLines: [],
    });
    // Wait until getMaxObservedTimestamp() gets updated
    for (let i = 0; i < 10; i++) {
      if (client.getMaxObservedTimestamp()) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(client.getMaxObservedTimestamp()).toEqual(Long.fromNumber(1000));

    // Send a transition from before the mutation. Should not update the max
    // observed timestamp nor resolve the mutation.
    send({
      type: "Transition",
      startVersion: {
        querySet: 0,
        ts: Long.fromNumber(0),
        identity: 0,
      },
      endVersion: {
        querySet: 0,
        ts: Long.fromNumber(500),
        identity: 0,
      },
      modifications: [],
    });

    // Wait a bit and confirm the max timestamp has not been updated.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(client.getMaxObservedTimestamp()).toEqual(Long.fromNumber(1000));

    // Send another transition with higher timestamp. This should resolve the
    // transition and advanced the max observable timestamp.
    send({
      type: "Transition",
      startVersion: {
        querySet: 0,
        ts: Long.fromNumber(500),
        identity: 0,
      },
      endVersion: {
        querySet: 0,
        ts: Long.fromNumber(2000),
        identity: 0,
      },
      modifications: [],
    });
    // Wait until the mutation is resolved.
    expect(await mutationP).toBe(42);
    expect(client.getMaxObservedTimestamp()).toEqual(Long.fromNumber(2000));

    await client.close();
  });
});

const apiQueriesA = makeFunctionReference<"query", {}, string>("queries:a");
const apiQueriesB = makeFunctionReference<"query", {}, string>("queries:b");

const _apiMutationsZ = makeFunctionReference<"mutation", {}>("mutations:z");

/**
 * Regression test for
 * - subscribing to query a
 * - running a mutation that sets an optimistic update for queries a and b
 * - receiving an update for a
 */
test("Setting optimistic updates for queries that have not yet been subscribed to", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const q = new UpdateQueue(10);

    const client = new BaseConvexClient(
      address,
      (queryTokens) => {
        q.onTransition(client)(queryTokens);
      },
      {
        webSocketConstructor: nodeWebSocket,
        unsavedChangesWarning: false,
        verbose: true,
      },
    );

    client.subscribe("queries:a", {});

    expect((await receive()).type).toEqual("Connect");
    const modify = await receive();

    expect(modify.type).toEqual("ModifyQuerySet");
    if (modify.type !== "ModifyQuerySet") {
      return;
    }
    expect(modify.modifications.length).toBe(1);
    expect(modify.modifications).toEqual([
      {
        type: "Add",
        queryId: 0,
        udfPath: "queries:a",
        args: [{}],
      },
    ]);

    // Now that we're subscribed to queries:a,
    // run a mutation that, optimistically and on the server,
    // - modifies q1
    // - modifies q2

    const mutP = client.mutation(
      "mutations:z",
      {},
      {
        optimisticUpdate: (
          localStore,
          _args: FunctionArgs<typeof _apiMutationsZ>,
        ) => {
          const curA = localStore.getQuery(apiQueriesA, {});
          localStore.setQuery(
            apiQueriesA,
            {},
            curA === undefined ? "a local" : `${curA} with a local applied`,
          );
          const curB = localStore.getQuery(apiQueriesB, {});
          localStore.setQuery(
            apiQueriesB,
            {},
            curB === undefined ? "b local" : `${curB} with b local applied`,
          );
        },
      },
    );

    // Synchronously, the local store should update and the changes should be broadcast.
    expect(client.localQueryResult("queries:a", {})).toEqual("a local");
    // We haven't actually subscribed to this query but it had a value set in an optimistic update.
    expect(client.localQueryResult("queries:b", {})).toEqual("b local");
    const update1 = await q.updatePromises[0];
    expect(q.updates).toHaveLength(1);
    expect(update1).toEqual({
      '{"udfPath":"queries:a","args":{}}': "a local",
      '{"udfPath":"queries:b","args":{}}': "b local",
    });

    // Now a transition arrives containing only an update to query a.
    // This previously crashed this execution context.
    send({
      type: "Transition",
      startVersion: {
        querySet: 0,
        identity: 0,
        ts: Long.fromNumber(0),
      },
      endVersion: {
        querySet: 1,
        identity: 0,
        ts: Long.fromNumber(100),
      },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 0,
          value: "a server",
          logLines: [],
          journal: null,
        },
      ],
    });

    const update2 = await q.updatePromises[1];
    expect(update2).toEqual({
      '{"udfPath":"queries:a","args":{}}': "a server with a local applied",
      '{"udfPath":"queries:b","args":{}}': "b local",
    });
    expect(q.allResults).toEqual({
      '{"udfPath":"queries:a","args":{}}': "a server with a local applied",
      '{"udfPath":"queries:b","args":{}}': "b local",
    });
    expect(q.updates).toHaveLength(2);

    const mutationRequest = await receive();
    expect(mutationRequest.type).toEqual("Mutation");
    expect(mutationRequest).toEqual({
      type: "Mutation",
      requestId: 0,
      udfPath: "mutations:z",
      args: [{}],
    });

    // Now the server sends:

    // 1. MutationResponse saying the mutation has run
    send({
      type: "MutationResponse",
      requestId: 0,
      success: true,
      result: null,
      ts: Long.fromNumber(200), // "ZDhuVB3CRxg=", in example
      logLines: [],
    });

    // 2. Transition bringing us up to date with the mutation
    send({
      type: "Transition",
      startVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(100) },
      endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(200) },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 0,
          value: "a server",
          logLines: [],
          journal: null,
        },
      ],
    });

    expect(await q.updatePromises[2]).toEqual({
      '{"udfPath":"queries:a","args":{}}': "a server",
      // Now there's no more optimistic value for b!
      '{"udfPath":"queries:b","args":{}}': undefined,
    });

    // After all that the mutation should resolve.
    await mutP;

    await client.close();
  }, true);
});

/**
 * Regression test for
 * - subscribing to slow query a
 * - subscribing to fast query b
 * - receiving an update for b, without a
 */
test("Query results coming back out of order (fast query first, slower query later)", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const q = new UpdateQueue(10);

    const client = new BaseConvexClient(
      address,
      (queryTokens) => {
        q.onTransition(client)(queryTokens);
      },
      {
        webSocketConstructor: nodeWebSocket,
        unsavedChangesWarning: false,
        verbose: true,
      },
    );

    client.subscribe("queries:slow", {});

    expect((await receive()).type).toEqual("Connect");
    const modify = await receive();

    expect(modify.type).toEqual("ModifyQuerySet");
    if (modify.type !== "ModifyQuerySet") {
      return;
    }
    expect(modify.modifications.length).toBe(1);
    expect(modify.modifications).toEqual([
      {
        type: "Add",
        queryId: 0,
        udfPath: "queries:slow",
        args: [{}],
      },
    ]);

    // Later we subscribe to a fast query
    client.subscribe("queries:fast", {});

    const modify2 = await receive();

    expect(modify2.type).toEqual("ModifyQuerySet");
    if (modify2.type !== "ModifyQuerySet") {
      return;
    }
    expect(modify2.modifications.length).toBe(1);
    expect(modify2.modifications).toEqual([
      {
        type: "Add",
        queryId: 1,
        udfPath: "queries:fast",
        args: [{}],
      },
    ]);

    // Once the client has subscribed to queries:slow and queries:fast but has no results for either,
    // the server is allowed to respond with a Transition that contains no mutations, "acknowledging"
    // the slow query subscription but not responding with a value for it.
    send({
      type: "Transition",
      startVersion: { querySet: 0, identity: 0, ts: Long.fromNumber(0) },
      endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(100) },
      modifications: [
        // This is unusual, but allowed.
      ],
    });

    // TODO test what happens when this first Transition contains an update for a query that does not exist in this query set.

    // apparently this triggers an update???
    const update1 = await q.awaitPromiseAtIndexWithTimeout(0);
    expect(update1).toEqual({});

    // Later the server sends a fast result
    send({
      type: "Transition",
      startVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(100) },
      endVersion: { querySet: 2, identity: 0, ts: Long.fromNumber(200) },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 1,
          value: "fast result",
          logLines: [],
          journal: null,
        },
      ],
    });
    const update2 = await q.awaitPromiseAtIndexWithTimeout(1);

    expect(update2).toStrictEqual({
      '{"udfPath":"queries:fast","args":{}}': "fast result",
    });
    expect(q.allResults).toStrictEqual({
      '{"udfPath":"queries:fast","args":{}}': "fast result",
    });
    expect(q.updates).toHaveLength(2);

    expect(client.localQueryResult("queries:fast", {})).toEqual("fast result");
    expect(client.localQueryResult("queries:slow", {})).toEqual(undefined);

    // Later the server sends a slow result
    send({
      type: "Transition",
      startVersion: { querySet: 2, identity: 0, ts: Long.fromNumber(200) },
      endVersion: { querySet: 2, identity: 0, ts: Long.fromNumber(300) },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 0,
          value: "slow result",
          logLines: [],
          journal: null,
        },
      ],
    });
    const update3 = await q.awaitPromiseAtIndexWithTimeout(2);

    expect(update3).toStrictEqual({
      '{"udfPath":"queries:slow","args":{}}': "slow result",
    });
    expect(q.allResults).toStrictEqual({
      '{"udfPath":"queries:fast","args":{}}': "fast result",
      '{"udfPath":"queries:slow","args":{}}': "slow result",
    });
    expect(q.updates).toHaveLength(3);

    expect(client.localQueryResult("queries:fast", {})).toEqual("fast result");
    expect(client.localQueryResult("queries:slow", {})).toEqual("slow result");

    await client.close();
  }, true);
});

/**
 * Test to characterize behavior so we know if it changes. This behavior is not relied upon,
 * we consider it a protocol error, but it does happen to work.
 *
 * - subscribe to slow query (query 0) (querySet 1)
 * - subscribe to fast query (query 1) (querySet 2)
 * - server sends message transitioning to querySet 1 that includes result for only the fast query (!)
 * This works! The fast query result is not dropped on the floor.
 * - server send message transitioning to querySet 2, plus it includes slow query.
 */
test("Transition contains result for query not in purported query set version", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const q = new UpdateQueue(10);

    const client = new BaseConvexClient(
      address,
      (queryTokens) => {
        q.onTransition(client)(queryTokens);
      },
      {
        webSocketConstructor: nodeWebSocket,
        unsavedChangesWarning: false,
        verbose: true,
      },
    );

    // Subscribe to slow query first
    client.subscribe("queries:slow", {});

    expect((await receive()).type).toEqual("Connect");
    const modify1 = await receive();

    expect(modify1.type).toEqual("ModifyQuerySet");
    if (modify1.type !== "ModifyQuerySet") {
      return;
    }
    expect(modify1.modifications).toEqual([
      {
        type: "Add",
        queryId: 0,
        udfPath: "queries:slow",
        args: [{}],
      },
    ]);

    // Then subscribe to fast query
    client.subscribe("queries:fast", {});

    const modify2 = await receive();
    expect(modify2.type).toEqual("ModifyQuerySet");
    if (modify2.type !== "ModifyQuerySet") {
      return;
    }
    expect(modify2.modifications).toEqual([
      {
        type: "Add",
        queryId: 1,
        udfPath: "queries:fast",
        args: [{}],
      },
    ]);

    // Server sends malformed Transition: claims querySet version 1 (only slow query)
    // but includes result for queryId 1 (fast query) which should be in querySet version 2
    send({
      type: "Transition",
      startVersion: { querySet: 0, identity: 0, ts: Long.fromNumber(0) },
      endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(100) },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 1, // But provides result for fast query!
          value: "fast result from malformed transition",
          logLines: [],
          journal: null,
        },
      ],
    });

    // Client should still process the result (the client is forgiving)
    const update1 = await q.awaitPromiseAtIndexWithTimeout(0);
    expect(update1).toEqual({
      '{"udfPath":"queries:fast","args":{}}':
        "fast result from malformed transition",
    });

    // The fast query result should be available
    expect(client.localQueryResult("queries:fast", {})).toEqual(
      "fast result from malformed transition",
    );
    expect(client.localQueryResult("queries:slow", {})).toEqual(undefined);

    // Next transition should work normally
    send({
      type: "Transition",
      startVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(100) },
      endVersion: { querySet: 2, identity: 0, ts: Long.fromNumber(200) },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 0,
          value: "slow result",
          logLines: [],
          journal: null,
        },
      ],
    });

    const update2 = await q.awaitPromiseAtIndexWithTimeout(1);
    expect(update2).toEqual({
      '{"udfPath":"queries:slow","args":{}}': "slow result",
    });

    // Both results should be available and the fast query result should persist
    expect(client.localQueryResult("queries:fast", {})).toEqual(
      "fast result from malformed transition",
    );
    expect(client.localQueryResult("queries:slow", {})).toEqual("slow result");

    await client.close();
  }, true);
});

/**
 * Test to characterize existing behavior that we may want to change.
 *
 * - subscribe to a query
 * - get a result
 * - get a new "result" (Transition with QueryRemoved modification) that, if you didn't know better,
 *   you might send from the server to indicate this result is now loading
 * - get a new real result (Transition with QueryUpdated modification)
 *
 * One might expect the client to publish updates "result, loading, result,"
 * but the client only publishes "result."
 *
 * Currently the client stops tracking a query when it receives QueryRemoved
 * from the server (it stops tracking it in the RemoteQuerySet).
 */
test("Query unsubscription triggers empty transition for listeners", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const q = new UpdateQueue(10);

    const client = new BaseConvexClient(
      address,
      (queryTokens) => {
        q.onTransition(client)(queryTokens);
      },
      {
        webSocketConstructor: nodeWebSocket,
        unsavedChangesWarning: false,
        verbose: true,
      },
    );

    client.subscribe("queries:test", {});

    expect((await receive()).type).toEqual("Connect");
    const modify1 = await receive();

    expect(modify1.type).toEqual("ModifyQuerySet");
    if (modify1.type !== "ModifyQuerySet") {
      return;
    }
    expect(modify1.modifications).toEqual([
      {
        type: "Add",
        queryId: 0,
        udfPath: "queries:test",
        args: [{}],
      },
    ]);

    // Server sends result for the query
    send({
      type: "Transition",
      startVersion: { querySet: 0, identity: 0, ts: Long.fromNumber(0) },
      endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(100) },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 0,
          value: "test result",
          logLines: [],
          journal: null,
        },
      ],
    });

    const update1 = await q.awaitPromiseAtIndexWithTimeout(0);
    expect(update1).toEqual({
      '{"udfPath":"queries:test","args":{}}': "test result",
    });
    expect(q.allResults).toStrictEqual({
      '{"udfPath":"queries:test","args":{}}': "test result",
    });
    expect(client.localQueryResult("queries:test", {})).toEqual("test result");

    // "QueryRemoved" from the server communicates that this query is now in an loading state.
    send({
      type: "Transition",
      startVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(100) },
      endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(200) },
      modifications: [
        {
          type: "QueryRemoved",
          queryId: 0,
        },
      ],
    });

    // The update received contains nothing so there's no notification
    // that this has gone back to undefined!
    const update2 = await q.awaitPromiseAtIndexWithTimeout(1);

    // What we wish happened, if removing a query is supposed to be
    // the same as setting it to undefined.
    /*
    expect(update2).toStrictEqual({
      '{"udfPath":"queries:test","args":{}}': undefined,
    });
    */
    // what actually happens
    expect(update2).toStrictEqual({});

    expect(q.updates).toHaveLength(2);

    // The query result is no longer available locally after removal...
    expect(client.localQueryResult("queries:test", {})).toEqual(undefined);

    // ...but anyone listening won't have been updated.
    expect(q.allResults).toEqual({
      '{"udfPath":"queries:test","args":{}}': "test result",
    });
    // So e.g. a useQuery() React hook would return the correct value (undefined),
    // but that component would not be triggered to rerender. The displayed result
    // will be stale until the component is rerendered for some other reason.

    // What if we set a result again?
    send({
      type: "Transition",
      startVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(200) },
      endVersion: { querySet: 1, identity: 0, ts: Long.fromNumber(300) },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 0,
          value: "new test result",
          logLines: [],
          journal: null,
        },
      ],
    });

    // What we might expect to happen if removing a query were equivalent to
    // "updating the query to loading" and setting a value after worked:
    /*
    const update3 = await q.awaitPromiseAtIndexWithTimeout(2);
    expect(update3).toEqual({
      '{"udfPath":"queries:test","args":{}}': "new test result",
    });
    expect(q.allResults).toStrictEqual({
      '{"udfPath":"queries:test","args":{}}': "new test result",
    });
    */
    // what actually happens
    // wait a macrotask just in case
    //await new Promise((r) => setTimeout(r, 0));
    expect(q.updates).toHaveLength(2);

    // This result is no longer tracked!
    expect(client.localQueryResult("queries:test", {})).toEqual(undefined);

    await client.close();
  }, true);
});

test("TransitionChunk messages are assembled into a Transition", async () => {
  await withInMemoryWebSocket(async ({ address, receive, send }) => {
    const client = new BaseConvexClient(address, () => null, {
      webSocketConstructor: nodeWebSocket,
      unsavedChangesWarning: false,
    });
    expect((await receive()).type).toEqual("Connect");
    expect((await receive()).type).toEqual("ModifyQuerySet");

    const fullTransition: WireServerMessage = {
      type: "Transition",
      startVersion: {
        querySet: 0,
        ts: Long.fromNumber(0),
        identity: 0,
      },
      endVersion: {
        querySet: 1,
        ts: Long.fromNumber(1000),
        identity: 0,
      },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 0,
          value: { result: "chunk test data" },
          logLines: [],
          journal: null,
        },
      ],
    };

    const fullJson = encodeServerMessage(fullTransition);
    const midpoint = Math.floor(fullJson.length / 2);
    const chunk1 = fullJson.substring(0, midpoint);
    const chunk2 = fullJson.substring(midpoint);

    const transitionId = "12345";

    send({
      type: "TransitionChunk",
      chunk: chunk1,
      partNumber: 0,
      totalParts: 2,
      transitionId,
    });

    expect(client.getMaxObservedTimestamp()).toBeUndefined();

    send({
      type: "TransitionChunk",
      chunk: chunk2,
      partNumber: 1,
      totalParts: 2,
      transitionId,
    });

    // synchronously, it's still undefined
    expect(client.getMaxObservedTimestamp()).toEqual(undefined);

    for (let i = 0; i < 10; i++) {
      if (client.getMaxObservedTimestamp()) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(client.getMaxObservedTimestamp()).toEqual(Long.fromNumber(1000));

    await client.close();
  });
});
