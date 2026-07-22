/**
 * Web OAuth sign-in routes for model providers (Settings › Providers).
 *
 * Wraps the SDK's step-based OAuth primitives (start/complete for Anthropic's
 * paste-code PKCE flow, start/poll for the Codex/Copilot/xAI device flows) in
 * HTTP routes. Flow state lives in login sessions — the `model-credentials`
 * domain's `oauth_login_sessions` table in tenant mode (any replica can
 * complete/poll), an in-memory store in local mode — so a flow can span
 * requests. Completed credentials are always **user-scoped** (plan tokens are
 * personal subscriptions) in tenant mode, or written to the file-backed
 * `AuthStorage` in local mode.
 *
 * Tokens never leave the server; responses only carry flow metadata (URLs,
 * user codes, poll delays).
 */

import { randomUUID } from 'node:crypto';

import { nextPollDelayMs } from '@mastra/code-sdk/auth/device-code';
import { completeAnthropicLogin, startAnthropicLogin } from '@mastra/code-sdk/auth/providers/anthropic';
import {
  copilotNextPollDelayMs,
  pollGitHubCopilotDeviceLogin,
  startGitHubCopilotDeviceLogin,
} from '@mastra/code-sdk/auth/providers/github-copilot';
import type { CopilotDeviceLoginPending } from '@mastra/code-sdk/auth/providers/github-copilot';
import { pollCodexDeviceLogin, startCodexDeviceLogin } from '@mastra/code-sdk/auth/providers/openai-codex';
import type { CodexDeviceLoginPending } from '@mastra/code-sdk/auth/providers/openai-codex';
import { pollXAIDeviceLogin, startXAIDeviceLogin } from '@mastra/code-sdk/auth/providers/xai';
import type { XAIDeviceLoginPending } from '@mastra/code-sdk/auth/providers/xai';
import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { OAuthCredentials } from '@mastra/code-sdk/auth/types';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { LoginSessionKind, LoginSessionRow } from '../storage/domains/credentials/base.js';
import { getAuthProviderId, resolveCredentialContext } from './provider-credentials.js';
import type { CredentialContext } from './provider-credentials.js';
import { Route } from './route.js';
import type { RouteDependencies } from './route.js';

/** Lifetime of a paste-code session (Anthropic gives no explicit expiry). */
const PASTE_CODE_TTL_MS = 10 * 60 * 1000;

interface OAuthFlowStart {
  url: string;
  userCode?: string;
  instructions: string;
  /** ms epoch after which the flow expires. */
  expiresAt: number;
  /** Delay before the first upstream poll (device-code flows only). */
  nextPollMs?: number;
  /** Serializable flow state persisted in the login session. */
  pending: Record<string, unknown>;
}

type OAuthFlowPoll =
  | { status: 'complete'; credentials: OAuthCredentials }
  | { status: 'pending'; nextPollMs: number; pending?: Record<string, unknown> }
  | { status: 'failed'; error: string };

interface OAuthFlow {
  kind: LoginSessionKind;
  start(): Promise<OAuthFlowStart>;
  /** Paste-code flows: exchange the pasted code for credentials. Throws on bad input. */
  complete?(pending: Record<string, unknown>, code: string): Promise<OAuthCredentials>;
  /** Device-code flows: perform exactly one upstream poll. */
  poll?(pending: Record<string, unknown>): Promise<OAuthFlowPoll>;
}

/** Web OAuth flows keyed by *catalog* provider id (mirrors {@link WEB_OAUTH_FLOW_KINDS}). */
const OAUTH_FLOWS: Record<string, OAuthFlow> = {
  anthropic: {
    kind: 'paste-code',
    start: async () => {
      const { url, verifier } = await startAnthropicLogin();
      return {
        url,
        instructions: 'Open the link, authorize, then paste the code shown on the final page.',
        expiresAt: Date.now() + PASTE_CODE_TTL_MS,
        pending: { verifier },
      };
    },
    complete: (pending, code) => completeAnthropicLogin(code, String(pending.verifier ?? '')),
  },
  openai: {
    kind: 'device-code',
    start: async () => {
      const p = await startCodexDeviceLogin();
      return {
        url: p.url,
        userCode: p.userCode,
        instructions: p.instructions,
        expiresAt: p.deadlineAt,
        nextPollMs: p.intervalMs,
        pending: { ...p },
      };
    },
    poll: async pending => {
      const r = await pollCodexDeviceLogin(pending as unknown as CodexDeviceLoginPending);
      if (r.status === 'complete') return { status: 'complete', credentials: r.credentials };
      if (r.status === 'pending') return { status: 'pending', nextPollMs: r.nextPollMs };
      return { status: 'failed', error: r.error };
    },
  },
  'github-copilot': {
    kind: 'device-code',
    start: async () => {
      const p = await startGitHubCopilotDeviceLogin();
      return {
        url: p.url,
        userCode: p.userCode,
        instructions: p.instructions,
        expiresAt: p.deadlineAt,
        nextPollMs: copilotNextPollDelayMs(p),
        pending: { ...p },
      };
    },
    poll: async pending => {
      const p = pending as unknown as CopilotDeviceLoginPending;
      // Web flows are always started against github.com (no Enterprise input).
      // Never let deserialized session state redirect server-side polling to
      // an arbitrary hostname.
      if (p.domain !== 'github.com' || p.enterpriseDomain !== undefined) {
        return { status: 'failed', error: 'Unsupported GitHub host' };
      }
      const r = await pollGitHubCopilotDeviceLogin(p);
      if (r.status === 'complete') return { status: 'complete', credentials: r.credentials };
      if (r.status === 'pending') return { status: 'pending', nextPollMs: r.nextPollMs, pending: { ...r.pending } };
      return { status: 'failed', error: r.error };
    },
  },
  xai: {
    kind: 'device-code',
    start: async () => {
      const p = await startXAIDeviceLogin();
      return {
        url: p.url,
        userCode: p.userCode,
        instructions: p.instructions,
        expiresAt: p.state.deadlineAt,
        nextPollMs: nextPollDelayMs(p.state),
        pending: { ...p },
      };
    },
    poll: async pending => {
      const r = await pollXAIDeviceLogin(pending as unknown as XAIDeviceLoginPending);
      if (r.status === 'complete') return { status: 'complete', credentials: r.credentials };
      if (r.status === 'pending') return { status: 'pending', nextPollMs: r.nextPollMs, pending: { ...r.pending } };
      return { status: 'failed', error: r.error };
    },
  },
};

function loose(c: unknown): Context {
  return c as Context;
}

/**
 * Local-mode login sessions. Flows in local mode are single-process, so a
 * process-local libsql `:memory:` database (which already handles TTL
 * cleanup) is sufficient.
 */
let localSessionsPromise: Promise<ModelCredentialsStorage> | undefined;
function localSessions(): Promise<ModelCredentialsStorage> {
  localSessionsPromise ??= (async () => {
    const { LibSQLFactoryStorage } = await import('@mastra/libsql');
    const storage = new LibSQLFactoryStorage({ id: 'local-oauth-sessions', url: ':memory:' });
    const store = storage.registerDomain(new ModelCredentialsStorage());
    await storage.init();
    return store;
  })();
  return localSessionsPromise;
}
const LOCAL_TENANT = { orgId: 'local', userId: 'local' } as const;

async function sessionStore(ctx: CredentialContext): Promise<ModelCredentialsStorage> {
  return ctx.mode === 'tenant' ? ctx.storage : localSessions();
}

function sessionTenant(ctx: CredentialContext): { orgId: string; userId: string } {
  return ctx.mode === 'tenant' ? { orgId: ctx.orgId, userId: ctx.userId } : LOCAL_TENANT;
}

/** Load a session and verify it belongs to the caller + provider (else undefined). */
async function loadOwnedSession({
  ctx,
  provider,
  sessionId,
}: {
  ctx: CredentialContext;
  provider: string;
  sessionId: string;
}): Promise<LoginSessionRow | undefined> {
  const session = await (await sessionStore(ctx)).getLoginSession(sessionId);
  if (!session) return undefined;
  const tenant = sessionTenant(ctx);
  if (session.orgId !== tenant.orgId || session.userId !== tenant.userId) return undefined;
  if (session.provider !== provider) return undefined;
  return session;
}

/** Persist completed OAuth credentials — always user-scoped in tenant mode. */
async function persistOAuthCredential({
  ctx,
  provider,
  credentials,
  authStorage,
  onCredentialsChanged,
}: {
  ctx: CredentialContext;
  provider: string;
  credentials: OAuthCredentials;
  authStorage: AuthStorage | undefined;
  onCredentialsChanged: (tenant: { orgId: string; userId?: string }) => void;
}): Promise<void> {
  const authProviderId = getAuthProviderId(provider);
  if (ctx.mode === 'tenant') {
    await ctx.storage.setCredential({ orgId: ctx.orgId, userId: ctx.userId }, authProviderId, {
      type: 'oauth',
      ...credentials,
    });
    onCredentialsChanged({ orgId: ctx.orgId, userId: ctx.userId });
    return;
  }
  if (!authStorage) throw new Error('Credential storage is not available');
  authStorage.set(authProviderId, { type: 'oauth', ...credentials });
}

async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = (await c.req.json()) as unknown;
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export interface OAuthRoutesDeps extends RouteDependencies {
  /** File-backed credential store; used in local (no-auth) mode. */
  authStorage?: AuthStorage;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** Notifies the host after tenant credentials change so caches can be dropped. */
  onCredentialsChanged?: (tenant: { orgId: string; userId?: string }) => void;
}

/**
 * Provider OAuth sign-in routes as Mastra `apiRoutes`:
 *   - `POST   /web/config/providers/:provider/oauth/start`              — begin a sign-in flow
 *   - `POST   /web/config/providers/:provider/oauth/complete`           — paste-code exchange
 *   - `POST   /web/config/providers/:provider/oauth/poll`               — one device-code poll
 *   - `DELETE /web/config/providers/:provider/oauth/session/:sessionId` — cancel a flow
 *   - `DELETE /web/config/providers/:provider/oauth`                    — sign out (caller only)
 */
export class OAuthRoutes extends Route<OAuthRoutesDeps> {
  routes(): ApiRoute[] {
    const { auth, authStorage, modelCredentials } = this.deps;
    const onCredentialsChanged = this.deps.onCredentialsChanged ?? (() => {});

    return [
      registerApiRoute('/web/config/providers/:provider/oauth/start', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: modelCredentials });
          if ('response' in ctx) return ctx.response;

          const provider = c.req.param('provider');
          const flow = OAUTH_FLOWS[provider];
          if (!flow) {
            return c.json({ error: 'oauth_not_supported', message: `Provider does not support web sign-in` }, 404);
          }
          // Body may carry `{ mode }` for future multi-mode providers; each web
          // flow currently has exactly one mode, so an unknown mode is rejected.
          const body = await readJsonBody(loose(c));
          if (typeof body.mode === 'string' && body.mode !== flow.kind) {
            return c.json({ error: 'invalid_mode', message: `Unsupported mode for ${provider}: ${body.mode}` }, 400);
          }

          let started: OAuthFlowStart;
          try {
            started = await flow.start();
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 502);
          }

          const sessionId = randomUUID();
          const tenant = sessionTenant(ctx);
          await (
            await sessionStore(ctx)
          ).createLoginSession({
            sessionId,
            orgId: tenant.orgId,
            userId: tenant.userId,
            provider,
            kind: flow.kind,
            pending: started.pending,
            expiresAt: new Date(started.expiresAt),
            nextPollAt: started.nextPollMs != null ? new Date(Date.now() + started.nextPollMs) : null,
          });

          return c.json({
            sessionId,
            kind: flow.kind,
            url: started.url,
            ...(started.userCode ? { userCode: started.userCode } : {}),
            instructions: started.instructions,
            expiresAt: started.expiresAt,
            ...(started.nextPollMs != null ? { nextPollMs: started.nextPollMs } : {}),
          });
        },
      }),

      registerApiRoute('/web/config/providers/:provider/oauth/complete', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: modelCredentials });
          if ('response' in ctx) return ctx.response;

          const provider = c.req.param('provider');
          const flow = OAUTH_FLOWS[provider];
          if (!flow?.complete) return c.json({ error: 'oauth_not_supported' }, 404);

          const body = await readJsonBody(loose(c));
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
          const code = typeof body.code === 'string' ? body.code.trim() : '';
          if (!sessionId || !code) return c.json({ error: 'Missing required fields: sessionId, code' }, 400);

          const session = await loadOwnedSession({ ctx, provider, sessionId });
          if (!session) return c.json({ error: 'session_not_found' }, 404);
          if (session.kind !== 'paste-code') return c.json({ error: 'wrong_session_kind' }, 400);

          const claimed = await (
            await sessionStore(ctx)
          ).claimLoginSession(sessionId, {
            orgId: session.orgId,
            userId: session.userId,
            provider,
            kind: 'paste-code',
          });
          if (!claimed) return c.json({ error: 'oauth_in_progress' }, 409);

          let credentials: OAuthCredentials;
          try {
            credentials = await flow.complete(claimed.pending, code);
          } catch (error) {
            await (await sessionStore(ctx)).touchLoginSession(sessionId, { nextPollAt: null });
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
          }

          await persistOAuthCredential({ ctx, provider, credentials, authStorage, onCredentialsChanged });
          await (await sessionStore(ctx)).deleteLoginSession(sessionId);
          return c.json({ status: 'complete', ok: true });
        },
      }),

      registerApiRoute('/web/config/providers/:provider/oauth/poll', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: modelCredentials });
          if ('response' in ctx) return ctx.response;

          const provider = c.req.param('provider');
          const flow = OAUTH_FLOWS[provider];
          if (!flow?.poll) return c.json({ error: 'oauth_not_supported' }, 404);

          const body = await readJsonBody(loose(c));
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
          if (!sessionId) return c.json({ error: 'Missing required field: sessionId' }, 400);

          const session = await loadOwnedSession({ ctx, provider, sessionId });
          if (!session) return c.json({ error: 'session_not_found' }, 404);
          if (session.kind !== 'device-code') return c.json({ error: 'wrong_session_kind' }, 400);

          // Server-side rate limit: at most one upstream poll per interval,
          // regardless of how eagerly the client calls this route.
          const now = Date.now();
          const nextPollAt = session.nextPollAt?.getTime();
          if (nextPollAt != null && now < nextPollAt) {
            return c.json({ status: 'pending', nextPollMs: nextPollAt - now });
          }

          const claimed = await (
            await sessionStore(ctx)
          ).claimLoginSession(sessionId, {
            orgId: session.orgId,
            userId: session.userId,
            provider,
            kind: 'device-code',
          });
          if (!claimed) return c.json({ status: 'pending', nextPollMs: 250 });

          let result: OAuthFlowPoll;
          try {
            result = await flow.poll(claimed.pending);
          } catch (error) {
            await (await sessionStore(ctx)).touchLoginSession(sessionId, { nextPollAt: null });
            throw error;
          }

          if (result.status === 'complete') {
            await persistOAuthCredential({
              ctx,
              provider,
              credentials: result.credentials,
              authStorage,
              onCredentialsChanged,
            });
            await (await sessionStore(ctx)).deleteLoginSession(sessionId);
            return c.json({ status: 'complete', ok: true });
          }

          if (result.status === 'failed') {
            await (await sessionStore(ctx)).deleteLoginSession(sessionId);
            return c.json({ status: 'failed', error: result.error });
          }

          await (
            await sessionStore(ctx)
          ).touchLoginSession(sessionId, {
            ...(result.pending ? { pending: result.pending } : {}),
            nextPollAt: new Date(now + result.nextPollMs),
          });
          return c.json({ status: 'pending', nextPollMs: result.nextPollMs });
        },
      }),

      registerApiRoute('/web/config/providers/:provider/oauth/session/:sessionId', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: modelCredentials });
          if ('response' in ctx) return ctx.response;

          const provider = c.req.param('provider');
          const sessionId = c.req.param('sessionId');
          const session = await loadOwnedSession({ ctx, provider, sessionId });
          if (session) await (await sessionStore(ctx)).deleteLoginSession(sessionId);
          return c.json({ ok: true });
        },
      }),

      registerApiRoute('/web/config/providers/:provider/oauth', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: modelCredentials });
          if ('response' in ctx) return ctx.response;

          const provider = c.req.param('provider');
          const authProviderId = getAuthProviderId(provider);
          try {
            if (ctx.mode === 'tenant') {
              // Caller's credential only — never touches org rows or other users.
              await ctx.storage.removeCredential({ orgId: ctx.orgId, userId: ctx.userId }, authProviderId);
              onCredentialsChanged({ orgId: ctx.orgId, userId: ctx.userId });
            } else {
              if (!authStorage) return c.json({ error: 'Credential storage is not available' }, 503);
              authStorage.remove(authProviderId);
            }
            return c.json({ ok: true });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),
    ];
  }
}
