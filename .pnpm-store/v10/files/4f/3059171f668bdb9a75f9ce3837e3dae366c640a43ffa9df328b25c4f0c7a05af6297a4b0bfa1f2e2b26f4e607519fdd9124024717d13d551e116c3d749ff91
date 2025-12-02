/**
 * @vitest-environment custom-vitest-environment.ts
 */
import { expect, vi, test } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { jwtEncode } from "../vendor/jwt-encode/index.js";
import React, { createContext, useCallback, useContext, useMemo } from "react";
import {
  ConvexProviderWithAuth,
  ConvexReactClient,
  useConvexAuth,
} from "./index.js";

vi.useFakeTimers();

const flushPromises = async () => {
  const timers = await vi.importActual("timers");
  await act(() => new Promise((timers as any).setImmediate));
};

test("setAuth legacy signature typechecks and doesn't throw", async () => {
  const convex = new ConvexReactClient("https://127.0.0.1:3001");
  // We're moving towards removing the Promise, but for backwards compatibility
  // it's still here now.
  await convex.setAuth(async () => "foo");
});

test("ConvexProviderWithAuth works", async () => {
  // This is our fake ProviderX state
  const AuthProviderXContext = createContext<{
    isLoading: boolean;
    isAuthenticated: boolean;
    getToken: (args: { ignoreCache: boolean }) => Promise<string | null>;
  }>(null as any);

  // Fake ProviderX React hook
  const useProviderXAuth = () => {
    return useContext(AuthProviderXContext);
  };

  // What our users would have to write, this is the same as in docs
  // but works in TypeScript. We should transpile this back to JS
  // and use it as a snippet in docs.
  function useAuthFromProviderX() {
    const { isLoading, isAuthenticated, getToken } = useProviderXAuth();
    const fetchAccessToken = useCallback(
      async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
        // Here you can do whatever transformation to get the ID Token
        // or null
        // Make sure to fetch a new token when `forceRefreshToken` is true
        return await getToken({ ignoreCache: forceRefreshToken });
      },
      // If `getToken` isn't correctly memoized
      // remove it from this dependency array
      [getToken],
    );
    return useMemo(
      () => ({
        // Whether the auth provider is in a loading state
        isLoading: isLoading,
        // Whether the auth provider has the user signed in
        isAuthenticated: isAuthenticated ?? false,
        // The async function to fetch the ID token
        fetchAccessToken,
      }),
      [isLoading, isAuthenticated, fetchAccessToken],
    );
  }

  const convex = new ConvexReactClient("https://127.0.0.1:3001");

  // Our app will mirror the Convex auth state
  const App = () => {
    const { isLoading, isAuthenticated } = useConvexAuth();
    return (
      <>
        {isLoading
          ? "Loading..."
          : isAuthenticated
            ? "Authenticated"
            : "Unauthenticated"}
      </>
    );
  };

  const element = (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromProviderX}>
      <App />
    </ConvexProviderWithAuth>
  );

  const { rerender } = render(
    <AuthProviderXContext.Provider
      value={{
        isLoading: true,
        isAuthenticated: false,
        getToken: async () => null,
      }}
    >
      {element}
    </AuthProviderXContext.Provider>,
  );
  expect(screen.getByText("Loading...")).toBeDefined();

  const token = jwtEncode({ iat: 1234500, exp: 1234500 + 30 }, "secret");

  rerender(
    <AuthProviderXContext.Provider
      value={{
        isLoading: false,
        isAuthenticated: true,
        getToken: async () => token,
      }}
    >
      {element}
    </AuthProviderXContext.Provider>,
  );
  expect(screen.getByText("Loading...")).toBeDefined();

  vi.runOnlyPendingTimers();

  await flushPromises();

  mockServerConfirmsAuth(convex, 0);

  expect(screen.getByText("Authenticated")).toBeDefined();
});

// This is no longer really possible, because
// we wait on server response before scheduling token refetch,
// and the server currently requires JWT tokens.
test("Tokens must be valid JWT", async () => {
  const client = new ConvexReactClient("https://127.0.0.1:3001");
  const consoleSpy = vi
    .spyOn(global.console, "error")
    .mockImplementation(() => {
      // Do nothing
    });

  let tokenId = 0;
  void client.setAuth(
    async () => "foo" + tokenId++, // simulate a new token on every fetch
    () => {
      // Do nothing
    },
  );

  // Wait for token
  await flushPromises();

  // Server confirms it
  mockServerConfirmsAuth(client, 0);

  // Wait for token with `forceRefreshToken: true`
  await flushPromises();

  // Server confirms it
  mockServerConfirmsAuth(client, 1);

  expect(consoleSpy).toHaveBeenCalledWith(
    "Auth token is not a valid JWT, cannot refetch the token",
  );
});

test("Tokens are used to schedule refetch", async () => {
  const client = new ConvexReactClient("https://127.0.0.1:3001");
  const tokenLifetimeSeconds = 60;
  let tokenId = 0;
  const tokenFetcher = vi.fn(async () =>
    jwtEncode(
      { iat: 1234500, exp: 1234500 + tokenLifetimeSeconds },
      "secret" + tokenId++, // simulate a new token on every fetch
    ),
  );
  void client.setAuth(tokenFetcher, () => {
    // Do nothing
  });

  // Wait for token
  await flushPromises();

  // Server confirms it
  mockServerConfirmsAuth(client, 0);

  // Wait for token with `forceRefreshToken: true`
  await flushPromises();

  // Confirm refetched token
  mockServerConfirmsAuth(client, 1);

  expect(tokenFetcher).toHaveBeenCalledTimes(2);

  // Check that next refetch happens in time
  vi.advanceTimersByTime(tokenLifetimeSeconds * 1000);
  expect(tokenFetcher).toHaveBeenCalledTimes(3);
});

function mockServerConfirmsAuth(
  client: ConvexReactClient,
  oldIdentityVersion: number,
) {
  act(() => {
    const querySetVersion = client.sync["remoteQuerySet"]["version"];
    client.sync["authenticationManager"].onTransition({
      type: "Transition",
      startVersion: {
        ...querySetVersion,
        identity: oldIdentityVersion,
      },
      endVersion: {
        ...querySetVersion,
        identity: oldIdentityVersion + 1,
      },
      modifications: [],
    });
  });
}
