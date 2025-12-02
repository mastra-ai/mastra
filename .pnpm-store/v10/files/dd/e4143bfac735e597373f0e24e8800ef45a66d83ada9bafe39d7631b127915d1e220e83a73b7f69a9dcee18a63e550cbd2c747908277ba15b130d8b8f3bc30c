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

// src/apiUrlFromPublishableKey.ts
var apiUrlFromPublishableKey_exports = {};
__export(apiUrlFromPublishableKey_exports, {
  apiUrlFromPublishableKey: () => apiUrlFromPublishableKey
});
module.exports = __toCommonJS(apiUrlFromPublishableKey_exports);

// src/constants.ts
var LEGACY_DEV_INSTANCE_SUFFIXES = [".lcl.dev", ".lclstage.dev", ".lclclerk.com"];
var LOCAL_ENV_SUFFIXES = [".lcl.dev", "lclstage.dev", ".lclclerk.com", ".accounts.lclclerk.com"];
var STAGING_ENV_SUFFIXES = [".accountsstage.dev"];
var LOCAL_API_URL = "https://api.lclclerk.com";
var STAGING_API_URL = "https://api.clerkstage.dev";
var PROD_API_URL = "https://api.clerk.com";

// src/isomorphicAtob.ts
var isomorphicAtob = (data) => {
  if (typeof atob !== "undefined" && typeof atob === "function") {
    return atob(data);
  } else if (typeof global !== "undefined" && global.Buffer) {
    return new global.Buffer(data, "base64").toString();
  }
  return data;
};

// src/keys.ts
var PUBLISHABLE_KEY_LIVE_PREFIX = "pk_live_";
var PUBLISHABLE_KEY_TEST_PREFIX = "pk_test_";
function isValidDecodedPublishableKey(decoded) {
  if (!decoded.endsWith("$")) {
    return false;
  }
  const withoutTrailing = decoded.slice(0, -1);
  if (withoutTrailing.includes("$")) {
    return false;
  }
  return withoutTrailing.includes(".");
}
function parsePublishableKey(key, options = {}) {
  key = key || "";
  if (!key || !isPublishableKey(key)) {
    if (options.fatal && !key) {
      throw new Error(
        "Publishable key is missing. Ensure that your publishable key is correctly configured. Double-check your environment configuration for your keys, or access them here: https://dashboard.clerk.com/last-active?path=api-keys"
      );
    }
    if (options.fatal && !isPublishableKey(key)) {
      throw new Error("Publishable key not valid.");
    }
    return null;
  }
  const instanceType = key.startsWith(PUBLISHABLE_KEY_LIVE_PREFIX) ? "production" : "development";
  let decodedFrontendApi;
  try {
    decodedFrontendApi = isomorphicAtob(key.split("_")[2]);
  } catch {
    if (options.fatal) {
      throw new Error("Publishable key not valid: Failed to decode key.");
    }
    return null;
  }
  if (!isValidDecodedPublishableKey(decodedFrontendApi)) {
    if (options.fatal) {
      throw new Error("Publishable key not valid: Decoded key has invalid format.");
    }
    return null;
  }
  let frontendApi = decodedFrontendApi.slice(0, -1);
  if (options.proxyUrl) {
    frontendApi = options.proxyUrl;
  } else if (instanceType !== "development" && options.domain && options.isSatellite) {
    frontendApi = `clerk.${options.domain}`;
  }
  return {
    instanceType,
    frontendApi
  };
}
function isPublishableKey(key = "") {
  try {
    const hasValidPrefix = key.startsWith(PUBLISHABLE_KEY_LIVE_PREFIX) || key.startsWith(PUBLISHABLE_KEY_TEST_PREFIX);
    if (!hasValidPrefix) {
      return false;
    }
    const parts = key.split("_");
    if (parts.length !== 3) {
      return false;
    }
    const encodedPart = parts[2];
    if (!encodedPart) {
      return false;
    }
    const decoded = isomorphicAtob(encodedPart);
    return isValidDecodedPublishableKey(decoded);
  } catch {
    return false;
  }
}

// src/apiUrlFromPublishableKey.ts
var apiUrlFromPublishableKey = (publishableKey) => {
  const frontendApi = parsePublishableKey(publishableKey)?.frontendApi;
  if (frontendApi?.startsWith("clerk.") && LEGACY_DEV_INSTANCE_SUFFIXES.some((suffix) => frontendApi?.endsWith(suffix))) {
    return PROD_API_URL;
  }
  if (LOCAL_ENV_SUFFIXES.some((suffix) => frontendApi?.endsWith(suffix))) {
    return LOCAL_API_URL;
  }
  if (STAGING_ENV_SUFFIXES.some((suffix) => frontendApi?.endsWith(suffix))) {
    return STAGING_API_URL;
  }
  return PROD_API_URL;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  apiUrlFromPublishableKey
});
//# sourceMappingURL=apiUrlFromPublishableKey.js.map