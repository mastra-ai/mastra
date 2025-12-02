import { test, expect, beforeEach, vi } from "vitest";
import { RequestManager } from "./request_manager.js";
import { Long } from "../../vendor/long.js";
import { ActionRequest, MutationRequest } from "./protocol.js";
import { instantiateDefaultLogger } from "../logging.js";

let requestManager: RequestManager;
let markConnectionStateDirty: ReturnType<typeof vi.fn>;

beforeEach(() => {
  markConnectionStateDirty = vi.fn();
  requestManager = new RequestManager(
    instantiateDefaultLogger({ verbose: false }),
    markConnectionStateDirty,
  );
});

test("hasIncompleteRequests", () => {
  // Starts false.
  expect(requestManager.hasIncompleteRequests()).toBe(false);

  // When we request a mutation it becomes true.
  let message: MutationRequest = {
    type: "Mutation",
    requestId: 0,
    udfPath: "myMutation",
    args: [],
  };
  let _ = requestManager.request(message, true);
  expect(requestManager.hasIncompleteRequests()).toBe(true);

  // Request a second mutation and receive the first's response.
  // Should still have an outstanding mutation.
  message = {
    type: "Mutation",
    requestId: 1,
    udfPath: "myMutation",
    args: [],
  };
  _ = requestManager.request(message, true);
  requestManager.onResponse({
    type: "MutationResponse",
    requestId: 0,
    success: true,
    result: null,
    ts: Long.fromNumber(0),
    logLines: [],
  });
  expect(requestManager.hasIncompleteRequests()).toBe(true);

  // When the second response comes back we no longer have any outstanding mutations.
  requestManager.onResponse({
    type: "MutationResponse",
    requestId: 1,
    success: true,
    result: null,
    ts: Long.fromNumber(0),
    logLines: [],
  });
  expect(requestManager.hasIncompleteRequests()).toBe(false);
});

/**
 * A test that simulates a WebSocket disconnection half-way through the mutation
 * flow.
 */
test("mutation retries", async () => {
  // Request a mutation.
  const message: MutationRequest = {
    type: "Mutation",
    requestId: 0,
    udfPath: "myMutation",
    args: [],
  };
  const mutationRequest = requestManager.request(message, true);

  // Receive the response.
  requestManager.onResponse({
    type: "MutationResponse",
    requestId: 0,
    success: true,
    result: null,
    ts: Long.fromNumber(0),
    logLines: [],
  });
  expect(requestManager.hasSyncedPastLastReconnect()).toBe(true);

  // Pretend that we become disconnected and reconnect.
  // We should request the mutation because we haven't transitioned past the
  // timestamp the mutation was committed at yet.
  expect(requestManager.restart()).toEqual([message]);
  expect(requestManager.hasSyncedPastLastReconnect()).toBe(false);

  // Receive another response (because we restarted and requested it again)
  requestManager.onResponse({
    type: "MutationResponse",
    requestId: 0,
    success: true,
    result: null,
    ts: Long.fromNumber(0),
    logLines: [],
  });

  // Transition to ts=1
  requestManager.removeCompleted(Long.fromNumber(1));
  expect(requestManager.hasSyncedPastLastReconnect()).toBe(true);

  // Return the result of the mutation now that we've transitioned past the
  // mutation timestamp.
  const result = await mutationRequest;
  expect(result).toEqual({ success: true, value: null, logLines: [] });

  // The if we restart now, the mutation should no longer be re-requested.
  expect(requestManager.restart()).toEqual([]);
});

/**
 * Another disconnection test
 *
 * This time upon reconnect we transition past the mutation immediately when we
 * reconnect (before getting the second response).
 */
test("mutation retries with transition", async () => {
  // Request a mutation.
  const message: MutationRequest = {
    type: "Mutation",
    requestId: 0,
    udfPath: "myMutation",
    args: [],
  };
  const mutationRequest = requestManager.request(message, true);

  // Receive the response.
  requestManager.onResponse({
    type: "MutationResponse",
    requestId: 0,
    success: true,
    result: null,
    ts: Long.fromNumber(0),
    logLines: [],
  });
  expect(requestManager.hasSyncedPastLastReconnect()).toBe(true);

  // Pretend that we become disconnected and reconnect.
  // We should request the mutation because we haven't transitioned past the
  // timestamp the mutation was committed at yet.
  expect(requestManager.restart()).toEqual([message]);
  expect(requestManager.hasSyncedPastLastReconnect()).toBe(false);

  // Transition to ts=1
  requestManager.removeCompleted(Long.fromNumber(1));
  expect(requestManager.hasSyncedPastLastReconnect()).toBe(true);

  // Return the result of the mutation now that we've transitioned past the
  // mutation timestamp.
  const result = await mutationRequest;
  expect(result).toEqual({ success: true, value: null, logLines: [] });

  // The if we restart now, the mutation should no longer be re-requested because
  // we've already observed it.
  expect(requestManager.restart()).toEqual([]);
  expect(requestManager.hasSyncedPastLastReconnect()).toBe(true);

  // Receive another response (because we requested it again).
  // This response just needs to not crash the client.
  requestManager.onResponse({
    type: "MutationResponse",
    requestId: 0,
    success: true,
    result: null,
    ts: Long.fromNumber(0),
    logLines: [],
  });
});

/**
 * A test that simulates a WebSocket disconnection half-way through the action
 * flow. Makes sure the action doe not get retried.
 */
test("actions are retried only if unsent", async () => {
  // Request a mutation.
  const message1: ActionRequest = {
    type: "Action",
    requestId: 0,
    udfPath: "myAction1",
    args: [],
  };
  const actionRequest1 = requestManager.request(message1, true);
  const message2: ActionRequest = {
    type: "Action",
    requestId: 1,
    udfPath: "myAction2",
    args: [],
  };
  const actionRequest2 = requestManager.request(message2, false);

  // Pretend that we become disconnected and reconnect.
  // We should only resend message2.
  expect(requestManager.restart()).toEqual([message2]);

  // The sent action promise should resolve with an error.
  const result = await actionRequest1;
  expect(result).toEqual({
    success: false,
    errorMessage: "Connection lost while action was in flight",
    logLines: [],
  });

  // If we reconnect again, we should not retry anything. The second promise
  // should also resolve with an error.
  expect(requestManager.restart()).toEqual([]);
  const result2 = await actionRequest2;
  expect(result2).toEqual({
    success: false,
    errorMessage: "Connection lost while action was in flight",
    logLines: [],
  });
});

test("markConnectionStateDirty is called on state changes", () => {
  expect(markConnectionStateDirty).toHaveBeenCalledTimes(0);

  // Adding a request should trigger the callback
  const message: MutationRequest = {
    type: "Mutation",
    requestId: 0,
    udfPath: "myMutation",
    args: [],
  };
  void requestManager.request(message, true);
  expect(markConnectionStateDirty).toHaveBeenCalledTimes(1);

  // Response for actions triggers callback immediately, but mutations need to complete
  const actionMessage: ActionRequest = {
    type: "Action",
    requestId: 1,
    udfPath: "myAction",
    args: [],
  };
  void requestManager.request(actionMessage, true);
  expect(markConnectionStateDirty).toHaveBeenCalledTimes(2);

  // Action response should trigger callback
  requestManager.onResponse({
    type: "ActionResponse",
    requestId: 1,
    success: true,
    result: null,
    logLines: [],
  });
  expect(markConnectionStateDirty).toHaveBeenCalledTimes(3);

  // First make a mutation response that gets completed
  requestManager.onResponse({
    type: "MutationResponse",
    requestId: 0,
    success: true,
    result: null,
    ts: Long.fromNumber(0),
    logLines: [],
  });

  // removeCompleted should trigger the callback when mutations complete
  markConnectionStateDirty.mockClear();
  const completedRequests = requestManager.removeCompleted(Long.fromNumber(1));
  expect(completedRequests.size).toBe(1);
  expect(markConnectionStateDirty).toHaveBeenCalledTimes(1);

  // restart should trigger the callback
  markConnectionStateDirty.mockClear();
  requestManager.restart();
  expect(markConnectionStateDirty).toHaveBeenCalledTimes(1);
});
