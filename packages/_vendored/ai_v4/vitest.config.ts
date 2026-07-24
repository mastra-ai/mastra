import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/_vendored/ai_v4',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
