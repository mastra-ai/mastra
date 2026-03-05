/**
 * Vitest setup file that silences Mastra logging by default.
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
import { vi } from 'vitest';

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
