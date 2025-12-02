"use strict";
import React from "react";
import { useCallback, useMemo } from "react";
import { ConvexProviderWithAuth } from "../react/ConvexAuthState.js";
export function ConvexProviderWithClerk({
  children,
  client,
  useAuth
}) {
  const useAuthFromClerk = useUseAuthFromClerk(useAuth);
  return /* @__PURE__ */ React.createElement(ConvexProviderWithAuth, { client, useAuth: useAuthFromClerk }, children);
}
function useUseAuthFromClerk(useAuth) {
  return useMemo(
    () => function useAuthFromClerk() {
      const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth();
      const fetchAccessToken = useCallback(
        async ({ forceRefreshToken }) => {
          try {
            return await getToken({
              template: "convex",
              skipCache: forceRefreshToken
            });
          } catch {
            return null;
          }
        },
        // Build a new fetchAccessToken to trigger setAuth() whenever these change.
        // Anything else from the JWT Clerk wants to be reactive goes here too.
        // Clerk's Expo useAuth hook is not memoized so we don't include getToken.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orgId, orgRole]
      );
      return useMemo(
        () => ({
          isLoading: !isLoaded,
          isAuthenticated: isSignedIn ?? false,
          fetchAccessToken
        }),
        [isLoaded, isSignedIn, fetchAccessToken]
      );
    },
    [useAuth]
  );
}
//# sourceMappingURL=ConvexProviderWithClerk.js.map
