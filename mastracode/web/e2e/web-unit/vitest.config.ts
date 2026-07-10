import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '../..');

export default defineConfig({
  root: pkgRoot,
  test: {
    environment: 'node',
    include: ['src/web/**/*.test.ts', 'src/mastra/**/*.test.ts'],
    exclude: ['**/*.scenario.test.ts', '**/node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
