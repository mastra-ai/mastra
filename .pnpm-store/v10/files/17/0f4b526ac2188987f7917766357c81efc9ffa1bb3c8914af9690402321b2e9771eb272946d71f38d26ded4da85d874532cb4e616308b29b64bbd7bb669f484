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

// src/webauthn.ts
var webauthn_exports = {};
__export(webauthn_exports, {
  isWebAuthnAutofillSupported: () => isWebAuthnAutofillSupported,
  isWebAuthnPlatformAuthenticatorSupported: () => isWebAuthnPlatformAuthenticatorSupported,
  isWebAuthnSupported: () => isWebAuthnSupported
});
module.exports = __toCommonJS(webauthn_exports);

// src/browser.ts
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

// src/webauthn.ts
function isWebAuthnSupported() {
  return isValidBrowser() && // Check if `PublicKeyCredential` is a constructor
  typeof window.PublicKeyCredential === "function";
}
async function isWebAuthnAutofillSupported() {
  try {
    return isWebAuthnSupported() && await window.PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}
async function isWebAuthnPlatformAuthenticatorSupported() {
  try {
    return typeof window !== "undefined" && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isWebAuthnAutofillSupported,
  isWebAuthnPlatformAuthenticatorSupported,
  isWebAuthnSupported
});
//# sourceMappingURL=webauthn.js.map