import { test, expect } from "vitest";
import { Long } from "../../vendor/long.js";

import { LocalSyncState } from "./local_state.js";

test("can create a local state", () => {
  new LocalSyncState();
});

test("has outstanding state older than restart", () => {
  const state = new LocalSyncState();
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Restarting w/o outstanding queries
  state.restart(new Set());
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Do two subscriptions.
  state.subscribe("hello:world1", {});
  state.subscribe("hello:world2", {});
  const queryId1 = state.queryId("hello:world1", {})!;
  const queryId2 = state.queryId("hello:world2", {})!;
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Restart before we get results. This should flip synced to false.
  state.restart(new Set());
  expect(state.hasSyncedPastLastReconnect()).toBe(false);

  // If we provide partial results, then synced should remain false
  state.transition({
    type: "Transition",
    startVersion: {
      querySet: 0,
      ts: Long.fromNumber(500),
      identity: 0,
    },
    endVersion: {
      querySet: 0,
      ts: Long.fromNumber(1000),
      identity: 0,
    },
    modifications: [
      {
        type: "QueryUpdated",
        queryId: queryId1,
        value: "hi",
        logLines: [],
        journal: null,
      },
    ],
  });
  expect(state.hasSyncedPastLastReconnect()).toBe(false);

  // If we provide full results, then synced should go true
  state.transition({
    type: "Transition",
    startVersion: {
      querySet: 0,
      ts: Long.fromNumber(1000),
      identity: 0,
    },
    endVersion: {
      querySet: 0,
      ts: Long.fromNumber(1500),
      identity: 0,
    },
    modifications: [
      {
        type: "QueryUpdated",
        queryId: queryId2,
        value: "hi",
        logLines: [],
        journal: null,
      },
    ],
  });
  expect(state.hasSyncedPastLastReconnect()).toBe(true);
});

test("unsubscribe resets outstanding state older than restart", () => {
  const state = new LocalSyncState();
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Do one subscription.
  const sub1 = state.subscribe("hello:world", {});

  // Restart before we get results. This should flip synced to false.
  state.restart(new Set());
  expect(state.hasSyncedPastLastReconnect()).toBe(false);

  // Unsubscribe. This should flip synced back to true, even before getting result.
  sub1.unsubscribe();
  expect(state.hasSyncedPastLastReconnect()).toBe(true);
});

test("complete auth resets outstanding state older than restart", () => {
  const state = new LocalSyncState();
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Set auth
  state.setAuth("auth123");
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Restart before we get results. This should flip synced to false.
  state.restart(new Set());
  expect(state.hasSyncedPastLastReconnect()).toBe(false);

  // Mark auth completion
  state.markAuthCompletion();
  expect(state.hasSyncedPastLastReconnect()).toBe(true);
});

test("cleared auth resets outstanding state older than restart", () => {
  const state = new LocalSyncState();
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Set auth
  state.setAuth("auth123");
  expect(state.hasSyncedPastLastReconnect()).toBe(true);

  // Restart before we get results. This should flip synced to false.
  state.restart(new Set());
  expect(state.hasSyncedPastLastReconnect()).toBe(false);

  // Mark auth cleared
  state.clearAuth();
  expect(state.hasSyncedPastLastReconnect()).toBe(true);
});
