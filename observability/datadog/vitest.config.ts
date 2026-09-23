import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/datadog',
    // tracing/bridge mock 'dd-trace' differently and compliance uses the real SDK;
    // a shared module graph binds to whichever file loaded first.
    isolate: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
