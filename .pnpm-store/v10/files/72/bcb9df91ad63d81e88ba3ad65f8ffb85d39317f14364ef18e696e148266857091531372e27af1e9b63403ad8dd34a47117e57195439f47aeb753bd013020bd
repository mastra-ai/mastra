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

// src/browser.ts
var browser_exports = {};
__export(browser_exports, {
  inBrowser: () => inBrowser,
  isBrowserOnline: () => isBrowserOnline,
  isValidBrowser: () => isValidBrowser,
  isValidBrowserOnline: () => isValidBrowserOnline,
  userAgentIsRobot: () => userAgentIsRobot
});
module.exports = __toCommonJS(browser_exports);
function inBrowser() {
  return typeof window !== "undefined";
}
var botAgents = [
  "bot",
  "spider",
  "crawl",
  "APIs-Google",
  "AdsBot",
  "Googlebot",
  "mediapartners",
  "Google Favicon",
  "FeedFetcher",
  "Google-Read-Aloud",
  "DuplexWeb-Google",
  "googleweblight",
  "bing",
  "yandex",
  "baidu",
  "duckduck",
  "yahoo",
  "ecosia",
  "ia_archiver",
  "facebook",
  "instagram",
  "pinterest",
  "reddit",
  "slack",
  "twitter",
  "whatsapp",
  "youtube",
  "semrush"
];
var botAgentRegex = new RegExp(botAgents.join("|"), "i");
function userAgentIsRobot(userAgent) {
  return !userAgent ? false : botAgentRegex.test(userAgent);
}
function isValidBrowser() {
  const navigator = inBrowser() ? window?.navigator : null;
  if (!navigator) {
    return false;
  }
  return !userAgentIsRobot(navigator?.userAgent) && !navigator?.webdriver;
}
function isBrowserOnline() {
  const navigator = inBrowser() ? window?.navigator : null;
  if (!navigator) {
    return false;
  }
  const isNavigatorOnline = navigator?.onLine;
  const isExperimentalConnectionOnline = navigator?.connection?.rtt !== 0 && navigator?.connection?.downlink !== 0;
  return isExperimentalConnectionOnline && isNavigatorOnline;
}
function isValidBrowserOnline() {
  return isBrowserOnline() && isValidBrowser();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  inBrowser,
  isBrowserOnline,
  isValidBrowser,
  isValidBrowserOnline,
  userAgentIsRobot
});
//# sourceMappingURL=browser.js.map