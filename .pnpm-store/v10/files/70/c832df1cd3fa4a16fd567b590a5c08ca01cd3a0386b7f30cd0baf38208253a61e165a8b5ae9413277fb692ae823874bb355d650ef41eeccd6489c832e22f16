"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var ConvexAuthState_exports = {};
__export(ConvexAuthState_exports, {
  ConvexProviderWithAuth: () => ConvexProviderWithAuth,
  useConvexAuth: () => useConvexAuth
});
module.exports = __toCommonJS(ConvexAuthState_exports);
var import_react = __toESM(require("react"), 1);
var import_client2 = require("./client.js");
const ConvexAuthContext = (0, import_react.createContext)(void 0);
function useConvexAuth() {
  const authContext = (0, import_react.useContext)(ConvexAuthContext);
  if (authContext === void 0) {
    throw new Error(
      "Could not find `ConvexProviderWithAuth` (or `ConvexProviderWithClerk` or `ConvexProviderWithAuth0`) as an ancestor component. This component may be missing, or you might have two instances of the `convex/react` module loaded in your project."
    );
  }
  return authContext;
}
function ConvexProviderWithAuth({
  children,
  client,
  useAuth
}) {
  const {
    isLoading: authProviderLoading,
    isAuthenticated: authProviderAuthenticated,
    fetchAccessToken
  } = useAuth();
  const [isConvexAuthenticated, setIsConvexAuthenticated] = (0, import_react.useState)(null);
  if (authProviderLoading && isConvexAuthenticated !== null) {
    setIsConvexAuthenticated(null);
  }
  if (!authProviderLoading && !authProviderAuthenticated && isConvexAuthenticated !== false) {
    setIsConvexAuthenticated(false);
  }
  return /* @__PURE__ */ import_react.default.createElement(
    ConvexAuthContext.Provider,
    {
      value: {
        isLoading: isConvexAuthenticated === null,
        isAuthenticated: authProviderAuthenticated && (isConvexAuthenticated ?? false)
      }
    },
    /* @__PURE__ */ import_react.default.createElement(
      ConvexAuthStateFirstEffect,
      {
        authProviderAuthenticated,
        fetchAccessToken,
        authProviderLoading,
        client,
        setIsConvexAuthenticated
      }
    ),
    /* @__PURE__ */ import_react.default.createElement(import_client2.ConvexProvider, { client }, children),
    /* @__PURE__ */ import_react.default.createElement(
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
  (0, import_react.useEffect)(() => {
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
  (0, import_react.useEffect)(() => {
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
