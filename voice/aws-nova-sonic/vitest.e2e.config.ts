import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/aws-nova-sonic:integration',
    globals: true,
    include: ['src/**/*.e2e.test.ts'],
    testTimeout: 30_000,
  },
});
