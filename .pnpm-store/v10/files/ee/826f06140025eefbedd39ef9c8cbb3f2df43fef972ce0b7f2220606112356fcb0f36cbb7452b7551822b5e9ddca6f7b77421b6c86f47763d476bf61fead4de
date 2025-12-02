"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/devBrowser.ts
var devBrowser_exports = {};
__export(devBrowser_exports, {
  DEV_BROWSER_JWT_HEADER: () => DEV_BROWSER_JWT_HEADER,
  DEV_BROWSER_JWT_KEY: () => DEV_BROWSER_JWT_KEY,
  extractDevBrowserJWTFromURL: () => extractDevBrowserJWTFromURL,
  setDevBrowserJWTInURL: () => setDevBrowserJWTInURL
});
module.exports = __toCommonJS(devBrowser_exports);
var DEV_BROWSER_JWT_KEY = "__clerk_db_jwt";
var DEV_BROWSER_JWT_HEADER = "Clerk-Db-Jwt";
function setDevBrowserJWTInURL(url, jwt) {
  const resultURL = new URL(url);
  const jwtFromSearch = resultURL.searchParams.get(DEV_BROWSER_JWT_KEY);
  resultURL.searchParams.delete(DEV_BROWSER_JWT_KEY);
  const jwtToSet = jwtFromSearch || jwt;
  if (jwtToSet) {
    resultURL.searchParams.set(DEV_BROWSER_JWT_KEY, jwtToSet);
  }
  return resultURL;
}
function extractDevBrowserJWTFromURL(url) {
  const jwt = readDevBrowserJwtFromSearchParams(url);
  const cleanUrl = removeDevBrowserJwt(url);
  if (cleanUrl.href !== url.href && typeof globalThis.history !== "undefined") {
    globalThis.history.replaceState(null, "", removeDevBrowserJwt(url));
  }
  return jwt;
}
var readDevBrowserJwtFromSearchParams = (url) => {
  return url.searchParams.get(DEV_BROWSER_JWT_KEY) || "";
};
var removeDevBrowserJwt = (url) => {
  return removeDevBrowserJwtFromURLSearchParams(removeLegacyDevBrowserJwt(url));
};
var removeDevBrowserJwtFromURLSearchParams = (_url) => {
  const url = new URL(_url);
  url.searchParams.delete(DEV_BROWSER_JWT_KEY);
  return url;
};
var removeLegacyDevBrowserJwt = (_url) => {
  const DEV_BROWSER_JWT_MARKER_REGEXP = /__clerk_db_jwt\[(.*)\]/;
  const DEV_BROWSER_JWT_LEGACY_KEY = "__dev_session";
  const url = new URL(_url);
  url.searchParams.delete(DEV_BROWSER_JWT_LEGACY_KEY);
  url.hash = decodeURI(url.hash).replace(DEV_BROWSER_JWT_MARKER_REGEXP, "");
  if (url.href.endsWith("#")) {
    url.hash = "";
  }
  return url;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEV_BROWSER_JWT_HEADER,
  DEV_BROWSER_JWT_KEY,
  extractDevBrowserJWTFromURL,
  setDevBrowserJWTInURL
});
//# sourceMappingURL=devBrowser.js.map