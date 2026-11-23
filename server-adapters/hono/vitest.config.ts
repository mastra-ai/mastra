import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `@mastra/server` loads its MCP Apps from `@mastra/mcp-apps-components`, an optional peer that the server's
// workspace doesn't install (see `pnpm-workspace.yaml`). Point its imports at this package's copy, so the MCP Apps
// tests serve the real apps.
const appsDist = fileURLToPath(new URL('./node_modules/@mastra/mcp-apps-components/dist/', import.meta.url));

export default defineConfig({
  test: {
    name: 'unit:server-adapters/hono',
    // Several suites here start a real server with `@hono/node-server`'s `serve()`, which replaces
    // `globalThis.Request`/`Response`. Without isolation that replacement leaks into every other file
    // in the worker, so tests that spy on the `Request.prototype` (e.g. middleware-body-read) silently
    // stop counting calls and fail depending on worker packing.
    isolate: true,
    alias: [{ find: /^@mastra\/mcp-apps-components\/(.+)$/, replacement: `${appsDist}$1.js` }],
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
