import {
  isDevelopmentEnvironment
} from "./chunk-7HPDNZ3R.mjs";

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

// src/utils/logErrorInDevMode.ts
var logErrorInDevMode = (message) => {
  if (isDevelopmentEnvironment()) {
    console.error(`Clerk: ${message}`);
  }
};

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

export {
  allSettled,
  logErrorInDevMode,
  fastDeepMergeAndReplace,
  fastDeepMergeAndKeep
};
//# sourceMappingURL=chunk-ARQUL5DC.mjs.map