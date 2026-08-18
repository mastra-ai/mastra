import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
