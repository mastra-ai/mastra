import type { MastraStorage } from './base';

const isAugmentedSymbol = Symbol('isAugmented');

export function augmentWithInit(storage: MastraStorage): MastraStorage {
  let hasInitialized: null | Promise<void> = null;

  const ensureInit = async () => {
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
      const value = target[prop as keyof typeof target];
      if (typeof value === 'function' && prop !== 'init') {
        return async (...args: unknown[]) => {
          await ensureInit();

          return Reflect.apply(value, target, args);
        };
      }

      return Reflect.get(target, prop);
    },
  });

  Object.defineProperty(proxy, isAugmentedSymbol, {
    value: true,
    enumerable: false, // Won't show up in Object.keys() or for...in loops
    configurable: true, // Allows the property to be deleted or modified later if needed
  });

  return proxy;
}
