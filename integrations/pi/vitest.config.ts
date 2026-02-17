import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/pi',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: false,
    reporters: 'dot',
    bail: 1,
  },
});
