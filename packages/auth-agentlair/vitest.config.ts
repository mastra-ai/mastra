import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/auth-agentlair',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
