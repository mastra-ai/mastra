import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/arize',
    isolate: true,
    globals: true,
    environment: 'node',
  },
});
