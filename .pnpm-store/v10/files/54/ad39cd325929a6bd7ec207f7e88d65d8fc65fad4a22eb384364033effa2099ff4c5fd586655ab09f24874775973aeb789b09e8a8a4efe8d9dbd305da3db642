"use strict";
import { useAuth0 } from "@auth0/auth0-react";
import React from "react";
import { useCallback, useMemo } from "react";
import { ConvexProviderWithAuth } from "../react/ConvexAuthState.js";
export function ConvexProviderWithAuth0({
  children,
  client
}) {
  return /* @__PURE__ */ React.createElement(ConvexProviderWithAuth, { client, useAuth: useAuthFromAuth0 }, children);
}
function useAuthFromAuth0() {
  const { isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }) => {
      try {
        const response = await getAccessTokenSilently({
          detailedResponse: true,
          cacheMode: forceRefreshToken ? "off" : "on"
        });
        return response.id_token;
      } catch {
        return null;
      }
    },
    [getAccessTokenSilently]
  );
  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken]
  );
}
//# sourceMappingURL=ConvexProviderWithAuth0.js.map
