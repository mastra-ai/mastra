/**
 * Generic server entry used by every cross-process test.
 *
 * This file mirrors what `BuildBundler.getEntry()` emits: it imports
 * `mastra` from the user-owned project root and calls `createNodeServer`.
 * Tests set `MASTRA_WORKERS=false` in this process's env so the server
 * itself does not pull workflow events; the standalone worker
 * processes do that and call back to `/workflows/.../steps/execute`
 * via `HttpRemoteStrategy`.
 *
 * Logs `server-ready port=<n>` once the HTTP server is listening.
 */
import { createNodeServer } from '@mastra/deployer/server';
import { mastra } from './cli-project/src/mastra/index.js';

const port = Number(process.env.PORT ?? '4242');

await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });

console.info(`server-ready port=${port}`);

const shutdown = async () => {
  try {
    await mastra.shutdown();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
