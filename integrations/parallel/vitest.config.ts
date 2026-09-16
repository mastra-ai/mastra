import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/parallel',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
