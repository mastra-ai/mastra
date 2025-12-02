import {
  versionSelector
} from "./chunk-H7LOAF6V.mjs";
import {
  isValidProxyUrl,
  proxyUrlToAbsoluteURL
} from "./chunk-6NDGN2IU.mjs";
import {
  addClerkPrefix
} from "./chunk-IFTVZ2LQ.mjs";
import {
  loadScript
} from "./chunk-U7IR7A27.mjs";
import {
  ClerkRuntimeError,
  buildErrorThrower
} from "./chunk-AXHU6TXE.mjs";
import {
  createDevOrStagingUrlCache,
  parsePublishableKey
} from "./chunk-IV7BOO4U.mjs";

// src/loadClerkJsScript.ts
var ERROR_CODE = "failed_to_load_clerk_js";
var ERROR_CODE_TIMEOUT = "failed_to_load_clerk_js_timeout";
var FAILED_TO_LOAD_ERROR = "Failed to load Clerk";
var { isDevOrStagingUrl } = createDevOrStagingUrlCache();
var errorThrower = buildErrorThrower({ packageName: "@clerk/shared" });
function setClerkJsLoadingErrorPackageName(packageName) {
  errorThrower.setPackageName({ packageName });
}
function isClerkProperlyLoaded() {
  if (typeof window === "undefined" || !window.Clerk) {
    return false;
  }
  const clerk = window.Clerk;
  return typeof clerk === "object" && typeof clerk.load === "function";
}
function waitForClerkWithTimeout(timeoutMs) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const cleanup = (timeoutId2, pollInterval2) => {
      clearTimeout(timeoutId2);
      clearInterval(pollInterval2);
    };
    const checkAndResolve = () => {
      if (resolved) {
        return;
      }
      if (isClerkProperlyLoaded()) {
        resolved = true;
        cleanup(timeoutId, pollInterval);
        resolve(null);
      }
    };
    const handleTimeout = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      cleanup(timeoutId, pollInterval);
      if (!isClerkProperlyLoaded()) {
        reject(new ClerkRuntimeError(FAILED_TO_LOAD_ERROR, { code: ERROR_CODE_TIMEOUT }));
      } else {
        resolve(null);
      }
    };
    const timeoutId = setTimeout(handleTimeout, timeoutMs);
    checkAndResolve();
    const pollInterval = setInterval(() => {
      if (resolved) {
        clearInterval(pollInterval);
        return;
      }
      checkAndResolve();
    }, 100);
  });
}
var loadClerkJsScript = async (opts) => {
  const timeout = opts?.scriptLoadTimeout ?? 15e3;
  if (isClerkProperlyLoaded()) {
    return null;
  }
  const existingScript = document.querySelector("script[data-clerk-js-script]");
  if (existingScript) {
    return waitForClerkWithTimeout(timeout);
  }
  if (!opts?.publishableKey) {
    errorThrower.throwMissingPublishableKeyError();
    return null;
  }
  const loadPromise = waitForClerkWithTimeout(timeout);
  loadScript(clerkJsScriptUrl(opts), {
    async: true,
    crossOrigin: "anonymous",
    nonce: opts.nonce,
    beforeLoad: applyClerkJsScriptAttributes(opts)
  }).catch((error) => {
    throw new ClerkRuntimeError(FAILED_TO_LOAD_ERROR + (error.message ? `, ${error.message}` : ""), {
      code: ERROR_CODE,
      cause: error
    });
  });
  return loadPromise;
};
var clerkJsScriptUrl = (opts) => {
  const { clerkJSUrl, clerkJSVariant, clerkJSVersion, proxyUrl, domain, publishableKey } = opts;
  if (clerkJSUrl) {
    return clerkJSUrl;
  }
  let scriptHost = "";
  if (!!proxyUrl && isValidProxyUrl(proxyUrl)) {
    scriptHost = proxyUrlToAbsoluteURL(proxyUrl).replace(/http(s)?:\/\//, "");
  } else if (domain && !isDevOrStagingUrl(parsePublishableKey(publishableKey)?.frontendApi || "")) {
    scriptHost = addClerkPrefix(domain);
  } else {
    scriptHost = parsePublishableKey(publishableKey)?.frontendApi || "";
  }
  const variant = clerkJSVariant ? `${clerkJSVariant.replace(/\.+$/, "")}.` : "";
  const version = versionSelector(clerkJSVersion);
  return `https://${scriptHost}/npm/@clerk/clerk-js@${version}/dist/clerk.${variant}browser.js`;
};
var buildClerkJsScriptAttributes = (options) => {
  const obj = {};
  if (options.publishableKey) {
    obj["data-clerk-publishable-key"] = options.publishableKey;
  }
  if (options.proxyUrl) {
    obj["data-clerk-proxy-url"] = options.proxyUrl;
  }
  if (options.domain) {
    obj["data-clerk-domain"] = options.domain;
  }
  if (options.nonce) {
    obj.nonce = options.nonce;
  }
  return obj;
};
var applyClerkJsScriptAttributes = (options) => (script) => {
  const attributes = buildClerkJsScriptAttributes(options);
  for (const attribute in attributes) {
    script.setAttribute(attribute, attributes[attribute]);
  }
};

export {
  setClerkJsLoadingErrorPackageName,
  loadClerkJsScript,
  clerkJsScriptUrl,
  buildClerkJsScriptAttributes
};
//# sourceMappingURL=chunk-3M2MQBWC.mjs.map