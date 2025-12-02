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

// src/utils/index.ts
var utils_exports = {};
__export(utils_exports, {
  allSettled: () => allSettled,
  createDeferredPromise: () => createDeferredPromise,
  fastDeepMergeAndKeep: () => fastDeepMergeAndKeep,
  fastDeepMergeAndReplace: () => fastDeepMergeAndReplace,
  handleValueOrFn: () => handleValueOrFn,
  isDevelopmentEnvironment: () => isDevelopmentEnvironment,
  isProductionEnvironment: () => isProductionEnvironment,
  isStaging: () => isStaging,
  isTestEnvironment: () => isTestEnvironment,
  logErrorInDevMode: () => logErrorInDevMode,
  noop: () => noop
});
module.exports = __toCommonJS(utils_exports);

// src/utils/noop.ts
var noop = (..._args) => {
};

// src/utils/createDeferredPromise.ts
var createDeferredPromise = () => {
  let resolve = noop;
  let reject = noop;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// src/utils/allSettled.ts
function allSettled(iterable) {
  const promises = Array.from(iterable).map(
    (p) => p.then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason })
    )
  );
  return Promise.all(promises);
}

// src/utils/instance.ts
function isStaging(frontendApi) {
  return frontendApi.endsWith(".lclstage.dev") || frontendApi.endsWith(".stgstage.dev") || frontendApi.endsWith(".clerkstage.dev") || frontendApi.endsWith(".accountsstage.dev");
}

// src/utils/runtimeEnvironment.ts
var isDevelopmentEnvironment = () => {
  try {
    return process.env.NODE_ENV === "development";
  } catch {
  }
  return false;
};
var isTestEnvironment = () => {
  try {
    return process.env.NODE_ENV === "test";
  } catch {
  }
  return false;
};
var isProductionEnvironment = () => {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
  }
  return false;
};

// src/utils/logErrorInDevMode.ts
var logErrorInDevMode = (message) => {
  if (isDevelopmentEnvironment()) {
    console.error(`Clerk: ${message}`);
  }
};

// src/utils/handleValueOrFn.ts
function handleValueOrFn(value, url, defaultValue) {
  if (typeof value === "function") {
    return value(url);
  }
  if (typeof value !== "undefined") {
    return value;
  }
  if (typeof defaultValue !== "undefined") {
    return defaultValue;
  }
  return void 0;
}

// src/utils/fastDeepMerge.ts
var fastDeepMergeAndReplace = (source, target) => {
  if (!source || !target) {
    return;
  }
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && typeof source[key] === `object`) {
      if (target[key] === void 0) {
        target[key] = new (Object.getPrototypeOf(source[key])).constructor();
      }
      fastDeepMergeAndReplace(source[key], target[key]);
    } else if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
  }
};
var fastDeepMergeAndKeep = (source, target) => {
  if (!source || !target) {
    return;
  }
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && typeof source[key] === `object`) {
      if (target[key] === void 0) {
        target[key] = new (Object.getPrototypeOf(source[key])).constructor();
      }
      fastDeepMergeAndKeep(source[key], target[key]);
    } else if (Object.prototype.hasOwnProperty.call(source, key) && target[key] === void 0) {
      target[key] = source[key];
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  allSettled,
  createDeferredPromise,
  fastDeepMergeAndKeep,
  fastDeepMergeAndReplace,
  handleValueOrFn,
  isDevelopmentEnvironment,
  isProductionEnvironment,
  isStaging,
  isTestEnvironment,
  logErrorInDevMode,
  noop
});
//# sourceMappingURL=index.js.map