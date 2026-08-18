import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/arthur',
    isolate: false,
    globals: true,
    environment: 'node',
  },
});
