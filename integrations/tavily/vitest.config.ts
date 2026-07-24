import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:integrations/tavily',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
