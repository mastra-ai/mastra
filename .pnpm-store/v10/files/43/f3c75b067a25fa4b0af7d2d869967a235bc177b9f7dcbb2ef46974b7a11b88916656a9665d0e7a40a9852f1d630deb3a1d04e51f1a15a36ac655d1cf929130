/**
 * @vitest-environment custom-vitest-environment.ts
 */
import { expect, vi, test, describe } from "vitest";
import { jwtEncode } from "../vendor/jwt-encode/index.js";
import {
  nodeWebSocket,
  withInMemoryWebSocket,
} from "../browser/sync/client_node_test_helpers.js";
import { ConvexReactClient, ConvexReactClientOptions } from "./index.js";
import waitForExpect from "wait-for-expect";
import { anyApi } from "../server/index.js";
import { Long } from "../vendor/long.js";
import {
  AuthError,
  ClientMessage,
  WireServerMessage,
} from "../browser/sync/protocol.js";

const testReactClient = (address: string, options?: ConvexReactClientOptions) =>
  new ConvexReactClient(address, {
    webSocketConstructor: nodeWebSocket,
    unsavedChangesWarning: false,
    ...options,
  });

// Disabled due to flakes in CI
// https://linear.app/convex/issue/ENG-7052/re-enable-auth-websocket-client-tests

// On Linux these can retry forever due to EADDRINUSE so run then sequentially.
describe.sequential.skip("auth websocket tests", () => {
  // This is the path usually taken on page load after a user logged in,
  // with a constant token provider.
  test("Authenticate via valid static token", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send }) => {
      const client = testReactClient(address);

      const tokenFetcher = vi.fn(async () =>
        jwtEncode({ iat: 1234500, exp: 1244500 }, "secret"),
      );
      const onAuthChange = vi.fn();
      client.setAuth(tokenFetcher, onAuthChange);

      expect((await receive()).type).toEqual("Connect");
      expect((await receive()).type).toEqual("Authenticate");
      expect((await receive()).type).toEqual("ModifyQuerySet");

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      send({
        type: "Transition",
        startVersion: querySetVersion,
        endVersion: {
          ...querySetVersion,
          // Client started at 0
          // Good token advanced to 1
          identity: 1,
        },
        modifications: [],
      });

      await waitForExpect(() => {
        expect(onAuthChange).toHaveBeenCalledTimes(1);
      });
      await client.close();

      expect(tokenFetcher).toHaveBeenCalledWith({ forceRefreshToken: false });
      expect(onAuthChange).toHaveBeenCalledTimes(1);
      expect(onAuthChange).toHaveBeenCalledWith(true);
    });
  });

  // This happens when a user opens a page after their cached token expired
  test("Reauthenticate after token expiration with versioning", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send, close }) => {
      const client = testReactClient(address);

      let token = jwtEncode({ iat: 1234500, exp: 1244500 }, "wobabloobla");
      const fetchToken = async () => token;
      const tokenFetcher = vi.fn(fetchToken);
      const onAuthChange = vi.fn();
      client.setAuth(tokenFetcher, onAuthChange);

      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: token,
      });

      // Token must change, otherwise client will not try to reauthenticate
      token = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret");

      await simulateAuthError({
        send,
        close,
        authError: {
          type: "AuthError",
          error: "bla",
          baseVersion: 0,
          authUpdateAttempted: true,
        },
      });

      // The client reconnects automatically
      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: token,
      });

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      // Server accepts new token
      send({
        type: "Transition",
        startVersion: querySetVersion,
        endVersion: {
          ...querySetVersion,
          identity: 1,
        },
        modifications: [],
      });

      await waitForExpect(() => {
        expect(onAuthChange).toHaveBeenCalledTimes(1);
      });
      await client.close();

      expect(tokenFetcher).toHaveBeenNthCalledWith(1, {
        forceRefreshToken: false,
      });
      expect(tokenFetcher).toHaveBeenNthCalledWith(2, {
        forceRefreshToken: true,
      });
      expect(onAuthChange).toHaveBeenCalledWith(true);
    });
  });

  // This happens when a user opens a page and they cannot
  // fetch from a cache (say due to Prevent Cross Site tracking)
  test("Reauthenticate after token cache failure", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send }) => {
      const client = testReactClient(address);

      const freshToken = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret");
      const tokenFetcher = vi.fn(
        async (args: { forceRefreshToken: boolean }) => {
          if (args.forceRefreshToken) {
            return freshToken;
          }
          return null;
        },
      );
      const onAuthChange = vi.fn();
      void client.setAuth(tokenFetcher, onAuthChange);

      // The client authenticates after the token refetch
      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: freshToken,
      });

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      // Server accepts new token
      send({
        type: "Transition",
        startVersion: querySetVersion,
        endVersion: {
          ...querySetVersion,
          identity: 1,
        },
        modifications: [],
      });

      await waitForExpect(() => {
        expect(onAuthChange).toHaveBeenCalledTimes(1);
      });
      await client.close();

      expect(tokenFetcher).toHaveBeenNthCalledWith(1, {
        forceRefreshToken: false,
      });
      expect(tokenFetcher).toHaveBeenNthCalledWith(2, {
        forceRefreshToken: true,
      });
      expect(onAuthChange).toHaveBeenCalledWith(true);
    });
  });

  // This is usually a misconfigured server rejecting any token
  test("Fail when tokens are always rejected", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send, close }) => {
      const client = testReactClient(address);

      const consoleSpy = vi
        .spyOn(global.console, "error")
        .mockImplementation(() => {
          // Do nothing
        });

      const token1 = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret1");
      const token2 = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret2");
      const token3 = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret3");
      const token4 = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret4");

      const tokens = [token1, token2, token3, token4];

      const tokenFetcher = vi.fn(async () => tokens.shift());
      const onAuthChange = vi.fn();
      client.setAuth(tokenFetcher, onAuthChange);

      expect((await receive()).type).toEqual("Connect");
      assertAuthenticateMessage(await receive(), {
        baseVersion: 0,
        token: token1,
      });
      expect((await receive()).type).toEqual("ModifyQuerySet");

      send({
        type: "AuthError",
        error: "bla",
        baseVersion: 0,
        authUpdateAttempted: true,
      });
      close();

      // The client reconnects automatically and retries twice
      expect((await receive()).type).toEqual("Connect");
      assertAuthenticateMessage(await receive(), {
        baseVersion: 0,
        token: token2,
      });
      expect((await receive()).type).toEqual("ModifyQuerySet");

      const AUTH_ERROR_MESSAGE = "bada boom";
      send({
        type: "AuthError",
        error: AUTH_ERROR_MESSAGE,
        baseVersion: 0,
        authUpdateAttempted: true,
      });
      close();

      expect((await receive()).type).toEqual("Connect");
      assertAuthenticateMessage(await receive(), {
        baseVersion: 0,
        token: token3,
      });
      expect((await receive()).type).toEqual("ModifyQuerySet");

      send({
        type: "AuthError",
        error: AUTH_ERROR_MESSAGE,
        baseVersion: 0,
        authUpdateAttempted: true,
      });
      close();

      expect((await receive()).type).toEqual("Connect");
      assertAuthenticateMessage(await receive(), {
        baseVersion: 0,
        token: token4,
      });
      expect((await receive()).type).toEqual("ModifyQuerySet");

      send({
        type: "AuthError",
        error: AUTH_ERROR_MESSAGE,
        baseVersion: 0,
        authUpdateAttempted: true,
      });
      close();

      // The client reconnects automatically (but without auth)
      expect((await receive()).type).toEqual("Connect");
      expect((await receive()).type).toEqual("ModifyQuerySet");
      await client.close();

      expect(onAuthChange).toHaveBeenCalledTimes(1);
      expect(onAuthChange).toHaveBeenCalledWith(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        `Failed to authenticate: "${AUTH_ERROR_MESSAGE}", check your server auth config`,
      );
    });
  });

  // This happens when "refresh token"s expired - auth provider client thinks
  // it's authed but it cannot fetch a token at all.
  test("Fail when tokens cannot be fetched", async () => {
    await withInMemoryWebSocket(async ({ address, receive }) => {
      const client = testReactClient(address);
      const tokenFetcher = vi.fn(async () => null);
      const onAuthChange = vi.fn();
      void client.setAuth(tokenFetcher, onAuthChange);

      expect((await receive()).type).toEqual("Connect");
      expect((await receive()).type).toEqual("ModifyQuerySet");

      await waitForExpect(() => {
        expect(onAuthChange).toHaveBeenCalledTimes(1);
      });
      await client.close();

      expect(onAuthChange).toHaveBeenCalledTimes(1);
      expect(onAuthChange).toHaveBeenCalledWith(false);
    });
  });

  test("Client is protected against token rejection race", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send, close }) => {
      const client = testReactClient(address);

      const badToken = jwtEncode({ iat: 1234500, exp: 1244500 }, "wobalooba");
      const badTokenFetcher = vi.fn(async () => badToken);
      const firstOnChange = vi.fn();
      client.setAuth(badTokenFetcher, firstOnChange);

      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: badToken,
      });

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      const goodToken = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret");
      const goodTokenFetcher = vi.fn(async () => goodToken);

      const secondOnChange = vi.fn();
      client.setAuth(goodTokenFetcher, secondOnChange);

      assertAuthenticateMessage(await receive(), {
        baseVersion: 1,
        token: goodToken,
      });

      // This is the current server AuthError sequence:
      // send a message and close the connection.
      await simulateAuthError({
        send,
        close,
        authError: {
          type: "AuthError",
          error: "bla",
          baseVersion: 0,
          authUpdateAttempted: true,
        },
      });

      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: goodToken,
      });

      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion,
          // Client started at 0 after reconnect
          identity: 0,
        },
        endVersion: {
          ...querySetVersion,
          // Good token advanced to 1
          identity: 1,
        },
        modifications: [],
      });

      await waitForExpect(() => {
        expect(secondOnChange).toHaveBeenCalledTimes(1);
      });
      await client.close();

      expect(firstOnChange).toHaveBeenCalledTimes(0);
      expect(secondOnChange).toHaveBeenCalledWith(true);
    });
  });

  // This is a race condition where a delayed auth error from a non-auth message
  // comes back while the client is waiting for server validation of the new token.
  test("Client ignores non-auth responses for token validation", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send, close }) => {
      const client = testReactClient(address);
      const ts = Math.ceil(Date.now() / 1000);
      const initialToken = jwtEncode({ iat: ts, exp: ts + 1000 }, "token1");
      const freshToken = jwtEncode({ iat: ts, exp: ts + 1000 }, "token2");
      const tokens = [initialToken, freshToken];
      const tokenFetcher = vi.fn(async (_opts) => tokens.shift()!);
      const onChange = vi.fn();
      // This will immediately send the `initialToken` to the server (treating it as
      // a token cached in local storage / other memory), and then asynchronously
      // fetch `freshToken`, as a "fresh" token, and send that in a future `Authenticate`
      // message.
      client.setAuth(tokenFetcher, onChange);

      // Messages for initial connection + handling `initialToken`
      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: initialToken,
      });

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion,
          identity: 0,
        },
        endVersion: {
          ...querySetVersion,
          identity: 1,
        },
        modifications: [],
      });

      // Message from the client containing `freshToken`
      assertAuthenticateMessage(await receive(), {
        baseVersion: 1,
        token: freshToken,
      });

      // The client's sync state should still be on version 1, because we haven't transitioned
      // to the new token yet. But the AuthenticationManager should be in the state `waitingForServerConfirmationOfFreshToken`

      // The server may send an auth error for version 1 before it has processed the
      // `Authenticate` message for version 2.

      // One way this can happen is a query re-executing (i.e. because the data changed) and noticing
      // that the current auth has expired. This should have `authUpdateAttempted: false` because
      // the server has not yet processed the `Authenticate` message for version 2.
      await simulateAuthError({
        send,
        close,
        authError: {
          type: "AuthError",
          error: "bla",
          baseVersion: 1,
          authUpdateAttempted: false,
        },
      });

      // However, on the next reconnect, it should send `freshToken` to complete the token exchange.
      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: freshToken,
      });

      const querySetVersion2 = client.sync["remoteQuerySet"]["version"];

      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion2,
          identity: 0,
        },
        endVersion: {
          ...querySetVersion2,
          identity: 1,
        },
        modifications: [],
      });

      // Flush
      await new Promise((resolve) => setTimeout(resolve));
      await client.close();

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenNthCalledWith(1, true);
      // Without proper handling, this second call will be false
      expect(onChange).toHaveBeenNthCalledWith(2, true);
    }, true);
  });

  // This is a race condition where a connection stopped by reauthentication
  // never restarts due to reauthentication exiting early. This happens when
  // an additional refetch begins while reauthentication is still running,
  // such as with a scheduled refetch.
  test("Client maintains connection when refetch occurs during reauth attempt", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send, close }) => {
      vi.useFakeTimers();
      const client = testReactClient(address);
      // In this test we're going to simulate `fetchToken` taking a long time (1s)
      // so we can test race conditions, so the issued time will be 1s after the
      // fetched time.

      // Tokens in this test will expire 3s after they are issued, and we're relying
      // on the default 2s refresh leeway which means the scheduled refetch will
      // start 1s after the token is issued.

      const nowInSeconds = Math.ceil(Date.now() / 1000);
      // existing token, the times shouldn't matter since we immediately fetch a fresh token
      const initialToken = jwtEncode(
        { iat: nowInSeconds - 10, exp: nowInSeconds + 10 },
        "initialToken",
      );
      // fresh token, fetched at ts=1
      const freshToken = jwtEncode(
        { iat: nowInSeconds + 1, exp: nowInSeconds + 4 },
        "freshToken",
      );
      // scheduled refetch at ts=2 (2s before freshToken expires), but with a 1s delay
      const scheduledRefetchToken = jwtEncode(
        { iat: nowInSeconds + 3, exp: nowInSeconds + 6 },
        "scheduledRefetchToken",
      );
      // fetched at ts 1.5 in response to an auth error, issued at ts=2.5
      const reauthToken = jwtEncode(
        { iat: nowInSeconds + 2.5, exp: nowInSeconds + 5.5 },
        "reauthToken",
      );
      const tokens = [
        initialToken,
        freshToken,
        reauthToken,
        scheduledRefetchToken,
      ];
      const tokenFetcher = vi.fn(
        async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
          const token = tokens.shift();
          if (forceRefreshToken === false) {
            if (token !== initialToken) {
              throw new Error(
                "scheduledRefetchToken should be fetched with forceRefreshToken=true",
              );
            }
            return token;
          }

          vi.advanceTimersByTime(1000);
          return token;
        },
      );
      const onChange = vi.fn((isAuthenticated: boolean) => {
        if (!isAuthenticated) {
          throw new Error("Client is unexpectedly unauthenticated");
        }
      });
      client.setAuth(tokenFetcher, onChange);

      // Initial connection, sending `initialToken`
      // ts=0
      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: initialToken,
      });
      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion,
          identity: 0,
        },
        endVersion: {
          ...querySetVersion,
          identity: 1,
        },
        modifications: [],
      });

      // Immediately fetch a a fresh token (`freshToken`).
      // `freshToken` expires at ts=4
      // We will also schedule a refetch at ts=2 (2s before `freshToken` expires)
      assertAuthenticateMessage(await receive(), {
        baseVersion: 1,
        token: freshToken,
      });

      // Server confirms `freshToken` and transitions to version 2
      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion,
          identity: 1,
        },
        endVersion: {
          ...querySetVersion,
          identity: 2,
        },
        modifications: [],
      });

      vi.advanceTimersByTime(500);

      // ts=1.5
      // `freshToken` becomes stale before the client has a chance to fetch and send
      // `scheduledRefetchToken` (e.g. because the page is backgrounded or because `fetchToken` is slow
      // for some reason), so the server hits an AuthError.
      await simulateAuthError({
        send,
        close,
        authError: {
          type: "AuthError",
          error: "bla",
          baseVersion: 2,
          authUpdateAttempted: false,
        },
      });

      // In response to this error, we call `tryToReauthenticate`.
      // Let's say `this.configVersion` is X
      // This will first stop the websocket, which bumps the configVersion to X+1
      // This'll call `fetchAndGuardAgainstRace`, which bumps `this.configVersion` to X+2
      // and sets `originalConfigVersion=X+2` locally
      // Then it starts fetching `reauthToken` at ts=1.5 and it will finish at ts=2.5.

      // At ts=2, we expect the scheduled token fetch to start.
      // This calls `fetchAndGuardAgainstRace`, which bumps `this.configVersion` to X+3
      // and sets `originalConfigVersion=X+3` locally

      // At ts=2.5, we get a result from `fetchToken` from the `fetchAndGuardAgainstRace` call
      // in tryToReauthenticate.
      // However, the config version no longer matches, so we return { isFromOutdatedConfig: true }
      // and exit from tryToReauthenticate early. Notably, before `tryRestartSocket` is called,
      // so the connection is still stopped.

      // At ts=3, we get a result from `fetchToken` from the scheduled refetch.
      // This time we return the token since the config version matches.

      // Previously, `refetchToken` would not call `tryRestartSocket`, so the WS would
      // stay stopped.

      // Now that `tryRestartSocket` is called, we should expect to see an Authenticate
      // message with `scheduledRefetchToken`
      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: scheduledRefetchToken,
      });

      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion,
          identity: 0,
        },
        endVersion: {
          ...querySetVersion,
          identity: 1,
        },
        modifications: [],
      });

      await client.close();
      vi.useRealTimers();

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenNthCalledWith(1, true);
      expect(onChange).toHaveBeenNthCalledWith(2, true);
    });
  });

  // When awaiting server confirmation of a fresh token, a subsequent
  // auth error (from an Authenticate request) will cause the client to go to
  // an unauthenticated state. This test covers a race condition where an
  // Authenticate request for a fresh token is sent, and then the client app
  // goes to background and misses the Transition response. If the client
  // becomes active after the new token has expired, a new Authenticate request
  // will be sent with the expired token, leading to an error response and
  // unauthenticated state.
  test("Client retries token validation on error", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send, close }) => {
      const client = testReactClient(address);
      const ts = Math.ceil(Date.now() / 1000);
      const token1 = jwtEncode({ iat: ts, exp: ts + 60 }, "token1");
      const token2 = jwtEncode({ iat: ts, exp: ts + 60 }, "token2");
      const token3 = jwtEncode({ iat: ts, exp: ts + 60 }, "token3");
      const tokens = [token1, token2, token3];
      const tokenFetcher = vi.fn(async (_opts) => tokens.shift()!);
      const onChange = vi.fn();
      client.setAuth(tokenFetcher, onChange);

      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: token1,
      });

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion,
          identity: 0,
        },
        endVersion: {
          ...querySetVersion,
          identity: 1,
        },
        modifications: [],
      });

      assertAuthenticateMessage(await receive(), {
        baseVersion: 1,
        token: token2,
      });

      // Simulating an auth error while waiting for server confirmation of a
      // fresh token.
      await simulateAuthError({
        send,
        close,
        authError: {
          type: "AuthError",
          error: "bla",
          baseVersion: 1,
          authUpdateAttempted: true,
        },
      });
      // The client should reattempt reauthentication.
      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: token3,
      });
      send({
        type: "Transition",
        startVersion: {
          ...querySetVersion,
          identity: 0,
        },
        endVersion: {
          ...querySetVersion,
          identity: 1,
        },
        modifications: [],
      });

      // Flush
      await new Promise((resolve) => setTimeout(resolve));
      await client.close();

      expect(tokenFetcher).toHaveBeenCalledTimes(3);
      // Initial setConfig
      expect(tokenFetcher).toHaveBeenNthCalledWith(1, {
        forceRefreshToken: false,
      });
      // Initial fresh token fetch
      expect(tokenFetcher).toHaveBeenNthCalledWith(2, {
        forceRefreshToken: true,
      });
      // Reauth second attempt
      expect(tokenFetcher).toHaveBeenNthCalledWith(3, {
        forceRefreshToken: true,
      });
      expect(onChange).toHaveBeenCalledTimes(2);
      // Initial setConfig
      expect(onChange).toHaveBeenNthCalledWith(1, true);
      // Reauth second attempt
      expect(onChange).toHaveBeenNthCalledWith(2, true);
    });
  });

  test("Authentication runs first", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send }) => {
      const client = testReactClient(address);

      const token1 = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret");
      const tokenFetcher = vi.fn(async () => token1);
      client.setAuth(tokenFetcher);

      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: token1,
      });

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      send({
        type: "Transition",
        startVersion: querySetVersion,
        endVersion: {
          ...querySetVersion,
          // Client started at 0
          // Good token advanced to 1
          identity: 1,
        },
        modifications: [],
      });

      const token2 = jwtEncode({ iat: 1234550, exp: 1244550 }, "secret");
      const tokenFetcher2 = vi.fn(async () => token2);
      client.setAuth(tokenFetcher2);
      client.watchQuery(anyApi.myQuery.default).onUpdate(() => {});

      // Crucially Authenticate comes first!
      assertAuthenticateMessage(await receive(), {
        baseVersion: 1,
        token: token2,
      });
      expect((await receive()).type).toEqual("ModifyQuerySet");
    });
  });

  test("Auth pause doesn't prevent unsubscribing from queries", async () => {
    await withInMemoryWebSocket(async ({ address, receive, send }) => {
      const client = testReactClient(address);

      const token1 = jwtEncode({ iat: 1234500, exp: 1244500 }, "secret");
      const tokenFetcher = vi.fn(async () => token1);
      client.setAuth(tokenFetcher);

      const unsubscribe = client
        .watchQuery(anyApi.myQuery.default)
        .onUpdate(() => {});

      await assertReconnectWithAuth(receive, {
        baseVersion: 0,
        token: token1,
      });

      const querySetVersion = client.sync["remoteQuerySet"]["version"];

      send({
        type: "Transition",
        startVersion: querySetVersion,
        endVersion: {
          querySet: 1,
          identity: 1,
          ts: Long.fromNumber(1),
        },
        modifications: [
          {
            type: "QueryUpdated",
            queryId: 0,
            value: 42,
            logLines: [],
            journal: null,
          },
        ],
      });

      await waitForExpect(() => {
        expect(client.sync["remoteQuerySet"]["version"].identity).toEqual(1);
      });

      let resolve: (value: string) => void;
      const tokenFetcher2 = vi.fn(
        () =>
          new Promise<string>((r) => {
            resolve = r;
          }),
      );
      // Set new auth
      client.setAuth(tokenFetcher2);

      // Unsubscribe
      unsubscribe();

      // Finish fetching the token
      const token2 = jwtEncode({ iat: 1234550, exp: 1244550 }, "secret");
      resolve!(token2);

      // Crucially Authenticate comes first!
      assertAuthenticateMessage(await receive(), {
        baseVersion: 1,
        token: token2,
      });
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Remove", queryId: 0 }],
        baseVersion: 1,
      });

      // Make sure we are now unpaused

      client.watchQuery(anyApi.myQuery.default).onUpdate(() => {});

      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 1 }],
        baseVersion: 2,
      });

      client.watchQuery(anyApi.myQuery.foo).onUpdate(() => {});

      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 2 }],
        baseVersion: 3,
      });
    });
  });

  test("Local state resume doesn't cause duplicate AddQuery", async () => {
    await withInMemoryWebSocket(async ({ address, receive }) => {
      const client = testReactClient(address);

      // First we subscribe
      client.watchQuery(anyApi.myQuery.default).onUpdate(() => {});

      expect((await receive()).type).toEqual("Connect");
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 0 }],
        baseVersion: 0,
      });

      // Before the server confirms, we set auth, leading to pause
      // and unpause.
      const tokenFetcher = vi.fn(async () =>
        jwtEncode({ iat: 1234500, exp: 1244500 }, "secret"),
      );
      client.setAuth(tokenFetcher);

      // We should only send Authenticate, since we already
      // sent the Add modification
      expect(await receive()).toMatchObject({
        type: "Authenticate",
        baseVersion: 0,
      });

      // Subscribe again
      client
        .watchQuery(anyApi.myQuery.default, { foo: "bla" })
        .onUpdate(() => {});
      // Now we're sending the second query, not the first!
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 1 }],
        baseVersion: 1,
      });
    });
  });

  test("Local state resume doesn't send both Add and Remove", async () => {
    await withInMemoryWebSocket(async ({ address, receive }) => {
      const client = testReactClient(address);

      // First we subscribe to kick off connect.
      client.watchQuery(anyApi.myQuery.default).onUpdate(() => {});

      expect((await receive()).type).toEqual("Connect");
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 0 }],
        baseVersion: 0,
      });

      // Set slow auth, causing pause
      let resolve: (value: string) => void;
      const tokenFetcher2 = vi.fn(
        () =>
          new Promise<string>((r) => {
            resolve = r;
          }),
      );
      client.setAuth(tokenFetcher2);

      // Subscribe to second query, while paused
      const unsubscribe = client
        .watchQuery(anyApi.myQuery.default, { foo: "bla" })
        .onUpdate(() => {});

      // Subscribe third query, while paused
      client
        .watchQuery(anyApi.myQuery.default, { foo: "da" })
        .onUpdate(() => {});

      // Unsubscribe from second query, while paused
      unsubscribe();

      // Unpause ie resume
      resolve!(jwtEncode({ iat: 1234550, exp: 1244550 }, "secret"));

      // We authenticate first
      expect(await receive()).toMatchObject({
        type: "Authenticate",
        baseVersion: 0,
      });

      // We subscribe to the third query only!
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 2 }],
        baseVersion: 1,
      });
    });
  });

  test("Local state resume refcounts", async () => {
    await withInMemoryWebSocket(async ({ address, receive }) => {
      const client = testReactClient(address);

      // First we subscribe to kick off connect.
      client.watchQuery(anyApi.myQuery.default).onUpdate(() => {});

      expect((await receive()).type).toEqual("Connect");
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 0 }],
        baseVersion: 0,
      });

      // Set slow auth, causing pause
      let resolve: (value: string) => void;
      const tokenFetcher2 = vi.fn(
        () =>
          new Promise<string>((r) => {
            resolve = r;
          }),
      );
      client.setAuth(tokenFetcher2);

      // Subscribe to second query, while paused
      const unsubscribe = client
        .watchQuery(anyApi.myQuery.default, { foo: "bla" })
        .onUpdate(() => {});

      // Subscribe to the same query, while paused
      client
        .watchQuery(anyApi.myQuery.default, { foo: "bla" })
        .onUpdate(() => {});

      // Unsubscribe once from the second query, while paused
      unsubscribe();

      // Unpause ie resume
      resolve!(jwtEncode({ iat: 1234550, exp: 1244550 }, "secret"));

      // We authenticate first
      expect(await receive()).toMatchObject({
        type: "Authenticate",
        baseVersion: 0,
      });

      // We subscribe to the second query, because there's still one subscriber
      // on it.
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        modifications: [{ type: "Add", queryId: 1 }],
        baseVersion: 1,
      });
    });
  });

  test("Local state restart doesn't send both Add and Remove", async () => {
    await withInMemoryWebSocket(async ({ address, receive }) => {
      const client = testReactClient(address);

      // Set slow auth, causing pause while connecting
      let resolve: (value: string) => void;
      const tokenFetcher2 = vi.fn(
        () =>
          new Promise<string>((r) => {
            resolve = r;
          }),
      );
      client.setAuth(tokenFetcher2);

      // Subscribe while paused and connecting
      const unsubscribe = client
        .watchQuery(anyApi.myQuery.default)
        .onUpdate(() => {});

      // Unsubscribe while paused and connecting
      unsubscribe();

      // Unpause
      resolve!(jwtEncode({ iat: 1234550, exp: 1244550 }, "secret"));

      expect((await receive()).type).toEqual("Connect");
      expect((await receive()).type).toEqual("Authenticate");
      expect(await receive()).toMatchObject({
        type: "ModifyQuerySet",
        baseVersion: 0,
        modifications: [],
      });
    });
  });
});

// When a client is created it can't necessarily have setAuth called
// on it right away: often that library needs some setup.
describe.sequential("authMode WebSocket", () => {
  test.each([false, true])("expectAuth: %s", async (expectAuth: boolean) => {
    await withInMemoryWebSocket(async ({ address, receive, close }) => {
      const client = testReactClient(
        address,
        expectAuth ? { expectAuth: true } : {},
      );

      // ConvexReactClient connect is lazy, you have to subscribe to
      // a query or otherwise make a request before anything happens.
      const _mutP = client.mutation(anyApi.myMutation.default, {});

      // If expectAuth isn't enabled, this kicks off connect etc.
      if (!expectAuth) {
        expect((await receive()).type).toBe("Connect");
        expect((await receive()).type).toBe("ModifyQuerySet");
        expect((await receive()).type).toBe("Mutation");
      } else {
        // but *nothing* happens if expectAuth is set.
      }

      let resolve: (value: string) => void;
      const tokenFetcher2 = vi.fn(
        () =>
          new Promise<string>((r) => {
            resolve = r;
          }),
      );
      const onAuthChange = vi.fn();
      client.setAuth(tokenFetcher2, onAuthChange);

      resolve!(jwtEncode({ iat: 1234550, exp: 1244550 }, "secret"));

      if (!expectAuth) {
        expect((await receive()).type).toBe("Authenticate");
      } else {
        // We're still paused until auth is returned
        expect((await receive()).type).toBe("Connect");
        expect((await receive()).type).toBe("Authenticate");
        expect((await receive()).type).toBe("ModifyQuerySet");
        expect((await receive()).type).toBe("Mutation");
      }

      await client.close();
      close();
    }, true);
  });
});

function assertAuthenticateMessage(
  message: ClientMessage,
  expected: {
    baseVersion: number;
    token: string;
  },
) {
  expect(message.type).toEqual("Authenticate");
  // (These errors are redundant, but are necessary for type narrowing)
  if (message.type !== "Authenticate") {
    throw new Error("Expected an Authenticate message");
  }
  expect(message.baseVersion).toEqual(expected.baseVersion);
  expect(message.tokenType).toEqual("User");
  if (message.tokenType !== "User") {
    throw new Error("Expected a User token");
  }
  expect(message.value).toEqual(expected.token);
}

async function assertReconnectWithAuth(
  receive: () => Promise<ClientMessage>,
  expectedAuth: {
    baseVersion: number;
    token: string;
  },
) {
  expect((await receive()).type).toEqual("Connect");
  assertAuthenticateMessage(await receive(), expectedAuth);
  expect((await receive()).type).toEqual("ModifyQuerySet");
}

async function simulateAuthError(args: {
  send: (message: WireServerMessage) => void;
  close: () => void;
  authError: AuthError;
}) {
  args.send({
    type: "AuthError",
    error: args.authError.error,
    baseVersion: args.authError.baseVersion,
    authUpdateAttempted: args.authError.authUpdateAttempted,
  });
  // The server always closes the connection after an AuthError
  args.close();
}
