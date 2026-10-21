import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:server-adapters/hono',
    // Several suites here start a real server with `@hono/node-server`'s `serve()`, which replaces
    // `globalThis.Request`/`Response`. Without isolation that replacement leaks into every other file
    // in the worker, so tests that spy on the `Request.prototype` (e.g. middleware-body-read) silently
    // stop counting calls and fail depending on worker packing.
    isolate: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
