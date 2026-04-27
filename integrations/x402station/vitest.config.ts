import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/x402station',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
