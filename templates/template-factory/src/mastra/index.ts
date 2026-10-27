/**
 * Platform-deployable Mastra entry for MastraCode.
 *
 * This module is the ONE place deployment env is read. It maps today's env
 * vars onto explicit `MastraFactory` config — instances for behaviors (pubsub,
 * storage, vector), plain values for config (publicUrl, origins) — so anyone
 * reading the entry sees exactly which env var feeds which slot.
 * Everything else (feature readiness, route/middleware assembly, controller
 * construction) lives in `MastraFactory` (`@mastra/factory`).
 *
 * `mastra build` requires the entry to export a `Mastra` instance named
 * `mastra` constructed by a literal `new Mastra(...)` in THIS file (validated
 * by the deployer's `checkConfigExport` Babel plugin) — which is why the
 * factory returns constructor args from `prepare()` instead of the instance.
 * The Mastra CLI consumes this entry everywhere: `mastra dev`, `mastra build`,
 * and `mastra deploy` all bundle this module and let the deployer generate
 * the server.
 */

import { Mastra } from '@mastra/core/mastra';
import { MastraFactory } from '@mastra/factory';
import { PgFactoryStorage, PgVector } from '@mastra/pg';

// One FactoryStorage backend powers agent storage, the factory app tables,
// the distributed project lock, and better-auth; the paired PgVector rides
// the same database for recall search. `DATABASE_URL` matches the platform's
// managed env-var sync for attached databases, so `mastra deploy` populates it.
const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

// Lifecycle, transition-policy, and tool-result rules are owned by the
// installed boards (the built-in Work and Review boards here); nothing is
// configured globally. `configVersion` is the deployment label stamped onto
// audit rows and deferred decisions so they can be traced back to the
// deployment that produced them — bump it when handler behavior changes.
const factoryConfigVersion = 'mastracode-web-v1';

export const factory = new MastraFactory({
  configVersion: factoryConfigVersion,
  sandboxStart: 'eager',
  storage: new PgFactoryStorage({ id: 'factory-storage', connectionString: databaseUrl }),
  vector: new PgVector({ id: 'factory-vectors', connectionString: databaseUrl }),
  // No `sandbox`: with Platform credentials the factory uses a local sandbox
  // under `mastra dev` and a Platform sandbox in deployments.
});

const preparedArgs = await factory.prepare();

// Construct the server-owned Mastra HERE so the `new Mastra(...)` literal lives
// in the entry file (see module docs). `prepare()` returns the constructor args
// carrying the controller (via `agentControllers`), storage, and the assembled
// `server` config (middleware + apiRoutes + cors). Keep the worker-relevant
// properties explicit so deploy builds can statically detect the worker topology.
export const mastra = new Mastra({
  ...preparedArgs,
  storage: preparedArgs.storage,
  pubsub: preparedArgs.pubsub,
  workers: preparedArgs.workers,
  workflows: preparedArgs.workflows,
});

// Post-construct boot: initialize the controller (which now inherits this
// instance's storage) and start its workers. Runs at module load via top-level
// await, so the deployer imports a fully-booted instance.
await factory.finalize();
