import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:client-sdks/client-js',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['type-tests/thread-query.test-d.ts', 'type-tests/server-errors.test-d.ts'],
      tsconfig: './type-tests/tsconfig.thread-query.json',
    },
  },
});
