import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/elasticsearch',
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
