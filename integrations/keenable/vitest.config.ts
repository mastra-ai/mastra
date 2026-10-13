import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/keenable',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
