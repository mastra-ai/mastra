import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:pubsub/google-cloud-pubsub',
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
    isolate: false,
    sequence: { groupOrder: 1 },
  },
});
