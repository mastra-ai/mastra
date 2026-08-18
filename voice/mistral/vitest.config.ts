import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/mistral',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
