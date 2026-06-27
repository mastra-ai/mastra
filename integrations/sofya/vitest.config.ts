import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/sofya',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
