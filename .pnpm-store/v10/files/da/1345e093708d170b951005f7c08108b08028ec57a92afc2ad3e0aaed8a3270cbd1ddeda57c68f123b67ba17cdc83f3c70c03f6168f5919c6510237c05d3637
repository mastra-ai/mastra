import { useAuth0 } from "@auth0/auth0-react";
import React from "react";

import { ReactNode, useCallback, useMemo } from "react";
import { AuthTokenFetcher } from "../browser/sync/client.js";
import { ConvexProviderWithAuth } from "../react/ConvexAuthState.js";

// Until we can import from our own entry points (requires TypeScript 4.7),
// just describe the interface enough to help users pass the right type.
type IConvexReactClient = {
  setAuth(fetchToken: AuthTokenFetcher): void;
  clearAuth(): void;
};

/**
 * A wrapper React component which provides a {@link react.ConvexReactClient}
 * authenticated with Auth0.
 *
 * It must be wrapped by a configured `Auth0Provider` from `@auth0/auth0-react`.
 *
 * See [Convex Auth0](https://docs.convex.dev/auth/auth0) on how to set up
 * Convex with Auth0.
 *
 * @public
 */
export function ConvexProviderWithAuth0({
  children,
  client,
}: {
  children: ReactNode;
  client: IConvexReactClient;
}) {
  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuthFromAuth0}>
      {children}
    </ConvexProviderWithAuth>
  );
}

function useAuthFromAuth0() {
  const { isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        const response = await getAccessTokenSilently({
          detailedResponse: true,
          cacheMode: forceRefreshToken ? "off" : "on",
        });
        return response.id_token as string;
      } catch {
        return null;
      }
    },
    [getAccessTokenSilently],
  );
  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
}
