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
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgVector, PgFactoryStorage } from '@mastra/pg';
import { RailwaySandbox } from '@mastra/railway';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { WorkOS } from '@workos-inc/node';
import { getDatabasePath } from '@mastra/code-sdk/utils/project';
import { DEFAULT_RETENTION } from '@mastra/code-sdk/utils/storage-maintenance';
import { WorkOSAuditIntegration } from '../web/audit/workos-integration.js';
import { MastraFactory } from '../web/factory-entry.js';
import type { FactoryIntegration } from '../web/factory-integration.js';
import { GithubIntegration } from '../web/github/integration.js';
import { LinearIntegration } from '../web/linear/integration.js';

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

// Web auth: MastraFactory installs `MastraAuthStudio` by default (identity
// proxied to the shared Mastra platform API — reads `MASTRA_SHARED_API_URL`,
// `MASTRA_ORGANIZATION_ID`, and `MASTRA_COOKIE_DOMAIN` from env). Set
// `MASTRACODE_AUTH_DISABLED=1` to boot with no auth provider (open server,
// bare local dev).
const auth = process.env.MASTRACODE_AUTH_DISABLED === '1' ? null : undefined;

// WorkOS audit export is an independent capability. Supplying its dedicated
// API key enables mirroring + the Admin Portal route regardless of whether web
// auth uses WorkOS, Better Auth, or is disabled.
const workosAuditApiKey = process.env.WORKOS_AUDIT_API_KEY;
const workosAudit = workosAuditApiKey
  ? new WorkOSAuditIntegration({
      client: new WorkOS(workosAuditApiKey),
      returnUrl: `${(process.env.MASTRACODE_PUBLIC_URL ?? 'http://localhost:4111').replace(/\/+$/, '')}/factory/audit`,
    })
  : undefined;

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
// `clone()` works here too — the factory clones one sandbox per GitHub
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
const idleMinutes = positiveInt(process.env.MASTRACODE_SANDBOX_IDLE_MINUTES) ?? 5;
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
      '(or pass any WorkspaceSandbox implementing clone() to MastraFactory).',
  );
}

// Integrations, all-or-nothing per integration: setting ANY of an
// integration's env vars means you intend to enable it, so a partial set is a
// hard misconfiguration error listing exactly what's missing. No vars set →
// the integration is omitted entirely: its routes never mount, its tools never
// register, and its status endpoint reports "not configured".
function envGroup<K extends string>(
  vars: Record<K, string | undefined>,
  integration: string,
): Record<K, string> | undefined {
  const entries = Object.entries(vars) as Array<[K, string | undefined]>;
  const present = entries.filter(([, value]) => value);
  if (present.length === 0) return undefined;
  const missing = entries.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `${integration} integration is partially configured — missing ${missing.join(', ')}. ` +
        'Set the remaining variable(s) to enable it, or unset the group to disable it.',
    );
  }
  return Object.fromEntries(entries) as Record<K, string>;
}

// GitHub App: signed-in users install the app, pick repos, and turn them into
// projects. The webhook secret is optional (webhook deliveries are rejected
// without it) so it is validated separately from the required group.
const githubEnv = envGroup(
  {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
  },
  'GitHub',
);
const github = githubEnv
  ? new GithubIntegration({
      appId: githubEnv.GITHUB_APP_ID,
      privateKey: githubEnv.GITHUB_APP_PRIVATE_KEY,
      clientId: githubEnv.GITHUB_APP_CLIENT_ID,
      clientSecret: githubEnv.GITHUB_APP_CLIENT_SECRET,
      slug: githubEnv.GITHUB_APP_SLUG,
      webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET,
    })
  : undefined;

// Linear OAuth app: per-org workspace connections + issue intake.
const linearEnv = envGroup(
  {
    LINEAR_CLIENT_ID: process.env.LINEAR_CLIENT_ID,
    LINEAR_CLIENT_SECRET: process.env.LINEAR_CLIENT_SECRET,
  },
  'Linear',
);
const linear = linearEnv
  ? new LinearIntegration({ clientId: linearEnv.LINEAR_CLIENT_ID, clientSecret: linearEnv.LINEAR_CLIENT_SECRET })
  : undefined;

const integrations: FactoryIntegration[] = [github, linear, workosAudit].filter(i => i !== undefined);

// One FactoryStorage backend powers agent storage, the factory app tables,
// the distributed project lock, and better-auth. `APP_DATABASE_URL` set →
// Postgres (the paired PgVector rides the same database for recall search).
// Unset (bare local dev) → libSQL on the same local file the SDK's default
// storage resolution uses, running the FULL app surface (auth, intake,
// audit, work-items, integrations) — no features silently off.
const appDatabaseUrl = process.env.APP_DATABASE_URL;
const localDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
if (!appDatabaseUrl && !localDevelopmentMode) {
  throw new Error('APP_DATABASE_URL is required outside local development and tests.');
}
const storage = appDatabaseUrl
  ? new PgFactoryStorage({
      id: 'mastra-code-storage',
      connectionString: appDatabaseUrl,
      retention: DEFAULT_RETENTION,
    })
  : new LibSQLFactoryStorage({
      id: 'mastra-code-storage',
      url: `file:${getDatabasePath()}`,
      retention: DEFAULT_RETENTION,
    });
const vector = appDatabaseUrl
  ? new PgVector({ id: 'mastra-code-vectors', connectionString: appDatabaseUrl })
  : undefined;

export const factory = new MastraFactory({
  auth,
  sandbox: {
    machine: sandbox,
    // Remote checkout base (nested `owner/name` per repo). LocalSandbox ignores
    // this in-sandbox path and uses its host workingDirectory instead.
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
  // Deployment-stable secret for OAuth `state` signing (GitHub/Linear connect
  // flows). Same resolution the state signer used before it moved into the
  // factory: webhook secret first, then the WorkOS cookie password. Unset →
  // per-process random secret (single-process local dev only).
  stateSecret: process.env.GITHUB_APP_WEBHOOK_SECRET || process.env.WORKOS_COOKIE_PASSWORD || undefined,
  // Registered integrations. Each is constructed above from its own env group
  // (all-or-nothing); an absent integration simply isn't registered — its
  // routes never mount and its status endpoint reports "not configured".
  integrations,
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
