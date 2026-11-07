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
// Covers both `globalThis.crypto.randomUUID()` and packages that have not yet
// migrated their `node:crypto` or `crypto` imports.
// ---------------------------------------------------------------------------
const uuidStore = new AsyncLocalStorage<{ counter: number }>();
let fallbackCounter = 0;

function deterministicUUID(): `${string}-${string}-${string}-${string}-${string}` {
  const ctx = uuidStore.getStore();
  const count = ctx ? ++ctx.counter : ++fallbackCounter;
  const hex = count.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

vi.mock('node:crypto', async importOriginal => {
  const original: any = await importOriginal();
  return { ...original, randomUUID: deterministicUUID };
});

vi.mock('crypto', async importOriginal => {
  const original: any = await importOriginal();
  return { ...original, randomUUID: deterministicUUID };
});

// enterWith transitions the current async context into the store.
// vitest runs beforeEach in the same async context as the test,
// so each test (including concurrent ones) gets its own counter.
beforeEach(() => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(deterministicUUID);
  uuidStore.enterWith({ counter: 0 });
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

// ---------------------------------------------------------------------------
// Instant retry backoff
// ---------------------------------------------------------------------------
// Every retry backoff in core (the default StreamErrorRetryProcessor's 3s
// delays, provider Retry-After up to 30s, model-call retries) waits through
// `waitDelay`. Tests exercising retries would otherwise sleep for real. The
// mock keeps one microtask yield so ordering is preserved, and is a vi.fn so a
// test can assert the requested delay from its call args instead of elapsed time.
// Files that test the delay itself opt out with
// `vi.unmock('<relative path to>/utils/retry-after')`.
// Only reaches code that imports core from source (resolved relative to this
// file, which runs from dist/ at the same depth as src/).
vi.mock('../../core/src/utils/retry-after', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  waitDelay: vi.fn(async (_delayMs: number, abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) return;
    await Promise.resolve();
  }),
}));

// The agent's model-call retry (core stream/aisdk/v5/execute.ts) runs through
// p-retry, whose own exponential backoff (1s, 2s, ...) never goes through
// waitDelay. Zero it; retry counts and shouldRetry/onFailedAttempt are unchanged.
// Opt out with `vi.mock('<relative path to>/core/node_modules/p-retry', importOriginal => importOriginal())`
// (`vi.unmock` on this path leaves p-retry's lazy import unresolved under fake timers).
vi.mock('../../core/node_modules/p-retry', async importOriginal => {
  // p-retry is core's dependency, not this package's, so type only what is used.
  type PRetry = (input: unknown, options?: Record<string, unknown>) => Promise<unknown>;
  const original = await importOriginal<{ default: PRetry }>();
  return {
    ...original,
    default: ((input, options) =>
      original.default(input, { ...options, minTimeout: 0, maxTimeout: 0, randomize: false })) satisfies PRetry,
  };
});
