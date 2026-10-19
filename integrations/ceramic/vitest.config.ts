import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/ceramic',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
