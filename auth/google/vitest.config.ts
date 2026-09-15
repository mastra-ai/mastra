import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:auth/google',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
