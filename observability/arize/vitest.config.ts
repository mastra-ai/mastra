import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/arize',
    isolate: false,
    globals: true,
    environment: 'node',
  },
});
