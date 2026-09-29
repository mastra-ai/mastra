import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.scratch/vite',
  // The standalone example can have its own install; unit mocks use the package's pinned pg.
  resolve: { dedupe: ['pg'] },
  test: { include: ['src/**/*.test.ts'], testTimeout: 15000, fileParallelism: false },
});
