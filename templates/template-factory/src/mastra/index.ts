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
import { PlatformSandbox, createRepoTemplate as createPlatformRepoTemplate } from '@mastra/platform-workspace';
import { MastraFactory } from '@mastra/factory';

// Provider precedence: Platform when its env trio is set, else LocalSandbox.
// Sandboxes are created lazily per session on the first command; repo
// templates pre-warm the checkout where the provider supports it.
const PLATFORM_SANDBOX_ENV_KEYS = [
  'MASTRA_PLATFORM_ACCESS_TOKEN',
  'MASTRA_ENVIRONMENT_ID',
  'MASTRA_PROJECT_ID',
] as const;
const hasPlatformSandboxEnv = PLATFORM_SANDBOX_ENV_KEYS.every(key => Boolean(process.env[key]?.trim()));

if (!hasPlatformSandboxEnv) {
  throw new Error(
    'MASTRA_PLATFORM_ACCESS_TOKEN, MASTRA_ENVIRONMENT_ID, and MASTRA_PROJECT_ID are required when using the platform integration.',
  );
}

// One FactoryStorage backend powers agent storage, the factory app tables,
// the distributed project lock, and better-auth. `DATABASE_URL` set →
// Postgres (the paired PgVector rides the same database for recall search).
// Unset (bare local dev) → libSQL on the same local file the SDK's default
// storage resolution uses, running the FULL app surface (auth, intake,
// audit, work-items, integrations) — no features silently off.
//
// `APP_DATABASE_URL` is the deprecated legacy name — still honored as a
// fallback so existing checkouts keep working, but new setups should use
// `DATABASE_URL` (matches the platform's managed env-var sync for attached
// databases, so `mastra deploy` populates it automatically).
const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required outside local development and tests.');
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
  sandbox: ctx => {
    return new PlatformSandbox({
      id: ctx.sessionId,
      template: createPlatformRepoTemplate({
        ...ctx,
        memoryMB: 1024 * 8,
        cpuCount: 4,
      }),
    });
  },
});

const preparedArgs = await factory.prepare();

// Construct the server-owned Mastra HERE so the `new Mastra(...)` literal lives
// in the entry file (see module docs). `prepare()` returns the constructor args
// carrying the controller (via `agentControllers`), storage, and the assembled
// `server` config (middleware + apiRoutes + cors).
export const mastra = new Mastra({
  ...preparedArgs,
});

// Post-construct boot: initialize the controller (which now inherits this
// instance's storage) and start its workers. Runs at module load via top-level
// await, so the deployer imports a fully-booted instance.
await factory.finalize();
