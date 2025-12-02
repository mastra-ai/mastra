import {
  isDevelopmentFromPublishableKey
} from "./chunk-IV7BOO4U.mjs";

// src/netlifyCacheHandler.ts
var CLERK_NETLIFY_CACHE_BUST_PARAM = "__clerk_netlify_cache_bust";
function isNetlifyRuntime() {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }
  return Boolean(process.env.NETLIFY) || Boolean(process.env.NETLIFY_FUNCTIONS_TOKEN) || typeof process.env.URL === "string" && process.env.URL.endsWith("netlify.app");
}
function handleNetlifyCacheInDevInstance({
  locationHeader,
  requestStateHeaders,
  publishableKey
}) {
  const isOnNetlify = isNetlifyRuntime();
  const isDevelopmentInstance = isDevelopmentFromPublishableKey(publishableKey);
  if (isOnNetlify && isDevelopmentInstance) {
    const hasHandshakeQueryParam = locationHeader.includes("__clerk_handshake");
    if (!hasHandshakeQueryParam) {
      const url = new URL(locationHeader);
      url.searchParams.append(CLERK_NETLIFY_CACHE_BUST_PARAM, Date.now().toString());
      requestStateHeaders.set("Location", url.toString());
    }
  }
}

export {
  CLERK_NETLIFY_CACHE_BUST_PARAM,
  handleNetlifyCacheInDevInstance
};
//# sourceMappingURL=chunk-B475RA2C.mjs.map