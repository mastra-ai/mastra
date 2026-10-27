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

import { homedir } from 'node:os';
import { join } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { createFactorySecretEncryption, LocalFactorySandbox, MastraFactory } from '@mastra/factory';
import { PgFactoryStorage, PgVector } from '@mastra/pg';
import { PlatformFactorySandbox } from '@mastra/platform-workspace';

// TODO: drop the explicit sandbox once the `@mastra/factory` release that
// defaults it is `latest`. Until then an omitted sandbox means none, and
// `LocalFactorySandbox` needs its root and env spelled out. Only an allow-list
// of host variables reaches sandbox commands, so server secrets such as
// DATABASE_URL stay out of them.
const SANDBOX_ENV_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'TERM',
  'TZ',
  'GIT_EXEC_PATH',
  'GIT_TEMPLATE_DIR',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
];

function localSandbox(): LocalFactorySandbox {
  return new LocalFactorySandbox({
    root: join(homedir(), '.mastracode', 'web', 'sandboxes'),
    env: Object.fromEntries(SANDBOX_ENV_KEYS.flatMap(key => (process.env[key] ? [[key, process.env[key]]] : []))),
  });
}

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
// Encrypts stored model-provider keys and integration secrets at rest.
// `npm create factory` generates this key; keep it stable and backed up.
const encryptionKey = process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY?.trim() || undefined;
if (!encryptionKey) {
  throw new Error('FACTORY_CREDENTIAL_ENCRYPTION_KEY is required. Generate one with `openssl rand -base64 32`.');
}

const factoryConfigVersion = 'mastracode-web-v1';

export const factory = new MastraFactory({
  configVersion: factoryConfigVersion,
  sandboxStart: 'eager',
  secretEncryption: createFactorySecretEncryption({
    primary: { id: 'v1', key: Buffer.from(encryptionKey, 'base64') },
  }),
  storage: new PgFactoryStorage({ id: 'factory-storage', connectionString: databaseUrl }),
  vector: new PgVector({ id: 'factory-vectors', connectionString: databaseUrl }),
  // Sign-in callbacks and links use this origin; defaults to http://localhost:4111.
  publicUrl: process.env.MASTRACODE_PUBLIC_URL?.trim() || undefined,
  // Local sandboxes under `mastra dev`, Platform sandboxes (MASTRA_PROJECT_ID +
  // MASTRA_ENVIRONMENT_ID) in deployments.
  sandbox:
    process.env.MASTRA_DEV === 'true' || process.env.NODE_ENV === 'development'
      ? localSandbox()
      : new PlatformFactorySandbox(),
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
