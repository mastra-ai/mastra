import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/context',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
