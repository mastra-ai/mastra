import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:integrations/perplexity',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
