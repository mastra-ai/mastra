import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/_test-utils',
    isolate: false,
    environment: 'node',
    include: ['*.test.ts'],
  },
});
