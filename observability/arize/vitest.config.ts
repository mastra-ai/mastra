import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/arize',
    isolate: false,
    globals: true,
    environment: 'node',
  },
});
