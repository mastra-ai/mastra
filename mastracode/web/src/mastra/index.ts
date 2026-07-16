/**
 * Platform-deployable Mastra entry for MastraCode.
 *
 * This module is the ONE place deployment env is read. It maps today's env
 * vars onto explicit `MastraFactory` config — instances for behaviors (pubsub),
 * plain values for config (database connection string, publicUrl, origins) —
 * so anyone reading the entry sees exactly which env var feeds which slot.
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

import { Mastra } from '@mastra/core/mastra';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { BetterAuthWebAuth } from '../web/auth-better-adapter.js';
import type { WebAuthAdapter } from '../web/auth-adapter.js';
import { WorkOSWebAuth } from '../web/auth-workos-adapter.js';
import { MastraFactory } from '../web/factory-entry.js';

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

export const factory = new MastraFactory({
  auth,
  // Agent state (threads, messages, memory, OM, recall vectors) lives in the
  // single app Postgres alongside the github/app tables — one shared DB for
  // all users, separated by `resourceId` scoping. Unset (bare local dev) →
  // default storage resolution applies (local libSQL file).
  database: process.env.APP_DATABASE_URL,
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
