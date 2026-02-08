import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:workflows/inngest',
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
    isolate: false,
    sequence: { groupOrder: 1 },
  },
});
