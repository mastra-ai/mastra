import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:integrations/json-render',
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
