import type { MastraCompositeStore } from './base';

const isAugmentedSymbol = Symbol('isAugmented');

export function augmentWithInit(storage: MastraCompositeStore): MastraCompositeStore {
  let hasInitialized: null | Promise<void> = null;

  const ensureInit = async () => {
    // Skip auto-initialization if disableInit is true
    if (storage.disableInit) {
      return;
    }

    if (!hasInitialized) {
      hasInitialized = storage.init();
    }

    await hasInitialized;
  };

  // if we already have a proxy, return it
  // instanceof Proxy doesnt work in vitest https://github.com/vitejs/vite/discussions/14490
  // @ts-expect-error - symbol is not defined on the storage
  if (storage[isAugmentedSymbol]) {
    return storage;
  }

  // override al functions to wait until init is complete
  const proxy = new Proxy(storage, {
    get(target, prop) {
      // Handle the isAugmentedSymbol specifically
      if (prop === isAugmentedSymbol) {
        return true;
      }

      const value = target[prop as keyof typeof target];
      if (typeof value === 'function') {
        // Special handling for init to track that it was called
        if (prop === 'init') {
          return async (...args: unknown[]) => {
            if (!hasInitialized) {
              hasInitialized = Reflect.apply(value, target, args) as Promise<void>;
            }
            return hasInitialized;
          };
        }

        // All other functions wait for init
        return async (...args: unknown[]) => {
          await ensureInit();

          return Reflect.apply(value, target, args);
        };
      }

      return Reflect.get(target, prop);
    },
  });

  return proxy;
}
