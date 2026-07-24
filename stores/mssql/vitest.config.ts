import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:stores/mssql',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
