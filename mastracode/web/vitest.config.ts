import { defineConfig } from 'vitest/config';

/**
 * Unit tests colocated under `src/**`. The server/controller scenario suite
 * lives under `e2e/web/` with its own explicit `--config`; its globs are
 * disjoint from this one. UI/MSW tests live in mastracode/factory-ui.
 */
export default defineConfig({
  test: {
    name: 'unit:mastracode-web',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
