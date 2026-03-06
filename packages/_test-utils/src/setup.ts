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
import { vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Deterministic crypto.randomUUID — counter resets before each test
// ---------------------------------------------------------------------------
let uuidCounter = 0;

vi.stubGlobal(
  'crypto',
  new Proxy(crypto, {
    get(target, prop, receiver) {
      if (prop === 'randomUUID') {
        return () => {
          uuidCounter++;
          // Pad counter into last 12 hex chars, keeping a valid v4 UUID shape
          const hex = uuidCounter.toString(16).padStart(12, '0');
          return `00000000-0000-4000-8000-${hex}`;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }),
);

beforeEach(() => {
  uuidCounter = 0;
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
