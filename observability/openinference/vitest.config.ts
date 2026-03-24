import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/openinference',
    isolate: false,
    globals: true,
    environment: 'node',
  },
});
