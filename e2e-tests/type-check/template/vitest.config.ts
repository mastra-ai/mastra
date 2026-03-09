import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    typecheck: {
      enabled: true,
      include: ['./**/*.test-d.ts'],
      exclude: ['**/node_modules/**'],
    },
  },
});
