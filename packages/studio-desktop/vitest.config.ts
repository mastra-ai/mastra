import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/studio-desktop',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/renderer/**'],
  },
});
