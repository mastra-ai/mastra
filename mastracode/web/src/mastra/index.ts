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
import { ConsoleLogger, type LogLevelType } from '@mastra/core/logger';
import { LocalSandbox } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgVector, PgFactoryStorage } from '@mastra/pg';
import { PlatformSandbox } from '@mastra/platform-workspace';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { getDatabasePath } from '@mastra/code-sdk/utils/project';
import { DEFAULT_RETENTION } from '@mastra/code-sdk/utils/storage-maintenance';
import {
  MastraFactory,
  ChannelIdentityStorage,
  FactoryProjectsStorage,
  createChannelLinkStateSigner,
  createFactoryRouteAuth,
  createStateSigner,
} from '@mastra/factory';
import { GithubIntegration } from '@mastra/factory/integrations/github/integration';
import { LinearIntegration } from '@mastra/factory/integrations/linear/integration';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { createAgentControllerSlackChannels, createGithubSourceControl } from '../web/channels/slack/slack.js';
import { createSlackConnectRoutes } from '../web/channels/slack/connect-route.js';

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

// Factory dev is auth-less by default. Production can opt out explicitly;
// otherwise MastraFactory installs its platform-backed auth provider.
const authDisabled = process.env.MASTRACODE_AUTH_DISABLED === '1';
let auth: IMastraAuthProvider | null | undefined;

if (authDisabled) {
  auth = null;
}

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

const PLATFORM_SANDBOX_ENV_KEYS = ['MASTRA_ENVIRONMENT_ID', 'MASTRA_PROJECT_ID', 'MASTRA_PLATFORM_SECRET_KEY'] as const;
const hasPlatformSandboxEnv = PLATFORM_SANDBOX_ENV_KEYS.every(key => Boolean(process.env[key]?.trim()));

// Use PlatformSandbox only when its complete identity is configured. Otherwise
// fall back to LocalSandbox for single-user development.
const sandbox = hasPlatformSandboxEnv
  ? new PlatformSandbox()
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
// password. Unset → per-process random secret (single-process local dev only).
const stateSecret = process.env.GITHUB_APP_WEBHOOK_SECRET || process.env.WORKOS_COOKIE_PASSWORD || undefined;

const integrations = [...(github ? [github] : []), ...(linear ? [linear] : [])];

export const factory = new MastraFactory({
  auth,
  integrations,
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
  // flows). See `stateSecret` above.
  stateSecret,
});

const preparedArgs = await factory.prepare();

// Signs the account-linking deep link so a forged sender identity can't hijack
// a link. Same secret as the factory's integration signer.
export const channelLinkStateSigner = createChannelLinkStateSigner(stateSecret);

// The channel-identity + projects domains are registered during
// `factory.prepare()`, so they're resolvable off the shared FactoryStorage by
// the time we get here.
const accountLinks = storage.getDomain<ChannelIdentityStorage>('channel-identity');
const factoryProjects = storage.getDomain<FactoryProjectsStorage>('projects');

const mcAgentController = preparedArgs.agentControllers?.['code'];
if (mcAgentController) {
  mcAgentController.setChannels(
    createAgentControllerSlackChannels({
      getMastra: () => mcAgentController.getMastra(),
      accountLinks,
      channelLinkStateSigner,
      projects: factoryProjects,
      // Repo-backed Slack threads: linked senders with a repo-connected
      // factory get a Factory user-session (repo sandbox) per thread. Only
      // available with the direct GitHub App wiring.
      sourceControl: github ? createGithubSourceControl(github) : undefined,
    }),
  );
}

// The authed `/connect/slack` route (per-user link write). Appended to the
// factory-assembled apiRoutes so it rides the same server + auth gate.
//
// IMPORTANT: use the provider the factory RESOLVED (`preparedArgs.server.auth`),
// not this entry's `auth` variable — that local is only the explicit
// enable/disable override and stays `undefined` when the factory falls back to
// its default MastraAuthStudio provider. Wiring the local here handed the
// route a no-op RouteAuth whose `ensureUser` never resolves anyone, sending
// every visitor into a login loop.
const resolvedAuth = (preparedArgs.server as { auth?: IMastraAuthProvider } | undefined)?.auth;

// Web-initiated "Sign in with Slack" (OIDC) connect flow — enabled when the
// env Slack app's OAuth client credentials are present. The redirect_uri must
// be HTTPS (Slack requirement), so it's built from the channels public URL
// (the tunnel locally); the post-connect redirect returns to the SPA origin.
const slackClientId = process.env.SLACK_APP_CLIENT_ID?.trim();
const slackClientSecret = process.env.SLACK_APP_CLIENT_SECRET?.trim();
const oidcRedirectBase = process.env.MASTRACODE_CHANNELS_PUBLIC_URL ?? process.env.MASTRACODE_PUBLIC_URL;
const slackOidc =
  slackClientId && slackClientSecret && oidcRedirectBase
    ? {
        clientId: slackClientId,
        clientSecret: slackClientSecret,
        redirectBaseUrl: oidcRedirectBase,
        uiOrigin: process.env.MASTRACODE_PUBLIC_URL,
      }
    : undefined;

const slackConnectRoutes = createSlackConnectRoutes({
  auth: createFactoryRouteAuth(resolvedAuth),
  accountLinks,
  channelLinkStateSigner,
  tenantStateSigner: createStateSigner(stateSecret),
  oidc: slackOidc,
  projects: factoryProjects,
});
preparedArgs.server = {
  ...preparedArgs.server,
  apiRoutes: [...(preparedArgs.server?.apiRoutes ?? []), ...slackConnectRoutes],
};

// Construct the server-owned Mastra HERE so the `new Mastra(...)` literal lives
// in the entry file (see module docs). `prepare()` returns the constructor args
// carrying the controller (via `agentControllers`), storage, and the assembled
// `server` config (middleware + apiRoutes + cors). The Slack channels are
// layered onto the controller above via `setChannels`, and the debug logger is
// set here so channel rendering rides the same deployed instance while the
// factory keeps owning the rest of the config.
export const mastra: Mastra = new Mastra({
  ...preparedArgs,
  logger: new ConsoleLogger({ level: (process.env.LOG_LEVEL as LogLevelType) ?? 'debug' }),
});

// Post-construct boot: initialize the controller (which now inherits this
// instance's storage) and start its workers. Runs at module load via top-level
// await, so the deployer imports a fully-booted instance.
await factory.finalize();
