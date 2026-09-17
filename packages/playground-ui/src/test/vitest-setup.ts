import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw-server';

// Node.js ships a global Web Storage implementation that is only functional
// when the process starts with `--localstorage-file`. Vitest's jsdom
// environment cannot shadow that global, so on recent Node versions
// `localStorage.getItem` (and friends) are not functions and every test that
// touches storage fails. Install a functional in-memory implementation
// whenever the ambient one is unusable, so the suite runs on any Node
// version without extra flags.
const createMemoryWebStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  };
};

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let functional = false;
  try {
    const ambient = (globalThis as Record<string, unknown>)[name] as Partial<Storage> | undefined;
    functional = typeof ambient?.getItem === 'function';
  } catch {
    functional = false;
  }
  if (!functional) {
    Object.defineProperty(globalThis, name, { configurable: true, value: createMemoryWebStorage() });
  }
}

// jsdom's StorageEvent rejects a `storageArea` that is not its own Storage
// wrapper, which the in-memory shim above is not. Fall back to constructing
// without the member and re-attaching it as a plain property, so tests can
// keep dispatching realistic cross-tab storage events.
const NativeStorageEvent = globalThis.StorageEvent;
if (typeof NativeStorageEvent === 'function') {
  class ShimCompatibleStorageEvent extends NativeStorageEvent {
    constructor(type: string, eventInitDict?: StorageEventInit) {
      if (eventInitDict && 'storageArea' in eventInitDict) {
        const { storageArea, ...rest } = eventInitDict;
        try {
          super(type, eventInitDict);
          return;
        } catch {
          super(type, rest);
          Object.defineProperty(this, 'storageArea', { configurable: true, value: storageArea ?? null });
          return;
        }
      }
      super(type, eventInitDict);
    }
  }
  Object.defineProperty(globalThis, 'StorageEvent', { configurable: true, value: ShimCompatibleStorageEvent });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
