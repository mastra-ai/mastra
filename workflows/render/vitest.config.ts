import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.scratch/vite',
  test: { include: ['src/**/*.test.ts'], testTimeout: 15000, fileParallelism: false },
});
