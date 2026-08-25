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
import { LocalSandbox } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgVector, PgFactoryStorage } from '@mastra/pg';
import { InProcessSandboxAddressRegistry, PlatformSandbox } from '@mastra/platform-workspace';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { getDatabasePath } from '@mastra/code-sdk/utils/project';
import { DEFAULT_RETENTION } from '@mastra/code-sdk/utils/storage-maintenance';
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { createFactorySecretEncryption, MastraFactory } from '@mastra/factory';
import { defaultFactoryRules } from '@mastra/factory/rules/defaults';
import type { FactoryStageRuleContext } from '@mastra/factory/rules/types';
import { GithubIntegration } from '@mastra/factory/integrations/github/integration';
import { parseAuthorizedBotsEnv } from '@mastra/factory/integrations/github/webhook';
import { LinearIntegration } from '@mastra/factory/integrations/linear/integration';
import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';
import type { IMastraAuthProvider } from '@mastra/core/server';

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

function decodeCredentialEncryptionKey(name: string, encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.byteLength !== 32) throw new Error(`${name} must contain base64-encoded 32-byte keys.`);
  return key;
}

function credentialEncryption() {
  const encodedKey = process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!encodedKey) {
    throw new Error('FACTORY_CREDENTIAL_ENCRYPTION_KEY is required when Factory auth is enabled.');
  }

  const previousKeys: Record<string, unknown> = process.env.FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS
    ? JSON.parse(process.env.FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS)
    : {};
  if (!previousKeys || Array.isArray(previousKeys) || typeof previousKeys !== 'object') {
    throw new Error('FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS must be a JSON object of key ids to base64 keys.');
  }

  return createFactorySecretEncryption({
    primary: {
      id: process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY_ID?.trim() || 'v1',
      key: decodeCredentialEncryptionKey('FACTORY_CREDENTIAL_ENCRYPTION_KEY', encodedKey),
    },
    previous: Object.entries(previousKeys).map(([id, value]) => {
      if (typeof value !== 'string') {
        throw new Error('FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS values must be base64 strings.');
      }
      return { id, key: decodeCredentialEncryptionKey('FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS', value) };
    }),
  });
}

function investigateIntakeIssue(context: FactoryStageRuleContext) {
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-triage`,
    role: 'triage',
    skillName: 'factory-triage',
    arguments: context.item.url ? `GitHub issue (${context.item.url})` : context.item.title,
  } as const;
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

// Auth selection, ordered by how explicit the operator's intent is:
//   1. MASTRACODE_AUTH_DISABLED=1 — explicit opt-out, auth off entirely.
//   2. MASTRA_SHARED_API_URL — explicit platform deferral; identity rides the
//      shared platform API (`.env.schema` names this the highest-precedence
//      auth config), so it wins even over a configured WORKOS_* pair — but
//      loudly, because silently ignoring sign-in config is how self-hosted
//      logins end up 302-ing somewhere that rejects their redirect_uri.
//   3. WORKOS_API_KEY + WORKOS_CLIENT_ID — self-managed WorkOS sign-in. The
//      constructor reads the rest of the WORKOS_* group from env, and
//      `init()` derives the /auth/callback redirect from the deployment's
//      publicUrl when WORKOS_REDIRECT_URI is unset. `fetchMemberships` lets
//      token auth resolve the user's organization so the bootstrapped
//      personal org works without re-auth. Note MASTRA_PLATFORM_ACCESS_TOKEN /
//      MASTRA_PLATFORM_SECRET_KEY do NOT defer to the platform here: they are
//      compute/integration credentials (sandboxes, GitHub/Linear slots), not
//      identity signals — platform compute plus self-managed sign-in is a
//      supported combination.
//   4. Nothing configured — leave undefined and MastraFactory installs its
//      platform-backed default provider.
const authDisabled = process.env.MASTRACODE_AUTH_DISABLED === '1';
const workosConfigured = Boolean(process.env.WORKOS_API_KEY?.trim() && process.env.WORKOS_CLIENT_ID?.trim());
let auth: IMastraAuthProvider | null | undefined;

if (authDisabled) {
  auth = null;
} else if (process.env.MASTRA_SHARED_API_URL?.trim()) {
  if (workosConfigured) {
    console.warn(
      '[Auth] WORKOS_API_KEY/WORKOS_CLIENT_ID are set but ignored: MASTRA_SHARED_API_URL takes precedence, so sign-in defers to the platform. Unset MASTRA_SHARED_API_URL to use self-managed WorkOS auth.',
    );
  }
} else if (workosConfigured) {
  auth = new MastraAuthWorkos({ fetchMemberships: true });
}
const secretEncryption = auth === null ? undefined : credentialEncryption();

// Direct GitHub App fallback: when the platform-backed integration isn't in
// play (self-hosted / local deploys), a complete GITHUB_APP_* env group wires
// a GithubIntegration so the app still gets a real GitHub connection — Connect
// GitHub in onboarding, the repo picker, and webhooks. A partial group stays
// disabled so the status route can report exactly what's missing.
const githubAppId = process.env.GITHUB_APP_ID?.trim();
const githubPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
const githubClientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
const githubClientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
const githubAppSlug = process.env.GITHUB_APP_SLUG?.trim();
const github =
  githubAppId && githubPrivateKey && githubClientId && githubClientSecret && githubAppSlug
    ? new GithubIntegration({
        appId: githubAppId,
        privateKey: githubPrivateKey,
        clientId: githubClientId,
        clientSecret: githubClientSecret,
        slug: githubAppSlug,
        webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() || undefined,
        // Extra reviewer bot logins this deployment trusts to trigger
        // review/comment notifications, on top of the built-in defaults.
        authorizedBots: parseAuthorizedBotsEnv(process.env.MASTRACODE_GITHUB_AUTHORIZED_BOTS),
      })
    : undefined;

// Direct Linear OAuth fallback for self-hosted / local deploys. As with the
// GitHub fallback, only a complete credential group enables the integration;
// partial configuration remains available to the diagnostics routes.
const linearClientId = process.env.LINEAR_CLIENT_ID?.trim();
const linearClientSecret = process.env.LINEAR_CLIENT_SECRET?.trim();
const linear =
  linearClientId && linearClientSecret
    ? new LinearIntegration({
        clientId: linearClientId,
        clientSecret: linearClientSecret,
      })
    : undefined;

// Host env exposed to local sandboxes: an allow-list only, so app secrets
// (GITHUB_APP_PRIVATE_KEY, WORKOS_API_KEY, DATABASE_URL, …) never leak into
// commands run against untrusted repo checkouts. PATH is always added by the
// core LocalSandbox itself; the rest keeps git and TLS working normally.
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

const PLATFORM_SANDBOX_ENV_KEYS = ['MASTRA_ENVIRONMENT_ID', 'MASTRA_PROJECT_ID'] as const;
// MASTRA_PLATFORM_ACCESS_TOKEN is the credential Mastra Platform injects into
// deployed projects; MASTRA_PLATFORM_SECRET_KEY is the org secret key written
// by project scaffolding. `PlatformSandbox` only reads the former from env, so
// whichever is present is passed to it explicitly as `accessToken`.
const platformSandboxToken =
  process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim() || process.env.MASTRA_PLATFORM_SECRET_KEY?.trim();
const hasPlatformSandboxEnv =
  Boolean(platformSandboxToken) && PLATFORM_SANDBOX_ENV_KEYS.every(key => Boolean(process.env[key]?.trim()));

// Private-network exec: the workspace-proxy discovers each sandbox's private
// IPv6 during `POST /v1/projects/:pid/sandbox` and returns it as an
// `instanceUrl` field. `PlatformSandbox.start()` copies that field into this
// in-process registry; `PlatformSandbox.executeCommand()` reads it on every
// exec to dial the sidecar's `POST /exec` directly over Railway's private
// network, falling back to the lease path when no address is registered or
// a dial fails. Only constructed when `PlatformSandbox` is in play; a
// `LocalSandbox` dev run has no sidecar and no need for the registry.
const sandboxAddressRegistry = hasPlatformSandboxEnv ? new InProcessSandboxAddressRegistry() : undefined;

// Use PlatformSandbox only when its complete identity is configured. Otherwise
// fall back to LocalSandbox for single-user development.
const sandbox = hasPlatformSandboxEnv
  ? new PlatformSandbox({ accessToken: platformSandboxToken, addressRegistry: sandboxAddressRegistry })
  : new LocalSandbox({
      workingDirectory:
        process.env.MASTRACODE_LOCAL_SANDBOX_ROOT?.trim() || join(homedir(), '.mastracode', 'web', 'sandboxes'),
      env: localSandboxEnv(),
    });

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
const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim() || undefined;
if (process.env.APP_DATABASE_URL?.trim() && !process.env.DATABASE_URL?.trim()) {
  console.warn(
    '[mastracode-web] APP_DATABASE_URL is deprecated — rename it to DATABASE_URL. ' +
      'The old name is honored as a fallback for now, but new deploys should use DATABASE_URL.',
  );
}
const localDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
if (!databaseUrl && !localDevelopmentMode) {
  throw new Error('DATABASE_URL is required outside local development and tests.');
}

const storage = databaseUrl
  ? new PgFactoryStorage({
      id: 'mastra-code-storage',
      connectionString: databaseUrl,
      retention: DEFAULT_RETENTION,
    })
  : new LibSQLFactoryStorage({
      id: 'mastra-code-storage',
      url: `file:${getDatabasePath()}`,
      retention: DEFAULT_RETENTION,
    });
const vector = databaseUrl ? new PgVector({ id: 'mastra-code-vectors', connectionString: databaseUrl }) : undefined;

// Deployment-stable secret for OAuth/link `state` signing. Shared by the
// factory's integration signer and the channel-account-link deep link so both
// sign/verify with the same key: webhook secret first, then the WorkOS cookie
// password, then the Slack signing secret so a Slack-only deployment still has
// a stable signer. Unset → per-process random secret (single-process local dev
// only).
const stateSecret =
  process.env.GITHUB_APP_WEBHOOK_SECRET ||
  process.env.WORKOS_COOKIE_PASSWORD ||
  process.env.SLACK_APP_SIGNING_SECRET ||
  undefined;

// Slack channels + account linking. Optional: the Slack adapter validates the
// signing secret at construction, so the integration is only built when the
// Slack app env is configured. Repo-backed Slack threads come from the
// factory's source-control owner (GitHub) — the integration wires itself.
const slackSigningSecret = process.env.SLACK_APP_SIGNING_SECRET?.trim();
const slack = slackSigningSecret
  ? new SlackIntegration({
      signingSecret: slackSigningSecret,
      botToken: process.env.SLACK_APP_BOT_TOKEN,
      clientId: process.env.SLACK_APP_CLIENT_ID?.trim(),
      clientSecret: process.env.SLACK_APP_CLIENT_SECRET?.trim(),
      // Slack requires an HTTPS redirect_uri, which locally is the tunnel
      // origin rather than the app's own public URL.
      oidcRedirectBaseUrl: process.env.MASTRACODE_CHANNELS_PUBLIC_URL ?? process.env.MASTRACODE_PUBLIC_URL,
      uiOrigin: process.env.MASTRACODE_PUBLIC_URL,
    })
  : undefined;

const integrations = [...(github ? [github] : []), ...(linear ? [linear] : []), ...(slack ? [slack] : [])];

export const factoryRules = defaultFactoryRules({
  version: 'mastracode-web-v1',
  overrides: {
    work: {
      intake: {
        issue: { onEnter: investigateIntakeIssue },
      },
    },
  },
});

export const factory = new MastraFactory({
  auth,
  secretEncryption,
  integrations,
  rules: factoryRules,
  sandbox: {
    machine: sandbox,
    // Remote checkout base (nested `owner/name` per repo). LocalSandbox ignores
    // this in-sandbox path and uses its host workingDirectory instead.
    workdir: process.env.MASTRACODE_SANDBOX_WORKDIR,
    // Per-replica cap on concurrently provisioned sandboxes. Unset → unlimited.
    maxSandboxes: positiveInt(process.env.MASTRACODE_MAX_SANDBOXES),
  },
  // Per-replica cap on concurrent Factory background dispatches. Unset means
  // the dispatcher default; invalid and non-positive values are ignored.
  dispatcher: {
    maxInFlight: positiveInt(process.env.MASTRACODE_DISPATCH_MAX_IN_FLIGHT),
  },
  // Agent state (threads, messages, memory, OM, recall vectors) lives in the
  // single app Postgres alongside the github/app tables — one shared DB (and
  // pg pool) for all users, separated by `resourceId` scoping. Unset (bare
  // local dev) → default storage resolution applies (local libSQL file).
  storage,
  vector,
  pubsub,
  platform: {
    // The deployment's own self-hosted App slug, when one is configured. It is
    // NOT Platform's identity: Platform posts as its own App, which names
    // itself. Reusing this value for that purpose left self-recognition
    // comparing against `undefined[bot]` on every Platform deployment, where
    // this is legitimately unset.
    githubAppSlug,
  },
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
  // flows). See `stateSecret` above.
  stateSecret,
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
