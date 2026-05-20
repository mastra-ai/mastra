import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/arthur',
    isolate: false,
    globals: true,
    environment: 'node',
  },
});
