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

// src/loadScript.ts
var loadScript_exports = {};
__export(loadScript_exports, {
  loadScript: () => loadScript
});
module.exports = __toCommonJS(loadScript_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  loadScript
});
//# sourceMappingURL=loadScript.js.map