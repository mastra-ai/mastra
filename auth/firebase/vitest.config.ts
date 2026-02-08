import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:auth/firebase',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
