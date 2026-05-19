import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/exa',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
