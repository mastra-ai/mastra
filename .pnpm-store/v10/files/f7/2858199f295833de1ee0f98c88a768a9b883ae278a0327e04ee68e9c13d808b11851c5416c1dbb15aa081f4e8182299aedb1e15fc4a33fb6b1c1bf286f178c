// src/devBrowser.ts
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

export {
  DEV_BROWSER_JWT_KEY,
  DEV_BROWSER_JWT_HEADER,
  setDevBrowserJWTInURL,
  extractDevBrowserJWTFromURL
};
//# sourceMappingURL=chunk-K64INQ4C.mjs.map