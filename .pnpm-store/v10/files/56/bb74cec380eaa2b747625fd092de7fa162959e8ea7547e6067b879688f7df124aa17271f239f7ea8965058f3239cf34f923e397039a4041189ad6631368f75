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
var ConvexProviderWithAuth0_exports = {};
__export(ConvexProviderWithAuth0_exports, {
  ConvexProviderWithAuth0: () => ConvexProviderWithAuth0
});
module.exports = __toCommonJS(ConvexProviderWithAuth0_exports);
var import_auth0_react = require("@auth0/auth0-react");
var import_react = __toESM(require("react"), 1);
var import_react2 = require("react");
var import_ConvexAuthState = require("../react/ConvexAuthState.js");
function ConvexProviderWithAuth0({
  children,
  client
}) {
  return /* @__PURE__ */ import_react.default.createElement(import_ConvexAuthState.ConvexProviderWithAuth, { client, useAuth: useAuthFromAuth0 }, children);
}
function useAuthFromAuth0() {
  const { isLoading, isAuthenticated, getAccessTokenSilently } = (0, import_auth0_react.useAuth0)();
  const fetchAccessToken = (0, import_react2.useCallback)(
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
  return (0, import_react2.useMemo)(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken]
  );
}
//# sourceMappingURL=ConvexProviderWithAuth0.js.map
