import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:agent-sdks/claude',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
