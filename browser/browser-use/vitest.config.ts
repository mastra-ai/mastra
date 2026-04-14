import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:browser/browser-use',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
