import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:voice/google',
    globals: true,
    environment: 'node',
  },
});
