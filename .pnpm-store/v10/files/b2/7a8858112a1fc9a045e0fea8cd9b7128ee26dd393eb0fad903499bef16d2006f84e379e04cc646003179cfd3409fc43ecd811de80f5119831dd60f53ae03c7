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

// src/proxy.ts
var proxy_exports = {};
__export(proxy_exports, {
  isHttpOrHttps: () => isHttpOrHttps,
  isProxyUrlRelative: () => isProxyUrlRelative,
  isValidProxyUrl: () => isValidProxyUrl,
  proxyUrlToAbsoluteURL: () => proxyUrlToAbsoluteURL
});
module.exports = __toCommonJS(proxy_exports);
function isValidProxyUrl(key) {
  if (!key) {
    return true;
  }
  return isHttpOrHttps(key) || isProxyUrlRelative(key);
}
function isHttpOrHttps(key) {
  return /^http(s)?:\/\//.test(key || "");
}
function isProxyUrlRelative(key) {
  return key.startsWith("/");
}
function proxyUrlToAbsoluteURL(url) {
  if (!url) {
    return "";
  }
  return isProxyUrlRelative(url) ? new URL(url, window.location.origin).toString() : url;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isHttpOrHttps,
  isProxyUrlRelative,
  isValidProxyUrl,
  proxyUrlToAbsoluteURL
});
//# sourceMappingURL=proxy.js.map