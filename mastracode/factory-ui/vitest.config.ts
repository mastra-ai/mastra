import { defineConfig } from 'vitest/config';

/**
 * Unit tests colocated under `src/**`. The MSW UI suite lives under
 * `e2e/ui/` with its own explicit `--config`; its globs are disjoint from
 * this one.
 */
export default defineConfig({
  test: {
    name: 'unit:factory-ui',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
