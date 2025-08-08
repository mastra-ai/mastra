import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 20000, // 20 seconds for setup/teardown
  },
});
