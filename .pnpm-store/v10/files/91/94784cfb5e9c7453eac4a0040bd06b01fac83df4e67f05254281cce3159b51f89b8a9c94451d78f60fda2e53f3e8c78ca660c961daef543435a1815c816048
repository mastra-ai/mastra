import {
  isTruthy
} from "./chunk-GGFRMWFO.mjs";
import {
  parsePublishableKey
} from "./chunk-IV7BOO4U.mjs";

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

export {
  TelemetryCollector,
  eventPrebuiltComponentMounted,
  eventPrebuiltComponentOpened,
  eventComponentMounted,
  eventMethodCalled,
  eventFrameworkMetadata,
  EVENT_THEME_USAGE,
  EVENT_SAMPLING_RATE4 as EVENT_SAMPLING_RATE,
  eventThemeUsage
};
//# sourceMappingURL=chunk-RUA3ZE6A.mjs.map