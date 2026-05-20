import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/perplexity',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
