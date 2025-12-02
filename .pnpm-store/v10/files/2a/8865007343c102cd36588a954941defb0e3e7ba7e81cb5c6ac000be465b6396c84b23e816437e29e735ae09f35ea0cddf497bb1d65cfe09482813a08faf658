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

// src/keys.ts
var keys_exports = {};
__export(keys_exports, {
  buildPublishableKey: () => buildPublishableKey,
  createDevOrStagingUrlCache: () => createDevOrStagingUrlCache,
  getCookieSuffix: () => getCookieSuffix,
  getSuffixedCookieName: () => getSuffixedCookieName,
  isDevelopmentFromPublishableKey: () => isDevelopmentFromPublishableKey,
  isDevelopmentFromSecretKey: () => isDevelopmentFromSecretKey,
  isProductionFromPublishableKey: () => isProductionFromPublishableKey,
  isProductionFromSecretKey: () => isProductionFromSecretKey,
  isPublishableKey: () => isPublishableKey,
  parsePublishableKey: () => parsePublishableKey
});
module.exports = __toCommonJS(keys_exports);

// src/constants.ts
var LEGACY_DEV_INSTANCE_SUFFIXES = [".lcl.dev", ".lclstage.dev", ".lclclerk.com"];
var DEV_OR_STAGING_SUFFIXES = [
  ".lcl.dev",
  ".stg.dev",
  ".lclstage.dev",
  ".stgstage.dev",
  ".dev.lclclerk.com",
  ".stg.lclclerk.com",
  ".accounts.lclclerk.com",
  "accountsstage.dev",
  "accounts.dev"
];

// src/isomorphicAtob.ts
var isomorphicAtob = (data) => {
  if (typeof atob !== "undefined" && typeof atob === "function") {
    return atob(data);
  } else if (typeof global !== "undefined" && global.Buffer) {
    return new global.Buffer(data, "base64").toString();
  }
  return data;
};

// src/isomorphicBtoa.ts
var isomorphicBtoa = (data) => {
  if (typeof btoa !== "undefined" && typeof btoa === "function") {
    return btoa(data);
  } else if (typeof global !== "undefined" && global.Buffer) {
    return new global.Buffer(data).toString("base64");
  }
  return data;
};

// src/keys.ts
var PUBLISHABLE_KEY_LIVE_PREFIX = "pk_live_";
var PUBLISHABLE_KEY_TEST_PREFIX = "pk_test_";
var PUBLISHABLE_FRONTEND_API_DEV_REGEX = /^(([a-z]+)-){2}([0-9]{1,2})\.clerk\.accounts([a-z.]*)(dev|com)$/i;
function buildPublishableKey(frontendApi) {
  const isDevKey = PUBLISHABLE_FRONTEND_API_DEV_REGEX.test(frontendApi) || frontendApi.startsWith("clerk.") && LEGACY_DEV_INSTANCE_SUFFIXES.some((s) => frontendApi.endsWith(s));
  const keyPrefix = isDevKey ? PUBLISHABLE_KEY_TEST_PREFIX : PUBLISHABLE_KEY_LIVE_PREFIX;
  return `${keyPrefix}${isomorphicBtoa(`${frontendApi}$`)}`;
}
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
function createDevOrStagingUrlCache() {
  const devOrStagingUrlCache = /* @__PURE__ */ new Map();
  return {
    /**
     * Checks if a URL is a development or staging environment.
     *
     * @param url - The URL to check (string or URL object).
     * @returns `true` if the URL is a development or staging environment, `false` otherwise.
     */
    isDevOrStagingUrl: (url) => {
      if (!url) {
        return false;
      }
      const hostname = typeof url === "string" ? url : url.hostname;
      let res = devOrStagingUrlCache.get(hostname);
      if (res === void 0) {
        res = DEV_OR_STAGING_SUFFIXES.some((s) => hostname.endsWith(s));
        devOrStagingUrlCache.set(hostname, res);
      }
      return res;
    }
  };
}
function isDevelopmentFromPublishableKey(apiKey) {
  return apiKey.startsWith("test_") || apiKey.startsWith("pk_test_");
}
function isProductionFromPublishableKey(apiKey) {
  return apiKey.startsWith("live_") || apiKey.startsWith("pk_live_");
}
function isDevelopmentFromSecretKey(apiKey) {
  return apiKey.startsWith("test_") || apiKey.startsWith("sk_test_");
}
function isProductionFromSecretKey(apiKey) {
  return apiKey.startsWith("live_") || apiKey.startsWith("sk_live_");
}
async function getCookieSuffix(publishableKey, subtle = globalThis.crypto.subtle) {
  const data = new TextEncoder().encode(publishableKey);
  const digest = await subtle.digest("sha-1", data);
  const stringDigest = String.fromCharCode(...new Uint8Array(digest));
  return isomorphicBtoa(stringDigest).replace(/\+/gi, "-").replace(/\//gi, "_").substring(0, 8);
}
var getSuffixedCookieName = (cookieName, cookieSuffix) => {
  return `${cookieName}_${cookieSuffix}`;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildPublishableKey,
  createDevOrStagingUrlCache,
  getCookieSuffix,
  getSuffixedCookieName,
  isDevelopmentFromPublishableKey,
  isDevelopmentFromSecretKey,
  isProductionFromPublishableKey,
  isProductionFromSecretKey,
  isPublishableKey,
  parsePublishableKey
});
//# sourceMappingURL=keys.js.map