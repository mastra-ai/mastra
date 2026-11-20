import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:stores/turso',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
