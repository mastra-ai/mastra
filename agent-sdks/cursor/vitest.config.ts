import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:agent-sdks/cursor',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
