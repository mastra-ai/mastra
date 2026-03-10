/**
 * Vitest setup file that silences Mastra logging and provides
 * deterministic UUIDs by default.
 *
 * Add to your vitest config:
 * ```ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@internal/test-utils/setup'],
 *   },
 * });
 * ```
 *
 * Tests that need logging can still pass an explicit `logger`:
 * ```ts
 * const m = new Mastra({ logger: new ConsoleLogger({ name: 'test' }) });
 * ```
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Deterministic crypto.randomUUID — each test gets its own counter via
// AsyncLocalStorage so concurrent tests within a file stay isolated.
// Covers both global `crypto.randomUUID()` and
// `import { randomUUID } from 'node:crypto'` / `'crypto'`.
// ---------------------------------------------------------------------------
const uuidStore = new AsyncLocalStorage<{ counter: number }>();
const globalCounter = { counter: 0 };

function deterministicUUID() {
  const ctx = uuidStore.getStore() ?? globalCounter;
  const count = ++ctx.counter;
  const hex = count.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

// Global crypto object
vi.stubGlobal(
  'crypto',
  new Proxy(crypto, {
    get(target, prop, receiver) {
      if (prop === 'randomUUID') return deterministicUUID;
      return Reflect.get(target, prop, receiver);
    },
  }),
);

// Module imports: `import { randomUUID } from 'node:crypto'`
vi.mock('node:crypto', async importOriginal => {
  const original: any = await importOriginal();
  return { ...original, randomUUID: deterministicUUID };
});

// Module imports: `import { randomUUID } from 'crypto'`
vi.mock('crypto', async importOriginal => {
  const original: any = await importOriginal();
  return { ...original, randomUUID: deterministicUUID };
});

// enterWith transitions the current async context into the store.
// vitest runs beforeEach in the same async context as the test,
// so each test (including concurrent ones) gets its own counter.
// We use the shared globalCounter so that sequential tests within a file
// never produce colliding UUIDs — each test continues from where the last left off.
beforeEach(() => {
  uuidStore.enterWith(globalCounter);
});

// ---------------------------------------------------------------------------
// Silent Mastra logger
// ---------------------------------------------------------------------------
function wrapMastraModule(original: any) {
  const OriginalMastra = original.Mastra;
  if (!OriginalMastra) return original;

  class TestMastra extends OriginalMastra {
    constructor(config?: Record<string, unknown>) {
      super({ ...config, logger: config?.logger ?? false });
    }
  }

  Object.defineProperty(TestMastra, 'name', { value: 'Mastra' });

  return { ...original, Mastra: TestMastra };
}

// vi.mock calls are hoisted by vitest, so module paths must be static string literals.
vi.mock('@mastra/core', async importOriginal => wrapMastraModule(await importOriginal()));
vi.mock('@mastra/core/mastra', async importOriginal => wrapMastraModule(await importOriginal()));
