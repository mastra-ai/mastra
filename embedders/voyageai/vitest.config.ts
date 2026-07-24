import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: 'dot',
    bail: 1,
  },
});
