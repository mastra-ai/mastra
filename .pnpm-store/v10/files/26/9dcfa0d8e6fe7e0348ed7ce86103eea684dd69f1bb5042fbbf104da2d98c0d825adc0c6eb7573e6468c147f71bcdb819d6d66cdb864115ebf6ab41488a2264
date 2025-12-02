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
var ConvexProviderWithClerk_exports = {};
__export(ConvexProviderWithClerk_exports, {
  ConvexProviderWithClerk: () => ConvexProviderWithClerk
});
module.exports = __toCommonJS(ConvexProviderWithClerk_exports);
var import_react = __toESM(require("react"), 1);
var import_react2 = require("react");
var import_ConvexAuthState = require("../react/ConvexAuthState.js");
function ConvexProviderWithClerk({
  children,
  client,
  useAuth
}) {
  const useAuthFromClerk = useUseAuthFromClerk(useAuth);
  return /* @__PURE__ */ import_react.default.createElement(import_ConvexAuthState.ConvexProviderWithAuth, { client, useAuth: useAuthFromClerk }, children);
}
function useUseAuthFromClerk(useAuth) {
  return (0, import_react2.useMemo)(
    () => function useAuthFromClerk() {
      const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth();
      const fetchAccessToken = (0, import_react2.useCallback)(
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
      return (0, import_react2.useMemo)(
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
