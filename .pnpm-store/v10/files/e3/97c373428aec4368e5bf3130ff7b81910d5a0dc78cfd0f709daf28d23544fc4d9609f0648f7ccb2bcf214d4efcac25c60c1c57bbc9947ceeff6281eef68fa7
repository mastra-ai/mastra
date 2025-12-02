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

// src/telemetry.ts
var telemetry_exports = {};
__export(telemetry_exports, {
  EVENT_SAMPLING_RATE: () => EVENT_SAMPLING_RATE4,
  EVENT_THEME_USAGE: () => EVENT_THEME_USAGE,
  TelemetryCollector: () => TelemetryCollector,
  eventComponentMounted: () => eventComponentMounted,
  eventFrameworkMetadata: () => eventFrameworkMetadata,
  eventMethodCalled: () => eventMethodCalled,
  eventPrebuiltComponentMounted: () => eventPrebuiltComponentMounted,
  eventPrebuiltComponentOpened: () => eventPrebuiltComponentOpened,
  eventThemeUsage: () => eventThemeUsage
});
module.exports = __toCommonJS(telemetry_exports);

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

// src/underscore.ts
function snakeToCamel(str) {
  return str ? str.replace(/([-_][a-z])/g, (match) => match.toUpperCase().replace(/-|_/, "")) : "";
}
function camelToSnake(str) {
  return str ? str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) : "";
}
var createDeepObjectTransformer = (transform) => {
  const deepTransform = (obj) => {
    if (!obj) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((el) => {
        if (typeof el === "object" || Array.isArray(el)) {
          return deepTransform(el);
        }
        return el;
      });
    }
    const copy = { ...obj };
    const keys = Object.keys(copy);
    for (const oldName of keys) {
      const newName = transform(oldName.toString());
      if (newName !== oldName) {
        copy[newName] = copy[oldName];
        delete copy[oldName];
      }
      if (typeof copy[newName] === "object") {
        copy[newName] = deepTransform(copy[newName]);
      }
    }
    return copy;
  };
  return deepTransform;
};
var deepCamelToSnake = createDeepObjectTransformer(camelToSnake);
var deepSnakeToCamel = createDeepObjectTransformer(snakeToCamel);
function isTruthy(value) {
  if (typeof value === `boolean`) {
    return value;
  }
  if (value === void 0 || value === null) {
    return false;
  }
  if (typeof value === `string`) {
    if (value.toLowerCase() === `true`) {
      return true;
    }
    if (value.toLowerCase() === `false`) {
      return false;
    }
  }
  const number = parseInt(value, 10);
  if (isNaN(number)) {
    return false;
  }
  if (number > 0) {
    return true;
  }
  return false;
}

// src/telemetry/throttler.ts
var DEFAULT_CACHE_TTL_MS = 864e5;
var TelemetryEventThrottler = class {
  #cache;
  #cacheTtl = DEFAULT_CACHE_TTL_MS;
  constructor(cache) {
    this.#cache = cache;
  }
  isEventThrottled(payload) {
    const now = Date.now();
    const key = this.#generateKey(payload);
    const entry = this.#cache.getItem(key);
    if (!entry) {
      this.#cache.setItem(key, now);
      return false;
    }
    const shouldInvalidate = now - entry > this.#cacheTtl;
    if (shouldInvalidate) {
      this.#cache.setItem(key, now);
      return false;
    }
    return true;
  }
  /**
   * Generates a consistent unique key for telemetry events by sorting payload properties.
   * This ensures that payloads with identical content in different orders produce the same key.
   */
  #generateKey(event) {
    const { sk: _sk, pk: _pk, payload, ...rest } = event;
    const sanitizedEvent = {
      ...payload,
      ...rest
    };
    return JSON.stringify(
      Object.keys({
        ...payload,
        ...rest
      }).sort().map((key) => sanitizedEvent[key])
    );
  }
};
var LocalStorageThrottlerCache = class {
  #storageKey = "clerk_telemetry_throttler";
  getItem(key) {
    return this.#getCache()[key];
  }
  setItem(key, value) {
    try {
      const cache = this.#getCache();
      cache[key] = value;
      localStorage.setItem(this.#storageKey, JSON.stringify(cache));
    } catch (err) {
      const isQuotaExceededError = err instanceof DOMException && // Check error names for different browsers
      (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");
      if (isQuotaExceededError && localStorage.length > 0) {
        localStorage.removeItem(this.#storageKey);
      }
    }
  }
  removeItem(key) {
    try {
      const cache = this.#getCache();
      delete cache[key];
      localStorage.setItem(this.#storageKey, JSON.stringify(cache));
    } catch {
    }
  }
  #getCache() {
    try {
      const cacheString = localStorage.getItem(this.#storageKey);
      if (!cacheString) {
        return {};
      }
      return JSON.parse(cacheString);
    } catch {
      return {};
    }
  }
  static isSupported() {
    return typeof window !== "undefined" && !!window.localStorage;
  }
};
var InMemoryThrottlerCache = class {
  #cache = /* @__PURE__ */ new Map();
  #maxSize = 1e4;
  // Defensive limit to prevent memory issues
  getItem(key) {
    if (this.#cache.size > this.#maxSize) {
      this.#cache.clear();
      return void 0;
    }
    return this.#cache.get(key);
  }
  setItem(key, value) {
    this.#cache.set(key, value);
  }
  removeItem(key) {
    this.#cache.delete(key);
  }
};

// src/telemetry/collector.ts
function isWindowClerkWithMetadata(clerk) {
  return typeof clerk === "object" && clerk !== null && "constructor" in clerk && typeof clerk.constructor === "function";
}
var VALID_LOG_LEVELS = /* @__PURE__ */ new Set(["error", "warn", "info", "debug", "trace"]);
var DEFAULT_CONFIG = {
  samplingRate: 1,
  maxBufferSize: 5,
  // Production endpoint: https://clerk-telemetry.com
  // Staging endpoint: https://staging.clerk-telemetry.com
  // Local: http://localhost:8787
  endpoint: "https://clerk-telemetry.com"
};
var TelemetryCollector = class {
  #config;
  #eventThrottler;
  #metadata = {};
  #buffer = [];
  #pendingFlush = null;
  constructor(options) {
    this.#config = {
      maxBufferSize: options.maxBufferSize ?? DEFAULT_CONFIG.maxBufferSize,
      samplingRate: options.samplingRate ?? DEFAULT_CONFIG.samplingRate,
      perEventSampling: options.perEventSampling ?? true,
      disabled: options.disabled ?? false,
      debug: options.debug ?? false,
      endpoint: DEFAULT_CONFIG.endpoint
    };
    if (!options.clerkVersion && typeof window === "undefined") {
      this.#metadata.clerkVersion = "";
    } else {
      this.#metadata.clerkVersion = options.clerkVersion ?? "";
    }
    this.#metadata.sdk = options.sdk;
    this.#metadata.sdkVersion = options.sdkVersion;
    this.#metadata.publishableKey = options.publishableKey ?? "";
    const parsedKey = parsePublishableKey(options.publishableKey);
    if (parsedKey) {
      this.#metadata.instanceType = parsedKey.instanceType;
    }
    if (options.secretKey) {
      this.#metadata.secretKey = options.secretKey.substring(0, 16);
    }
    const cache = LocalStorageThrottlerCache.isSupported() ? new LocalStorageThrottlerCache() : new InMemoryThrottlerCache();
    this.#eventThrottler = new TelemetryEventThrottler(cache);
  }
  get isEnabled() {
    if (this.#metadata.instanceType !== "development") {
      return false;
    }
    if (this.#config.disabled || typeof process !== "undefined" && process.env && isTruthy(process.env.CLERK_TELEMETRY_DISABLED)) {
      return false;
    }
    if (typeof window !== "undefined" && !!window?.navigator?.webdriver) {
      return false;
    }
    return true;
  }
  get isDebug() {
    return this.#config.debug || typeof process !== "undefined" && process.env && isTruthy(process.env.CLERK_TELEMETRY_DEBUG);
  }
  record(event) {
    try {
      const preparedPayload = this.#preparePayload(event.event, event.payload);
      this.#logEvent(preparedPayload.event, preparedPayload);
      if (!this.#shouldRecord(preparedPayload, event.eventSamplingRate)) {
        return;
      }
      this.#buffer.push({ kind: "event", value: preparedPayload });
      this.#scheduleFlush();
    } catch (error) {
      console.error("[clerk/telemetry] Error recording telemetry event", error);
    }
  }
  /**
   * Records a telemetry log entry if logging is enabled and not in debug mode.
   *
   * @param entry - The telemetry log entry to record.
   */
  recordLog(entry) {
    try {
      if (!this.#shouldRecordLog(entry)) {
        return;
      }
      const levelIsValid = typeof entry?.level === "string" && VALID_LOG_LEVELS.has(entry.level);
      const messageIsValid = typeof entry?.message === "string" && entry.message.trim().length > 0;
      let normalizedTimestamp = null;
      const timestampInput = entry?.timestamp;
      if (typeof timestampInput === "number" || typeof timestampInput === "string") {
        const candidate = new Date(timestampInput);
        if (!Number.isNaN(candidate.getTime())) {
          normalizedTimestamp = candidate;
        }
      }
      if (!levelIsValid || !messageIsValid || normalizedTimestamp === null) {
        if (this.isDebug && typeof console !== "undefined") {
          console.warn("[clerk/telemetry] Dropping invalid telemetry log entry", {
            levelIsValid,
            messageIsValid,
            timestampIsValid: normalizedTimestamp !== null
          });
        }
        return;
      }
      const sdkMetadata = this.#getSDKMetadata();
      const logData = {
        sdk: sdkMetadata.name,
        sdkv: sdkMetadata.version,
        cv: this.#metadata.clerkVersion ?? "",
        lvl: entry.level,
        msg: entry.message,
        ts: normalizedTimestamp.toISOString(),
        pk: this.#metadata.publishableKey || null,
        payload: this.#sanitizeContext(entry.context)
      };
      this.#buffer.push({ kind: "log", value: logData });
      this.#scheduleFlush();
    } catch (error) {
      console.error("[clerk/telemetry] Error recording telemetry log entry", error);
    }
  }
  #shouldRecord(preparedPayload, eventSamplingRate) {
    return this.isEnabled && !this.isDebug && this.#shouldBeSampled(preparedPayload, eventSamplingRate);
  }
  #shouldRecordLog(_entry) {
    return true;
  }
  #shouldBeSampled(preparedPayload, eventSamplingRate) {
    const randomSeed = Math.random();
    const toBeSampled = randomSeed <= this.#config.samplingRate && (this.#config.perEventSampling === false || typeof eventSamplingRate === "undefined" || randomSeed <= eventSamplingRate);
    if (!toBeSampled) {
      return false;
    }
    return !this.#eventThrottler.isEventThrottled(preparedPayload);
  }
  #scheduleFlush() {
    if (typeof window === "undefined") {
      this.#flush();
      return;
    }
    const isBufferFull = this.#buffer.length >= this.#config.maxBufferSize;
    if (isBufferFull) {
      if (this.#pendingFlush) {
        if (typeof cancelIdleCallback !== "undefined") {
          cancelIdleCallback(Number(this.#pendingFlush));
        } else {
          clearTimeout(Number(this.#pendingFlush));
        }
      }
      this.#flush();
      return;
    }
    if (this.#pendingFlush) {
      return;
    }
    if ("requestIdleCallback" in window) {
      this.#pendingFlush = requestIdleCallback(() => {
        this.#flush();
        this.#pendingFlush = null;
      });
    } else {
      this.#pendingFlush = setTimeout(() => {
        this.#flush();
        this.#pendingFlush = null;
      }, 0);
    }
  }
  #flush() {
    const itemsToSend = [...this.#buffer];
    this.#buffer = [];
    this.#pendingFlush = null;
    if (itemsToSend.length === 0) {
      return;
    }
    const eventsToSend = itemsToSend.filter((item) => item.kind === "event").map((item) => item.value);
    const logsToSend = itemsToSend.filter((item) => item.kind === "log").map((item) => item.value);
    if (eventsToSend.length > 0) {
      const eventsUrl = new URL("/v1/event", this.#config.endpoint);
      fetch(eventsUrl, {
        headers: {
          "Content-Type": "application/json"
        },
        keepalive: true,
        method: "POST",
        // TODO: We send an array here with that idea that we can eventually send multiple events.
        body: JSON.stringify({ events: eventsToSend })
      }).catch(() => void 0);
    }
    if (logsToSend.length > 0) {
      const logsUrl = new URL("/v1/logs", this.#config.endpoint);
      fetch(logsUrl, {
        headers: {
          "Content-Type": "application/json"
        },
        keepalive: true,
        method: "POST",
        body: JSON.stringify({ logs: logsToSend })
      }).catch(() => void 0);
    }
  }
  /**
   * If running in debug mode, log the event and its payload to the console.
   */
  #logEvent(event, payload) {
    if (!this.isDebug) {
      return;
    }
    if (typeof console.groupCollapsed !== "undefined") {
      console.groupCollapsed("[clerk/telemetry]", event);
      console.log(payload);
      console.groupEnd();
    } else {
      console.log("[clerk/telemetry]", event, payload);
    }
  }
  /**
   * If in browser, attempt to lazily grab the SDK metadata from the Clerk singleton, otherwise fallback to the initially passed in values.
   *
   * This is necessary because the sdkMetadata can be set by the host SDK after the TelemetryCollector is instantiated.
   */
  #getSDKMetadata() {
    const sdkMetadata = {
      name: this.#metadata.sdk,
      version: this.#metadata.sdkVersion
    };
    if (typeof window !== "undefined") {
      const windowWithClerk = window;
      if (windowWithClerk.Clerk) {
        const windowClerk = windowWithClerk.Clerk;
        if (isWindowClerkWithMetadata(windowClerk) && windowClerk.constructor.sdkMetadata) {
          const { name, version } = windowClerk.constructor.sdkMetadata;
          if (name !== void 0) {
            sdkMetadata.name = name;
          }
          if (version !== void 0) {
            sdkMetadata.version = version;
          }
        }
      }
    }
    return sdkMetadata;
  }
  /**
   * Append relevant metadata from the Clerk singleton to the event payload.
   */
  #preparePayload(event, payload) {
    const sdkMetadata = this.#getSDKMetadata();
    return {
      event,
      cv: this.#metadata.clerkVersion ?? "",
      it: this.#metadata.instanceType ?? "",
      sdk: sdkMetadata.name,
      sdkv: sdkMetadata.version,
      ...this.#metadata.publishableKey ? { pk: this.#metadata.publishableKey } : {},
      ...this.#metadata.secretKey ? { sk: this.#metadata.secretKey } : {},
      payload
    };
  }
  /**
   * Best-effort sanitization of the context payload. Returns a plain object with JSON-serializable
   * values or null when the input is missing or not serializable. Arrays are not accepted.
   */
  #sanitizeContext(context) {
    if (context === null || typeof context === "undefined") {
      return null;
    }
    if (typeof context !== "object") {
      return null;
    }
    try {
      const cleaned = JSON.parse(JSON.stringify(context));
      if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
        return cleaned;
      }
      return null;
    } catch {
      return null;
    }
  }
};

// src/telemetry/events/component-mounted.ts
var EVENT_COMPONENT_MOUNTED = "COMPONENT_MOUNTED";
var EVENT_COMPONENT_OPENED = "COMPONENT_OPENED";
var EVENT_SAMPLING_RATE = 0.1;
var AUTH_COMPONENTS = /* @__PURE__ */ new Set(["SignIn", "SignUp"]);
function getComponentMountedSamplingRate(component) {
  return AUTH_COMPONENTS.has(component) ? 1 : EVENT_SAMPLING_RATE;
}
function createPrebuiltComponentEvent(event) {
  return function(component, props, additionalPayload) {
    return {
      event,
      eventSamplingRate: event === EVENT_COMPONENT_MOUNTED ? getComponentMountedSamplingRate(component) : EVENT_SAMPLING_RATE,
      payload: {
        component,
        appearanceProp: Boolean(props?.appearance),
        baseTheme: Boolean(props?.appearance?.baseTheme),
        elements: Boolean(props?.appearance?.elements),
        variables: Boolean(props?.appearance?.variables),
        ...additionalPayload
      }
    };
  };
}
function eventPrebuiltComponentMounted(component, props, additionalPayload) {
  return createPrebuiltComponentEvent(EVENT_COMPONENT_MOUNTED)(component, props, additionalPayload);
}
function eventPrebuiltComponentOpened(component, props, additionalPayload) {
  return createPrebuiltComponentEvent(EVENT_COMPONENT_OPENED)(component, props, additionalPayload);
}
function eventComponentMounted(component, props = {}) {
  return {
    event: EVENT_COMPONENT_MOUNTED,
    eventSamplingRate: getComponentMountedSamplingRate(component),
    payload: {
      component,
      ...props
    }
  };
}

// src/telemetry/events/method-called.ts
var EVENT_METHOD_CALLED = "METHOD_CALLED";
var EVENT_SAMPLING_RATE2 = 0.1;
function eventMethodCalled(method, payload) {
  return {
    event: EVENT_METHOD_CALLED,
    eventSamplingRate: EVENT_SAMPLING_RATE2,
    payload: {
      method,
      ...payload
    }
  };
}

// src/telemetry/events/framework-metadata.ts
var EVENT_FRAMEWORK_METADATA = "FRAMEWORK_METADATA";
var EVENT_SAMPLING_RATE3 = 0.1;
function eventFrameworkMetadata(payload) {
  return {
    event: EVENT_FRAMEWORK_METADATA,
    eventSamplingRate: EVENT_SAMPLING_RATE3,
    payload
  };
}

// src/telemetry/events/theme-usage.ts
var EVENT_THEME_USAGE = "THEME_USAGE";
var EVENT_SAMPLING_RATE4 = 1;
function eventThemeUsage(appearance) {
  const payload = analyzeThemeUsage(appearance);
  return {
    event: EVENT_THEME_USAGE,
    eventSamplingRate: EVENT_SAMPLING_RATE4,
    payload
  };
}
function analyzeThemeUsage(appearance) {
  if (!appearance || typeof appearance !== "object") {
    return {};
  }
  const themeProperty = appearance.theme || appearance.baseTheme;
  if (!themeProperty) {
    return {};
  }
  let themeName;
  if (Array.isArray(themeProperty)) {
    for (const theme of themeProperty) {
      const name = extractThemeName(theme);
      if (name) {
        themeName = name;
        break;
      }
    }
  } else {
    themeName = extractThemeName(themeProperty);
  }
  return { themeName };
}
function extractThemeName(theme) {
  if (typeof theme === "string") {
    return theme;
  }
  if (typeof theme === "object" && theme !== null) {
    if ("name" in theme && typeof theme.name === "string") {
      return theme.name;
    }
  }
  return void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EVENT_SAMPLING_RATE,
  EVENT_THEME_USAGE,
  TelemetryCollector,
  eventComponentMounted,
  eventFrameworkMetadata,
  eventMethodCalled,
  eventPrebuiltComponentMounted,
  eventPrebuiltComponentOpened,
  eventThemeUsage
});
//# sourceMappingURL=telemetry.js.map