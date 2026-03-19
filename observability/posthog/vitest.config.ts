import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/posthog',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
