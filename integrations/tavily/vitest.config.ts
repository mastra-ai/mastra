import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/tavily',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
