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
import { createFactorySecretEncryption, MastraFactory } from '@mastra/factory';
import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';
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
// Encrypts stored model-provider keys and integration secrets at rest.
// `npm create factory` generates this key; keep it stable and backed up.
const encryptionKey = process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY?.trim() || undefined;
if (!encryptionKey) {
  throw new Error('FACTORY_CREDENTIAL_ENCRYPTION_KEY is required. Generate one with `openssl rand -base64 32`.');
}

const factoryConfigVersion = 'mastracode-web-v1';

// A bot token alone can post but cannot receive Slack events or link a sender
// to a Factory account. Webhooks need a signing secret; Socket Mode needs an
// app-level token. Both modes need OAuth credentials for account linking.
const slackSigningSecret = process.env.SLACK_APP_SIGNING_SECRET?.trim();
const slackAppToken = process.env.SLACK_APP_TOKEN?.trim();
const slackBotToken = process.env.SLACK_APP_BOT_TOKEN?.trim() || process.env.SLACK_BOT_TOKEN?.trim();
const slackClientId = process.env.SLACK_APP_CLIENT_ID?.trim();
const slackClientSecret = process.env.SLACK_APP_CLIENT_SECRET?.trim();
const slackConfigured = Boolean(
  slackSigningSecret || slackAppToken || slackBotToken || slackClientId || slackClientSecret,
);
if (slackConfigured) {
  const required = [
    ...(!slackAppToken && !slackSigningSecret ? ['SLACK_APP_SIGNING_SECRET'] : []),
    ...(!slackBotToken ? ['SLACK_APP_BOT_TOKEN (or SLACK_BOT_TOKEN)'] : []),
    ...(!slackClientId ? ['SLACK_APP_CLIENT_ID'] : []),
    ...(!slackClientSecret ? ['SLACK_APP_CLIENT_SECRET'] : []),
  ];
  if (required.length) {
    throw new Error(
      `Incomplete Slack configuration: set ${required.join(', ')}. Unset all Slack credentials to disable it.`,
    );
  }
}

const publicUrl = process.env.MASTRACODE_PUBLIC_URL?.trim() || undefined;
const slackRedirectUrl = process.env.MASTRACODE_CHANNELS_PUBLIC_URL?.trim() || publicUrl;
if (slackConfigured && !slackRedirectUrl?.startsWith('https://')) {
  throw new Error('Slack account linking requires an HTTPS MASTRACODE_PUBLIC_URL or MASTRACODE_CHANNELS_PUBLIC_URL.');
}
const slack = slackConfigured
  ? new SlackIntegration({
      mode: slackAppToken ? 'socket' : 'webhook',
      appToken: slackAppToken,
      signingSecret: slackSigningSecret,
      botToken: slackBotToken,
      clientId: slackClientId,
      clientSecret: slackClientSecret,
      // Slack requires an HTTPS OIDC redirect. Use a tunnel URL for local dev.
      oidcRedirectBaseUrl: slackRedirectUrl,
      uiOrigin: publicUrl,
    })
  : undefined;

export const factory = new MastraFactory({
  configVersion: factoryConfigVersion,
  sandboxStart: 'eager',
  secretEncryption: createFactorySecretEncryption({
    primary: { id: 'v1', key: Buffer.from(encryptionKey, 'base64') },
  }),
  storage: new PgFactoryStorage({ id: 'factory-storage', connectionString: databaseUrl }),
  vector: new PgVector({ id: 'factory-vectors', connectionString: databaseUrl }),
  // Sign-in callbacks and links use this origin; defaults to http://localhost:4111.
  publicUrl,
  // Stable across restarts/replicas so Slack account-link callbacks can verify OAuth state.
  stateSecret: slackSigningSecret || slackAppToken,
  integrations: slack ? [slack] : [],
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
