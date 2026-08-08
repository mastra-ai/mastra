import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:voice/mistral',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
