/**
 * Fixture project root: `src/mastra/index.ts`.
 *
 * This file represents what a real Mastra user owns. The CLI bundlers
 * (`BuildBundler` for the server, `WorkerBundler` for workers) generate
 * an entry file that imports `mastra` from here and calls
 * `createNodeServer(mastra, ...)` or `mastra.startWorkers(name?)` —
 * users do not write entry files themselves.
 *
 * The cross-process tests use the same shape: they spawn one of two
 * generic entry files (`app.server.entry.ts` / `app.worker.entry.ts`)
 * that mirror what the bundlers emit, against this `mastra` export.
 * That way the test surface matches the deployment model — the user
 * writes only their `Mastra` instance.
 *
 * Storage URL and Redis URL are read from env so the same project can
 * be reused across every test (each test makes its own libsql file).
 */
import { buildMastra } from '../../../shared.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6381';
const storageUrl = process.env.STORAGE_URL ?? 'file::memory:';

export const mastra = buildMastra({ storageUrl, redisUrl });
