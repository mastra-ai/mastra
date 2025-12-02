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

// src/netlifyCacheHandler.ts
var netlifyCacheHandler_exports = {};
__export(netlifyCacheHandler_exports, {
  CLERK_NETLIFY_CACHE_BUST_PARAM: () => CLERK_NETLIFY_CACHE_BUST_PARAM,
  handleNetlifyCacheInDevInstance: () => handleNetlifyCacheInDevInstance
});
module.exports = __toCommonJS(netlifyCacheHandler_exports);

// src/keys.ts
function isDevelopmentFromPublishableKey(apiKey) {
  return apiKey.startsWith("test_") || apiKey.startsWith("pk_test_");
}

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CLERK_NETLIFY_CACHE_BUST_PARAM,
  handleNetlifyCacheInDevInstance
});
//# sourceMappingURL=netlifyCacheHandler.js.map