import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:auth/auth0',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
