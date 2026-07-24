import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:stores/mongodb',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Tests run against a shared dockerized mongod; store.init() alone creates
    // indexes for ~20 domains and takes ~5s under load, so the default 5s
    // per-test timeout flakes. Give docker-backed e2e tests real headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
