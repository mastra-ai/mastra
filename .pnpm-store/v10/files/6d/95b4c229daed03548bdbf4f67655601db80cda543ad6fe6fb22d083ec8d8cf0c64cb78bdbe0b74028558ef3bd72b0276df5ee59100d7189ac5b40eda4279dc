'use strict';

// src/storage/storageWithInit.ts
var isAugmentedSymbol = Symbol("isAugmented");
function augmentWithInit(storage) {
  let hasInitialized = null;
  const ensureInit = async () => {
    if (!hasInitialized) {
      hasInitialized = storage.init();
    }
    await hasInitialized;
  };
  if (storage[isAugmentedSymbol]) {
    return storage;
  }
  const proxy = new Proxy(storage, {
    get(target, prop) {
      if (prop === isAugmentedSymbol) {
        return true;
      }
      const value = target[prop];
      if (typeof value === "function" && prop !== "init") {
        return async (...args) => {
          await ensureInit();
          return Reflect.apply(value, target, args);
        };
      }
      return Reflect.get(target, prop);
    }
  });
  return proxy;
}

exports.augmentWithInit = augmentWithInit;
//# sourceMappingURL=chunk-V3VLOOSW.cjs.map
//# sourceMappingURL=chunk-V3VLOOSW.cjs.map