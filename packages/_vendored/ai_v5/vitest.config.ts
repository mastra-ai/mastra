import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/_vendored/ai_v5',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
