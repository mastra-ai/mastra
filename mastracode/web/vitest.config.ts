import { defineConfig } from '@internal/lint/vitest';

/**
 * Unit tests colocated under `src/**`. The two e2e suites live under `e2e/`
 * with their own explicit `--config`s (node scenarios and jsdom MSW tests);
 * their globs are disjoint from this one.
 */
export default defineConfig({
  test: {
    name: 'unit:mastracode-web',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
