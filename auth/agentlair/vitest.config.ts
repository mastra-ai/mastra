import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:auth/agentlair',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
