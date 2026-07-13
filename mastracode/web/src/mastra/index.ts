/**
 * Platform-deployable Mastra entry for MastraCode.
 *
 * `mastra build` requires the entry to export a `Mastra` instance named
 * `mastra` (validated by the `checkConfigExport` Babel plugin). Everything
 * outside that instance is discarded — the deployer generates its own Hono
 * server via `createHonoServer(mastra, ...)`. So this entry folds the ENTIRE
 * web surface onto the instance the deployer builds from:
 *
 *   - `server.apiRoutes`   — the custom `/web/*` routes (fs / config / github),
 *                            already migrated off `/api`, `requiresAuth: false`.
 *   - `server.middleware`  — the WorkOS auth gate (bare handler, runs first) and
 *                            the same-origin SPA static middleware.
 *   - `server.cors`        — the SPA is hosted separately (static host / CDN),
 *                            so cross-origin credentialed requests are allowed
 *                            for the configured origin(s).
 *
 * This entry is the single web surface. The Mastra CLI consumes it everywhere:
 * `mastra dev` (local), `mastra build`, and `mastra deploy` all bundle this
 * module and let the deployer generate the server — there is no separate
 * hand-wired dev bootstrap.
 *
 * NOTE: the deployer's own static serving is Studio-only. The SPA (vite build
 * output) is served same-origin at `/` by the SPA middleware below when a
 * build is found (`web:build` produces one); `server.cors` remains only for
 * the optional separately-hosted-SPA setup. In dev, Vite serves the SPA and
 * proxies API paths here instead.
 */

import { Card, CardText, Actions, LinkButton, type Thread, Message } from 'chat';

import { Mastra } from '@mastra/core/mastra';
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import { buildAuthRoutes, createWebAuthGate, createWebAuthProvider, isWebAuthEnabled } from '../web/auth.js';
import { buildLinearAgentTools } from '../web/linear/agent-tools.js';
import { handleServerError } from '../web/server-error.js';
import { createSpaStaticMiddleware, resolveUiDistDir } from '../web/spa-static.js';
import {
  assembleWebApiRoutes,
  resolveGithubReady,
  resolveIntakeReady,
  resolveLinearReady,
} from '../web/web-surface.js';
import { SlackProvider } from '@mastra/slack';
import { ConsoleLogger } from '@mastra/core/logger';
import { resolveChannelSessionProjectPath } from './channel-session-workspace.js';
import type { ChannelHandlerConfig } from '@mastra/core/channels';

const CONTROLLER_ID = 'code';

/**
 * Browser-facing origin used to build GitHub OAuth/install callback URLs and to
 * derive the WorkOS redirect URI. On the platform the SPA is hosted separately,
 * so this MUST be set to the public API origin via `MASTRACODE_PUBLIC_URL`.
 */
const publicOrigin = (process.env.MASTRACODE_PUBLIC_URL ?? 'http://localhost:4111').replace(/\/+$/, '');

/**
 * Allowed cross-origin SPA origins (comma-separated). The SPA is served from a
 * separate static host, so credentialed requests must be explicitly allowed.
 */
const allowedOrigins = (process.env.MASTRACODE_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// GitHub App + cloud-sandbox readiness, resolved BEFORE constructing Mastra so
// the github routes are simply omitted from `apiRoutes` when unavailable. Fails
// soft (see resolveGithubReady).
const githubReady = await resolveGithubReady();

// Linear intake readiness, same fail-soft pattern as GitHub.
const linearReady = await resolveLinearReady();

// Intake source configuration (Settings › Intake) — needs at least one source.
const intakeReady = await resolveIntakeReady(githubReady || linearReady);

const webAuthEnabled = isWebAuthEnabled();

const redirectUri = process.env.WORKOS_REDIRECT_URI ?? `${publicOrigin}/auth/callback`;

// One WorkOS provider for the process, shared by the gate middleware and the
// public `/auth/*` routes so session encryption/validation stays consistent.
const authProvider = webAuthEnabled ? createWebAuthProvider(redirectUri) : undefined;

// Build the real production controller (agents, modes, tools, memory, OM, MCP,
// providers) — identical to the terminal app — and register it on a Mastra whose
// `server` config owns the whole web surface. The deployer generates its Hono
// server from THIS instance, so the gate, custom routes, and CORS all ride along.
//
// Agent state (threads, messages, memory, OM, recall vectors) lives in the
// single app Postgres (`APP_DATABASE_URL`) alongside the github/app tables —
// one shared DB for all users, separated by `resourceId` scoping. Without
// `APP_DATABASE_URL` (bare local dev) the default storage resolution applies
// (local libSQL file).
const prepared = await prepareAgentControllerMount({
  controllerId: CONTROLLER_ID,
  ...(process.env.APP_DATABASE_URL
    ? { storage: { backend: 'pg', connectionString: process.env.APP_DATABASE_URL } }
    : {}),
  // Linear tools are resolved per session: exposed only when the session's
  // project belongs to an org with an active Linear connection.
  ...(linearReady ? { extraTools: buildLinearAgentTools } : {}),
  buildApiRoutes: ({ controller, authStorage }) => [
    // Public WorkOS `/auth/*` routes (login/callback/logout/me). Folded in as
    // `apiRoutes` (not plain Hono routes) because the entry can't touch the Hono
    // app the deployer generates. `requiresAuth: false`; the gate skips `/auth/*`.
    ...(authProvider ? buildAuthRoutes(authProvider, redirectUri) : []),
    // Custom `/web/*` routes (fs / config / github).
    ...assembleWebApiRoutes({ controller, authStorage, publicOrigin, githubReady, linearReady, intakeReady }),
  ],
  buildServerConfig: () => {
    const cors = allowedOrigins.length ? { cors: { origin: allowedOrigins, credentials: true } } : {};
    // Log route errors with method/path/stack and answer with structured JSON
    // instead of an opaque `Internal Server Error`. Applied by the deployer to
    // both the top-level app and the custom-route sub-app.
    const onError = { onError: handleServerError };
    // Same-origin SPA: when a vite build is present (see resolveUiDistDir),
    // serve it at `/` from this server. Mounted last so the auth gate (when
    // enabled) covers it; it always passes `/api`, `/web`, `/auth` through.
    const uiDist = resolveUiDistDir();
    const spa = uiDist ? [createSpaStaticMiddleware(uiDist)] : [];
    if (!webAuthEnabled || !authProvider) {
      // Auth disabled: no gate. SPA + CORS only.
      return { ...(spa.length ? { middleware: spa } : {}), ...cors, ...onError };
    }

    // Ordered middleware. The deployer applies these AFTER its context
    // middleware sets `c.set('mastra', mastra)` and BEFORE routes, so:
    //   1. gate  — validates the WorkOS session, stashes the user, and 401s /
    //              redirects unauthenticated requests. Skips public `/auth/*`.
    //   2. spa   — serves the built UI for everything the server doesn't own.
    return {
      middleware: [createWebAuthGate(authProvider), ...spa],
      ...cors,
      ...onError,
    };
  },
});

const newSessionChatHandler: ChannelHandlerConfig = async (thread, message, defaultHandler) => {
  // A mention on a not-yet-subscribed thread is a NEW session. The
  // default handler auto-subscribes, so once subscribed this is a
  // follow-up mention — don't re-announce.
  const isNewSession = !(await thread.isSubscribed());

  // Run the framework handler first so the internal Mastra thread and
  // controller session are created before we build the deep link.
  await defaultHandler(thread, message);

  if (!isNewSession) return;

  // The handler's `thread` is the Slack chat thread — its `.id` is the
  // platform thread id (e.g. `slack:C0BG...`), NOT the internal Mastra
  // thread UUID the web UI routes on. Look up the internal thread that
  // the framework created for this channel conversation via the stored
  // channel metadata, then build the link from its real id + resourceId.
  const store = await mastra.getStorage()?.getStore('memory');
  const { threads } = (await store?.listThreads({
    filter: {
      metadata: {
        channel_platform: thread.adapter.name,
        channel_externalThreadId: thread.id,
        channel_externalChannelId: thread.channelId,
      },
    },
    perPage: 1,
  })) ?? { threads: [] };

  const internalThread = threads[0];
  if (!internalThread) {
    console.warn('[onMention] no internal thread found for', thread.id);
    return;
  }

  await thread.post(
    Card({
      title: 'New Mastra Code session started.',
      children: [
        CardText('A new session has been created.'),
        Actions([
          LinkButton({
            url: `${publicOrigin}/threads/${internalThread.id}?resourceId=${encodeURIComponent(
              internalThread.resourceId,
            )}`,
            label: 'View Session',
          }),
        ]),
      ],
    }),
  );
};

// Construct the server-owned Mastra HERE so the `new Mastra(...)` literal lives
// in the entry file. The deployer's `checkConfigExport` Babel plugin only marks
// the config valid when it finds `export const mastra = new Mastra(...)` (or an
// `export { x as mastra }` where `x = new Mastra(...)`) in the entry source AST.
// `prepared.mastraArgs` already carries the controller (via `agentControllers`),
// storage, and the assembled `server` config (middleware + apiRoutes + cors).
export const mastra = new Mastra({
  ...prepared.mastraArgs,
  channels: {
    slack: new SlackProvider({
      refreshToken: process.env.SLACK_APP_REFRESH_TOKEN,
      baseUrl: process.env.MASTRACODE_PUBLIC_URL,
      // Isolate each channel session in its own scratch directory keyed by the
      // channel resourceId, so a Slack-triggered agent never runs in the
      // web-server cwd and two threads don't collide on one workspace.
      resolveSessionProjectPath: resolveChannelSessionProjectPath,
      handlers: {
        onSubscribedMessage: async (thread, message, defaultHandler) => {
          if (message.text.startsWith('aside')) return;
          return defaultHandler(thread, message);
        },
        onMention: newSessionChatHandler,
        onDirectMessage: newSessionChatHandler,
      },
    }),
  },
  logger: new ConsoleLogger({ level: 'debug' }),
});

// const disconnectResult = await mastra.channels.slack.disconnect(CONTROLLER_ID);
// console.log('Slack disconnect result: ', disconnectResult);

// try {
//   const connectionArgs = {
//     id: CONTROLLER_ID,
//     name: 'MC Web (Caleb)',
//     // ownerType: 'agentController',
//     redirectUrl: publicOrigin,
//   };
//   console.log('connecting to slack: ', connectionArgs);
//   const result = await mastra.channels.slack.connect(connectionArgs);

//   if (result?.type === 'oauth') {
//     const authUrl = result?.authorizationUrl;
//     console.log('Slack OAuth flow initiated. Please visit the following URL to authorize the app:\n');
//     console.log(authUrl);
//     console.log('\n');
//   }
// } catch (error) {
//   console.error('Error connecting to slack: ', error);
// }

// Post-construct boot: initialize the controller (which now inherits this
// instance's storage) and start its workers. Runs at module load via top-level
// await, so the deployer imports a fully-booted instance.
await prepared.finalize();
