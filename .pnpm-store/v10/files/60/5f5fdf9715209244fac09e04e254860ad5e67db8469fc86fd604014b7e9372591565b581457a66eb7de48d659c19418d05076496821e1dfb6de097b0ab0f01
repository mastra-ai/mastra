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

// src/loadClerkJsScript.ts
var loadClerkJsScript_exports = {};
__export(loadClerkJsScript_exports, {
  buildClerkJsScriptAttributes: () => buildClerkJsScriptAttributes,
  clerkJsScriptUrl: () => clerkJsScriptUrl,
  loadClerkJsScript: () => loadClerkJsScript,
  setClerkJsLoadingErrorPackageName: () => setClerkJsLoadingErrorPackageName
});
module.exports = __toCommonJS(loadClerkJsScript_exports);

// src/errors/createErrorTypeGuard.ts
function createErrorTypeGuard(ErrorClass) {
  function typeGuard(error) {
    const target = error ?? this;
    if (!target) {
      throw new TypeError(`${ErrorClass.kind || ErrorClass.name} type guard requires an error object`);
    }
    return target instanceof ErrorClass;
  }
  return typeGuard;
}

// src/errors/clerkApiError.ts
var ClerkAPIError = class {
  static kind = "ClerkApiError";
  code;
  message;
  longMessage;
  meta;
  constructor(json) {
    const parsedError = this.parseJsonError(json);
    this.code = parsedError.code;
    this.message = parsedError.message;
    this.longMessage = parsedError.longMessage;
    this.meta = parsedError.meta;
  }
  parseJsonError(json) {
    return {
      code: json.code,
      message: json.message,
      longMessage: json.long_message,
      meta: {
        paramName: json.meta?.param_name,
        sessionId: json.meta?.session_id,
        emailAddresses: json.meta?.email_addresses,
        identifiers: json.meta?.identifiers,
        zxcvbn: json.meta?.zxcvbn,
        plan: json.meta?.plan,
        isPlanUpgradePossible: json.meta?.is_plan_upgrade_possible
      }
    };
  }
};
var isClerkApiError = createErrorTypeGuard(ClerkAPIError);

// src/errors/clerkError.ts
var __DEV__ = true;
var ClerkError = class _ClerkError extends Error {
  static kind = "ClerkError";
  clerkError = true;
  code;
  longMessage;
  docsUrl;
  cause;
  get name() {
    return this.constructor.name;
  }
  constructor(opts) {
    super(new.target.formatMessage(new.target.kind, opts.message, opts.code, opts.docsUrl), { cause: opts.cause });
    Object.setPrototypeOf(this, _ClerkError.prototype);
    this.code = opts.code;
    this.docsUrl = opts.docsUrl;
    this.longMessage = opts.longMessage;
    this.cause = opts.cause;
  }
  toString() {
    return `[${this.name}]
Message:${this.message}`;
  }
  static formatMessage(name, msg, code, docsUrl) {
    const prefix = "Clerk:";
    const regex = new RegExp(prefix.replace(" ", "\\s*"), "i");
    msg = msg.replace(regex, "");
    msg = `${prefix} ${msg.trim()}

(code="${code}")

`;
    if (__DEV__ && docsUrl) {
      msg += `

Docs: ${docsUrl}`;
    }
    return msg;
  }
};

// src/errors/clerkApiResponseError.ts
var ClerkAPIResponseError = class _ClerkAPIResponseError extends ClerkError {
  static kind = "ClerkAPIResponseError";
  status;
  clerkTraceId;
  retryAfter;
  errors;
  constructor(message, options) {
    const { data: errorsJson, status, clerkTraceId, retryAfter } = options;
    super({ ...options, message, code: "api_response_error" });
    Object.setPrototypeOf(this, _ClerkAPIResponseError.prototype);
    this.status = status;
    this.clerkTraceId = clerkTraceId;
    this.retryAfter = retryAfter;
    this.errors = (errorsJson || []).map((e) => new ClerkAPIError(e));
  }
  toString() {
    let message = `[${this.name}]
Message:${this.message}
Status:${this.status}
Serialized errors: ${this.errors.map(
      (e) => JSON.stringify(e)
    )}`;
    if (this.clerkTraceId) {
      message += `
Clerk Trace ID: ${this.clerkTraceId}`;
    }
    return message;
  }
  // Override formatMessage to keep it unformatted for backward compatibility
  static formatMessage(name, msg, _, __) {
    return msg;
  }
};
var isClerkApiResponseError = createErrorTypeGuard(ClerkAPIResponseError);

// src/errors/errorThrower.ts
var DefaultMessages = Object.freeze({
  InvalidProxyUrlErrorMessage: `The proxyUrl passed to Clerk is invalid. The expected value for proxyUrl is an absolute URL or a relative path with a leading '/'. (key={{url}})`,
  InvalidPublishableKeyErrorMessage: `The publishableKey passed to Clerk is invalid. You can get your Publishable key at https://dashboard.clerk.com/last-active?path=api-keys. (key={{key}})`,
  MissingPublishableKeyErrorMessage: `Missing publishableKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
  MissingSecretKeyErrorMessage: `Missing secretKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
  MissingClerkProvider: `{{source}} can only be used within the <ClerkProvider /> component. Learn more: https://clerk.com/docs/components/clerk-provider`
});
function buildErrorThrower({ packageName, customMessages }) {
  let pkg = packageName;
  function buildMessage(rawMessage, replacements) {
    if (!replacements) {
      return `${pkg}: ${rawMessage}`;
    }
    let msg = rawMessage;
    const matches = rawMessage.matchAll(/{{([a-zA-Z0-9-_]+)}}/g);
    for (const match of matches) {
      const replacement = (replacements[match[1]] || "").toString();
      msg = msg.replace(`{{${match[1]}}}`, replacement);
    }
    return `${pkg}: ${msg}`;
  }
  const messages = {
    ...DefaultMessages,
    ...customMessages
  };
  return {
    setPackageName({ packageName: packageName2 }) {
      if (typeof packageName2 === "string") {
        pkg = packageName2;
      }
      return this;
    },
    setMessages({ customMessages: customMessages2 }) {
      Object.assign(messages, customMessages2 || {});
      return this;
    },
    throwInvalidPublishableKeyError(params) {
      throw new Error(buildMessage(messages.InvalidPublishableKeyErrorMessage, params));
    },
    throwInvalidProxyUrl(params) {
      throw new Error(buildMessage(messages.InvalidProxyUrlErrorMessage, params));
    },
    throwMissingPublishableKeyError() {
      throw new Error(buildMessage(messages.MissingPublishableKeyErrorMessage));
    },
    throwMissingSecretKeyError() {
      throw new Error(buildMessage(messages.MissingSecretKeyErrorMessage));
    },
    throwMissingClerkProviderError(params) {
      throw new Error(buildMessage(messages.MissingClerkProvider, params));
    },
    throw(message) {
      throw new Error(buildMessage(message));
    }
  };
}

// src/errors/clerkRuntimeError.ts
var ClerkRuntimeError = class _ClerkRuntimeError extends ClerkError {
  static kind = "ClerkRuntimeError";
  /**
   * @deprecated Use `clerkError` property instead. This property is maintained for backward compatibility.
   */
  clerkRuntimeError = true;
  constructor(message, options) {
    super({ ...options, message });
    Object.setPrototypeOf(this, _ClerkRuntimeError.prototype);
  }
};
var isClerkRuntimeError = createErrorTypeGuard(ClerkRuntimeError);

// src/constants.ts
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

// src/retry.ts
var defaultOptions = {
  initialDelay: 125,
  maxDelayBetweenRetries: 0,
  factor: 2,
  shouldRetry: (_, iteration) => iteration < 5,
  retryImmediately: false,
  jitter: true
};
var RETRY_IMMEDIATELY_DELAY = 100;
var sleep = async (ms) => new Promise((s) => setTimeout(s, ms));
var applyJitter = (delay, jitter) => {
  return jitter ? delay * (1 + Math.random()) : delay;
};
var createExponentialDelayAsyncFn = (opts) => {
  let timesCalled = 0;
  const calculateDelayInMs = () => {
    const constant = opts.initialDelay;
    const base = opts.factor;
    let delay = constant * Math.pow(base, timesCalled);
    delay = applyJitter(delay, opts.jitter);
    return Math.min(opts.maxDelayBetweenRetries || delay, delay);
  };
  return async () => {
    await sleep(calculateDelayInMs());
    timesCalled++;
  };
};
var retry = async (callback, options = {}) => {
  let iterations = 0;
  const { shouldRetry, initialDelay, maxDelayBetweenRetries, factor, retryImmediately, jitter, onBeforeRetry } = {
    ...defaultOptions,
    ...options
  };
  const delay = createExponentialDelayAsyncFn({
    initialDelay,
    maxDelayBetweenRetries,
    factor,
    jitter
  });
  while (true) {
    try {
      return await callback();
    } catch (e) {
      iterations++;
      if (!shouldRetry(e, iterations)) {
        throw e;
      }
      if (onBeforeRetry) {
        await onBeforeRetry(iterations);
      }
      if (retryImmediately && iterations === 1) {
        await sleep(applyJitter(RETRY_IMMEDIATELY_DELAY, jitter));
      } else {
        await delay();
      }
    }
  }
};

// src/loadScript.ts
var NO_DOCUMENT_ERROR = "loadScript cannot be called when document does not exist";
var NO_SRC_ERROR = "loadScript cannot be called without a src";
async function loadScript(src = "", opts) {
  const { async, defer, beforeLoad, crossOrigin, nonce } = opts || {};
  const load = () => {
    return new Promise((resolve, reject) => {
      if (!src) {
        reject(new Error(NO_SRC_ERROR));
      }
      if (!document || !document.body) {
        reject(new Error(NO_DOCUMENT_ERROR));
      }
      const script = document.createElement("script");
      if (crossOrigin) {
        script.setAttribute("crossorigin", crossOrigin);
      }
      script.async = async || false;
      script.defer = defer || false;
      script.addEventListener("load", () => {
        script.remove();
        resolve(script);
      });
      script.addEventListener("error", (event) => {
        script.remove();
        reject(event.error ?? new Error(`failed to load script: ${src}`));
      });
      script.src = src;
      script.nonce = nonce;
      beforeLoad?.(script);
      document.body.appendChild(script);
    });
  };
  return retry(load, { shouldRetry: (_, iterations) => iterations <= 5 });
}

// src/proxy.ts
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

// src/url.ts
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

// src/versionSelector.ts
var versionSelector = (clerkJSVersion, packageVersion = "5.102.0") => {
  if (clerkJSVersion) {
    return clerkJSVersion;
  }
  const prereleaseTag = getPrereleaseTag(packageVersion);
  if (prereleaseTag) {
    if (prereleaseTag === "snapshot") {
      return "5.102.0";
    }
    return prereleaseTag;
  }
  return getMajorVersion(packageVersion);
};
var getPrereleaseTag = (packageVersion) => packageVersion.trim().replace(/^v/, "").match(/-(.+?)(\.|$)/)?.[1];
var getMajorVersion = (packageVersion) => packageVersion.trim().replace(/^v/, "").split(".")[0];

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildClerkJsScriptAttributes,
  clerkJsScriptUrl,
  loadClerkJsScript,
  setClerkJsLoadingErrorPackageName
});
//# sourceMappingURL=loadClerkJsScript.js.map