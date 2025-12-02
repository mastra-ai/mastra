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

// src/url.ts
var url_exports = {};
__export(url_exports, {
  addClerkPrefix: () => addClerkPrefix,
  cleanDoubleSlashes: () => cleanDoubleSlashes,
  getClerkJsMajorVersionOrTag: () => getClerkJsMajorVersionOrTag,
  getScriptUrl: () => getScriptUrl,
  hasLeadingSlash: () => hasLeadingSlash,
  hasTrailingSlash: () => hasTrailingSlash,
  isAbsoluteUrl: () => isAbsoluteUrl,
  isCurrentDevAccountPortalOrigin: () => isCurrentDevAccountPortalOrigin,
  isLegacyDevAccountPortalOrigin: () => isLegacyDevAccountPortalOrigin,
  isNonEmptyURL: () => isNonEmptyURL,
  joinURL: () => joinURL,
  parseSearchParams: () => parseSearchParams,
  stripScheme: () => stripScheme,
  withLeadingSlash: () => withLeadingSlash,
  withTrailingSlash: () => withTrailingSlash,
  withoutLeadingSlash: () => withoutLeadingSlash,
  withoutTrailingSlash: () => withoutTrailingSlash
});
module.exports = __toCommonJS(url_exports);

// src/constants.ts
var LEGACY_DEV_INSTANCE_SUFFIXES = [".lcl.dev", ".lclstage.dev", ".lclclerk.com"];
var CURRENT_DEV_INSTANCE_SUFFIXES = [".accounts.dev", ".accountsstage.dev", ".accounts.lclclerk.com"];

// src/utils/instance.ts
function isStaging(frontendApi) {
  return frontendApi.endsWith(".lclstage.dev") || frontendApi.endsWith(".stgstage.dev") || frontendApi.endsWith(".clerkstage.dev") || frontendApi.endsWith(".accountsstage.dev");
}

// src/url.ts
function parseSearchParams(queryString = "") {
  if (queryString.startsWith("?")) {
    queryString = queryString.slice(1);
  }
  return new URLSearchParams(queryString);
}
function stripScheme(url = "") {
  return (url || "").replace(/^.+:\/\//, "");
}
function addClerkPrefix(str) {
  if (!str) {
    return "";
  }
  let regex;
  if (str.match(/^(clerk\.)+\w*$/)) {
    regex = /(clerk\.)*(?=clerk\.)/;
  } else if (str.match(/\.clerk.accounts/)) {
    return str;
  } else {
    regex = /^(clerk\.)*/gi;
  }
  const stripped = str.replace(regex, "");
  return `clerk.${stripped}`;
}
var getClerkJsMajorVersionOrTag = (frontendApi, version) => {
  if (!version && isStaging(frontendApi)) {
    return "canary";
  }
  if (!version) {
    return "latest";
  }
  return version.split(".")[0] || "latest";
};
var getScriptUrl = (frontendApi, { clerkJSVersion }) => {
  const noSchemeFrontendApi = frontendApi.replace(/http(s)?:\/\//, "");
  const major = getClerkJsMajorVersionOrTag(frontendApi, clerkJSVersion);
  return `https://${noSchemeFrontendApi}/npm/@clerk/clerk-js@${clerkJSVersion || major}/dist/clerk.browser.js`;
};
function isLegacyDevAccountPortalOrigin(host) {
  return LEGACY_DEV_INSTANCE_SUFFIXES.some((legacyDevSuffix) => {
    return host.startsWith("accounts.") && host.endsWith(legacyDevSuffix);
  });
}
function isCurrentDevAccountPortalOrigin(host) {
  return CURRENT_DEV_INSTANCE_SUFFIXES.some((currentDevSuffix) => {
    return host.endsWith(currentDevSuffix) && !host.endsWith(".clerk" + currentDevSuffix);
  });
}
var TRAILING_SLASH_RE = /\/$|\/\?|\/#/;
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return input.endsWith("/");
  }
  return TRAILING_SLASH_RE.test(input);
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return input.endsWith("/") ? input : input + "/";
  }
  if (hasTrailingSlash(input, true)) {
    return input || "/";
  }
  let path = input;
  let fragment = "";
  const fragmentIndex = input.indexOf("#");
  if (fragmentIndex >= 0) {
    path = input.slice(0, fragmentIndex);
    fragment = input.slice(fragmentIndex);
    if (!path) {
      return fragment;
    }
  }
  const [s0, ...s] = path.split("?");
  return s0 + "/" + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
  if (!hasTrailingSlash(input, true)) {
    return input || "/";
  }
  let path = input;
  let fragment = "";
  const fragmentIndex = input.indexOf("#");
  if (fragmentIndex >= 0) {
    path = input.slice(0, fragmentIndex);
    fragment = input.slice(fragmentIndex);
  }
  const [s0, ...s] = path.split("?");
  return (s0.slice(0, -1) || "/") + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withoutLeadingSlash(input = "") {
  return (hasLeadingSlash(input) ? input.slice(1) : input) || "/";
}
function withLeadingSlash(input = "") {
  return hasLeadingSlash(input) ? input : "/" + input;
}
function cleanDoubleSlashes(input = "") {
  return input.split("://").map((string_) => string_.replace(/\/{2,}/g, "/")).join("://");
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
var JOIN_LEADING_SLASH_RE = /^\.?\//;
function joinURL(base, ...input) {
  let url = base || "";
  for (const segment of input.filter((url2) => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
      url = withTrailingSlash(url) + _segment;
    } else {
      url = segment;
    }
  }
  return url;
}
var ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/;
var isAbsoluteUrl = (url) => ABSOLUTE_URL_REGEX.test(url);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addClerkPrefix,
  cleanDoubleSlashes,
  getClerkJsMajorVersionOrTag,
  getScriptUrl,
  hasLeadingSlash,
  hasTrailingSlash,
  isAbsoluteUrl,
  isCurrentDevAccountPortalOrigin,
  isLegacyDevAccountPortalOrigin,
  isNonEmptyURL,
  joinURL,
  parseSearchParams,
  stripScheme,
  withLeadingSlash,
  withTrailingSlash,
  withoutLeadingSlash,
  withoutTrailingSlash
});
//# sourceMappingURL=url.js.map