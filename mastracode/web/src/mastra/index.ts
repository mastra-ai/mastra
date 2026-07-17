/**
 * Platform-deployable Mastra entry for MastraCode.
 *
 * This module is the ONE place deployment env is read. It maps today's env
 * vars onto explicit `MastraFactory` config — instances for behaviors (pubsub,
 * storage, vector), plain values for config (publicUrl, origins) — so anyone
 * reading the entry sees exactly which env var feeds which slot.
 * Everything else (feature readiness, route/middleware assembly, controller
 * construction) lives in `MastraFactory` (`../web/factory-entry.ts`).
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
import { LocalSandbox } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { PgVector, PostgresStore } from '@mastra/pg';
import { RailwaySandbox } from '@mastra/railway';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { DEFAULT_RETENTION } from '@mastra/code-sdk/utils/storage-maintenance';
import { BetterAuthWebAuth } from '../web/auth-better-adapter.js';
import type { WebAuthAdapter } from '../web/auth-adapter.js';
import { WorkOSWebAuth } from '../web/auth-workos-adapter.js';
import { MastraFactory } from '../web/factory-entry.js';

/**
 * Parse a positive-integer env knob; anything else means "use the default".
 * Fractional values are rejected rather than floored — flooring `0.5` to `0`
 * would silently disable a capacity knob or turn an idle window into
 * immediate expiry.
 */
function positiveInt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

// Distributed pub/sub: when `REDIS_URL` is set, events (streams, workflows,
// signals) ride Redis Streams so multiple web server processes can share one
// event bus. RedisStreamsPubSub also implements LeaseProvider, so the factory
// marks it cross-process and the controller drops its file-based thread locks
// in favor of pubsub-coordinated leases. Without `REDIS_URL` (bare local dev)
// the in-process default applies.
const redisUrl = process.env.REDIS_URL;
const pubsub = redisUrl ? new RedisStreamsPubSub({ url: redisUrl }) : undefined;
if (redisUrl) {
  // Redact credentials before logging (REDIS_URL may embed a password).
  let redisTarget = 'redis';
  try {
    const parsed = new URL(redisUrl);
    redisTarget = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // Unparseable URL — RedisStreamsPubSub will surface the real error; keep the log generic.
  }
  console.log(`[PubSub] REDIS_URL set — event bus on Redis Streams (${redisTarget}), cross-process leases enabled.`);
}

// Web auth, by env precedence (any custom `WebAuthAdapter` works here too):
//   1. WORKOS_API_KEY + WORKOS_CLIENT_ID → WorkOS AuthKit (hosted login). The
//      WorkOS SDK reads its own credentials; the redirect URI falls back to
//      `<publicUrl>/auth/callback` inside the adapter's init().
//   2. BETTER_AUTH_SECRET → self-hosted better-auth (email/password on the app
//      Postgres — no external identity vendor in the availability path).
//      MASTRACODE_AUTH_SIGNUP_DISABLED=1 turns off public sign-up.
//   3. Neither → auth disabled (open server, bare local dev).
const workosConfigured = Boolean(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
let auth: WebAuthAdapter | undefined;
if (workosConfigured) {
  auth = new WorkOSWebAuth({ redirectUri: process.env.WORKOS_REDIRECT_URI });
} else if (betterAuthSecret) {
  auth = new BetterAuthWebAuth({
    secret: betterAuthSecret,
    signUpDisabled: process.env.MASTRACODE_AUTH_SIGNUP_DISABLED === '1',
  });
}

// Host env exposed to local sandboxes: an allow-list only, so app secrets
// (GITHUB_APP_PRIVATE_KEY, WORKOS_API_KEY, APP_DATABASE_URL, …) never leak
// into commands run against untrusted repo checkouts. PATH is always added by
// the core LocalSandbox itself; the rest keeps git and TLS working normally.
const LOCAL_SANDBOX_ENV_KEYS = [
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
] as const;

function localSandboxEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of LOCAL_SANDBOX_ENV_KEYS) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

// Sandbox machine, by env precedence (any `WorkspaceSandbox` implementing
// `derive()` works here too — the factory derives one sandbox per GitHub
// project from it):
//   1. MASTRACODE_SANDBOX_PROVIDER=railway|local — explicit selection. Railway
//      selected without a token is a hard misconfiguration error.
//   2. RAILWAY_API_TOKEN set → RailwaySandbox (isolated cloud VMs,
//      multi-tenant safe).
//   3. Neither → LocalSandbox, so repos can always be opened with no extra
//      wiring. WARNING: the local host-process sandbox has NO tenant
//      isolation — repo checkouts and agent commands run as the server
//      process. Single-user local dev only; set a Railway token for shared
//      deployments.
// Budget/GC knobs: MASTRACODE_SANDBOX_IDLE_MINUTES (default 30, baked into the
// Railway template), MASTRACODE_MAX_SANDBOXES (default unlimited),
// MASTRACODE_SANDBOX_WORKDIR (cloud checkout base, default /workspace),
// MASTRACODE_LOCAL_SANDBOX_ROOT (local checkout root, default
// ~/.mastracode/web/sandboxes).
const sandboxKind = process.env.MASTRACODE_SANDBOX_PROVIDER ?? (process.env.RAILWAY_API_TOKEN ? 'railway' : 'local');
const idleMinutes = positiveInt(process.env.MASTRACODE_SANDBOX_IDLE_MINUTES);
let sandbox: WorkspaceSandbox;
if (sandboxKind === 'railway') {
  const railwayToken = process.env.RAILWAY_API_TOKEN;
  if (!railwayToken) {
    throw new Error(
      'MASTRACODE_SANDBOX_PROVIDER=railway requires RAILWAY_API_TOKEN — set the token, or unset the ' +
        'provider to fall back to the local sandbox (single-user dev only).',
    );
  }
  sandbox = new RailwaySandbox({
    token: railwayToken,
    ...(idleMinutes !== undefined ? { idleTimeoutMinutes: idleMinutes } : {}),
  });
} else if (sandboxKind === 'local') {
  sandbox = new LocalSandbox({
    workingDirectory:
      process.env.MASTRACODE_LOCAL_SANDBOX_ROOT?.trim() || join(homedir(), '.mastracode', 'web', 'sandboxes'),
    env: localSandboxEnv(),
  });
} else {
  throw new Error(
    `Unknown MASTRACODE_SANDBOX_PROVIDER "${sandboxKind}" — expected "railway" or "local" ` +
      '(or pass any WorkspaceSandbox implementing derive() to MastraFactory).',
  );
}

// Single app Postgres: one PostgresStore (and one pg pool) powers agent
// storage, the factory app tables, the distributed project lock, and
// better-auth. The paired PgVector rides the same database for recall search.
// Unset (bare local dev) → no instances; the SDK mount falls back to its
// default local libSQL resolution and app-DB-gated features stay off.
const appDatabaseUrl = process.env.APP_DATABASE_URL;
const storage = appDatabaseUrl
  ? new PostgresStore({
      id: 'mastra-code-storage',
      connectionString: appDatabaseUrl,
      retention: DEFAULT_RETENTION,
    })
  : undefined;
const vector = appDatabaseUrl
  ? new PgVector({ id: 'mastra-code-vectors', connectionString: appDatabaseUrl })
  : undefined;

export const factory = new MastraFactory({
  auth,
  sandbox: {
    machine: sandbox,
    // Checkout base inside sandboxes (nested `owner/name` per repo). Unset →
    // the machine's own workingDirectory (local) or `/workspace` (cloud).
    workdir: process.env.MASTRACODE_SANDBOX_WORKDIR,
    // Per-replica cap on concurrently provisioned sandboxes. Unset → unlimited.
    maxSandboxes: positiveInt(process.env.MASTRACODE_MAX_SANDBOXES),
  },
  // Agent state (threads, messages, memory, OM, recall vectors) lives in the
  // single app Postgres alongside the github/app tables — one shared DB (and
  // pg pool) for all users, separated by `resourceId` scoping. Unset (bare
  // local dev) → default storage resolution applies (local libSQL file).
  storage,
  vector,
  pubsub,
  // Browser-facing origin. On the platform the SPA is hosted separately, so
  // this MUST be set to the public API origin.
  publicUrl: process.env.MASTRACODE_PUBLIC_URL,
  // Allowed cross-origin SPA origins (comma-separated). The SPA is served from
  // a separate static host, so credentialed requests must be explicitly allowed.
  allowedOrigins: (process.env.MASTRACODE_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
});

// Construct the server-owned Mastra HERE so the `new Mastra(...)` literal lives
// in the entry file (see module docs). `prepare()` returns the constructor args
// carrying the controller (via `agentControllers`), storage, and the assembled
// `server` config (middleware + apiRoutes + cors).
export const mastra = new Mastra(await factory.prepare());

// Post-construct boot: initialize the controller (which now inherits this
// instance's storage) and start its workers. Runs at module load via top-level
// await, so the deployer imports a fully-booted instance.
await factory.finalize();
