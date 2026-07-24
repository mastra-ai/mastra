import type { IMastraLogger } from '../logger';
import type { MastraCompositeStore } from './base';

const isAugmentedSymbol = Symbol('isAugmented');
const initIndependentMethods = new Set<PropertyKey>(
  ['__registerMastra', '__setLogger', '__setRawConfig'] satisfies (keyof MastraCompositeStore)[],
);

export function augmentWithInit(storage: MastraCompositeStore): MastraCompositeStore {
  let hasInitialized: null | Promise<void> = null;

  // `logger` is protected on MastraBase, but always assigned at construction
  // time, so we can read it at runtime through a narrow cast.
  const getLogger = (): IMastraLogger | undefined =>
    (storage as MastraCompositeStore & { logger?: IMastraLogger }).logger;

  // Wrap init so a rejection clears the cached promise. Without this,
  // a single transient init failure (e.g. a network blip during boot)
  // would cache the rejection forever and every subsequent storage call
  // would surface the same error with no way to recover short of process
  // restart.
  const cacheInit = (initResult: Promise<void> | void): Promise<void> => {
    const wrapped = Promise.resolve(initResult).then(undefined, err => {
      if (hasInitialized === wrapped) {
        hasInitialized = null;
      }
      // Surface failures even when a follow-up call's retry succeeds.
      // Otherwise transient init failures would recover silently and only
      // be visible to whichever caller happened to be waiting when init
      // first failed.
      getLogger()?.error('Storage init failed; will retry on next storage call', { error: err });
      throw err;
    });
    hasInitialized = wrapped;
    return wrapped;
  };

  const ensureInit = async () => {
    // Skip auto-initialization if disableInit is true
    if (storage.disableInit) {
      return;
    }

    // Environment variable equivalent of disableInit - used by migration CLI
    if (process.env.MASTRA_DISABLE_STORAGE_INIT === 'true') {
      return;
    }

    const promise = hasInitialized ?? cacheInit(storage.init());

    await promise;
  };

  // if we already have a proxy, return it
  // instanceof Proxy doesnt work in vitest https://github.com/vitejs/vite/discussions/14490
  // @ts-expect-error - symbol is not defined on the storage
  if (storage[isAugmentedSymbol]) {
    return storage;
  }

  // Override storage operations to wait until init is complete.
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
            return hasInitialized ?? cacheInit(Reflect.apply(value, target, args) as Promise<void>);
          };
        }

        // Internal housekeeping methods are synchronous and do not access the database.
        if (initIndependentMethods.has(prop)) {
          return (...args: unknown[]) => Reflect.apply(value, target, args);
        }

        // Database-facing functions wait for init.
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
