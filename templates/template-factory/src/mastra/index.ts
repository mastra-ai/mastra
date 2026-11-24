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

// Slack needs a bot token, an event transport, and OAuth credentials to link users.
const slackCredentials = {
  signingSecret: process.env.SLACK_APP_SIGNING_SECRET?.trim(),
  appToken: process.env.SLACK_APP_TOKEN?.trim(),
  botToken: process.env.SLACK_APP_BOT_TOKEN?.trim(),
  clientId: process.env.SLACK_APP_CLIENT_ID?.trim(),
  clientSecret: process.env.SLACK_APP_CLIENT_SECRET?.trim(),
};
const slackConfigured = Object.values(slackCredentials).some(Boolean);
if (
  slackConfigured &&
  (!(slackCredentials.signingSecret || slackCredentials.appToken) ||
    !slackCredentials.botToken ||
    !slackCredentials.clientId ||
    !slackCredentials.clientSecret)
) {
  throw new Error(
    'Slack requires SLACK_APP_BOT_TOKEN, SLACK_APP_CLIENT_ID, SLACK_APP_CLIENT_SECRET, and either SLACK_APP_SIGNING_SECRET or SLACK_APP_TOKEN.',
  );
}

const publicUrl = process.env.MASTRACODE_PUBLIC_URL?.trim() || undefined;
const slackRedirectUrl = process.env.MASTRACODE_CHANNELS_PUBLIC_URL?.trim() || publicUrl;
if (slackConfigured && !slackRedirectUrl?.startsWith('https://')) {
  throw new Error('Slack account linking requires an HTTPS MASTRACODE_PUBLIC_URL or MASTRACODE_CHANNELS_PUBLIC_URL.');
}
const slack = slackConfigured
  ? new SlackIntegration({
      ...slackCredentials,
      mode: slackCredentials.appToken ? 'socket' : 'webhook',
      oidcRedirectBaseUrl: slackRedirectUrl,
      uiOrigin: publicUrl ?? 'http://localhost:4111',
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
  stateSecret: slackCredentials.signingSecret || slackCredentials.appToken,
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
