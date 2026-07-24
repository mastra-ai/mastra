import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from '@internal/lint/vitest';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * jsdom test project for the TanStack Query hooks + settings components.
 *
 * This is intentionally SEPARATE from `e2e/web/vitest.config.ts` (the
 * node-environment scenario suite that folds the real SSE stream). The globs
 * are disjoint — this project only picks up `*.msw.test.tsx` — so the two
 * suites never cross-pick each other's files.
 *
 * Tests drive the real `fetch`/SDK transport and the real React Query cache;
 * only the network boundary is mocked, via MSW.
 */
const pkgRoot = resolve(here, '../..');

export default defineConfig({
  root: pkgRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(pkgRoot, 'src/shared'),
      '@web': resolve(pkgRoot, 'src/web'),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // playground-ui ships `.css` imports in its ESM dist; when installed from
    // the registry it lives in node_modules, so vitest must inline it for Vite
    // to transform those imports instead of Node loading them natively.
    server: { deps: { inline: [/@mastra\/playground-ui/] } },
    // Co-located with source under `src/**`, never the node scenario suite.
    include: ['src/**/*.msw.test.tsx'],
    setupFiles: [resolve(here, 'vitest.setup.ts')],
    testTimeout: 10_000,
  },
});
