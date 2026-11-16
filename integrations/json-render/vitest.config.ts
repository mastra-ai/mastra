import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/json-render',
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
