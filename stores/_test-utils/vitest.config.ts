import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:storage-test-utils',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
