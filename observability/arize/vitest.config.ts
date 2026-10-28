import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/arize',
    isolate: true,
    globals: true,
    environment: 'node',
  },
});
