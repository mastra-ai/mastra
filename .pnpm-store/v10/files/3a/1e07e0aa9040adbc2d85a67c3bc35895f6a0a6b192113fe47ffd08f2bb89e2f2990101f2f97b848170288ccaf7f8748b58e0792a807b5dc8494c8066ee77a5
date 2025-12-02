"use strict";
import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";
import { ConvexProvider } from "./client.js";
const ConvexAuthContext = createContext(void 0);
export function useConvexAuth() {
  const authContext = useContext(ConvexAuthContext);
  if (authContext === void 0) {
    throw new Error(
      "Could not find `ConvexProviderWithAuth` (or `ConvexProviderWithClerk` or `ConvexProviderWithAuth0`) as an ancestor component. This component may be missing, or you might have two instances of the `convex/react` module loaded in your project."
    );
  }
  return authContext;
}
export function ConvexProviderWithAuth({
  children,
  client,
  useAuth
}) {
  const {
    isLoading: authProviderLoading,
    isAuthenticated: authProviderAuthenticated,
    fetchAccessToken
  } = useAuth();
  const [isConvexAuthenticated, setIsConvexAuthenticated] = useState(null);
  if (authProviderLoading && isConvexAuthenticated !== null) {
    setIsConvexAuthenticated(null);
  }
  if (!authProviderLoading && !authProviderAuthenticated && isConvexAuthenticated !== false) {
    setIsConvexAuthenticated(false);
  }
  return /* @__PURE__ */ React.createElement(
    ConvexAuthContext.Provider,
    {
      value: {
        isLoading: isConvexAuthenticated === null,
        isAuthenticated: authProviderAuthenticated && (isConvexAuthenticated ?? false)
      }
    },
    /* @__PURE__ */ React.createElement(
      ConvexAuthStateFirstEffect,
      {
        authProviderAuthenticated,
        fetchAccessToken,
        authProviderLoading,
        client,
        setIsConvexAuthenticated
      }
    ),
    /* @__PURE__ */ React.createElement(ConvexProvider, { client }, children),
    /* @__PURE__ */ React.createElement(
      ConvexAuthStateLastEffect,
      {
        authProviderAuthenticated,
        fetchAccessToken,
        authProviderLoading,
        client,
        setIsConvexAuthenticated
      }
    )
  );
}
function ConvexAuthStateFirstEffect({
  authProviderAuthenticated,
  fetchAccessToken,
  authProviderLoading,
  client,
  setIsConvexAuthenticated
}) {
  useEffect(() => {
    let isThisEffectRelevant = true;
    if (authProviderAuthenticated) {
      client.setAuth(fetchAccessToken, (backendReportsIsAuthenticated) => {
        if (isThisEffectRelevant) {
          setIsConvexAuthenticated(() => backendReportsIsAuthenticated);
        }
      });
      return () => {
        isThisEffectRelevant = false;
        setIsConvexAuthenticated(
          (isConvexAuthenticated) => isConvexAuthenticated ? false : null
        );
      };
    }
  }, [
    authProviderAuthenticated,
    fetchAccessToken,
    authProviderLoading,
    client,
    setIsConvexAuthenticated
  ]);
  return null;
}
function ConvexAuthStateLastEffect({
  authProviderAuthenticated,
  fetchAccessToken,
  authProviderLoading,
  client,
  setIsConvexAuthenticated
}) {
  useEffect(() => {
    if (authProviderAuthenticated) {
      return () => {
        client.clearAuth();
        setIsConvexAuthenticated(() => null);
      };
    }
  }, [
    authProviderAuthenticated,
    fetchAccessToken,
    authProviderLoading,
    client,
    setIsConvexAuthenticated
  ]);
  return null;
}
//# sourceMappingURL=ConvexAuthState.js.map
