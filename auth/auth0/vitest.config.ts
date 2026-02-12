import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:auth/auth0',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
