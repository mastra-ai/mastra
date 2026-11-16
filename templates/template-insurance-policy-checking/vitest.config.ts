import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  cacheDir: resolve('.runtime/vitest-cache'),
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.studio.test.ts'],
    fsModuleCachePath: resolve('.runtime/vitest-modules'),
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
