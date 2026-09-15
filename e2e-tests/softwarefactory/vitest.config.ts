import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['softwarefactory.test.ts'],
    globalSetup: './setup.ts',
    // Scaffolding installs a full project through the local registry and
    // builds/boots it — generous timeouts are expected here.
    testTimeout: 20 * 60 * 1000,
    hookTimeout: 20 * 60 * 1000,
  },
});
