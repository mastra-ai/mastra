import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import {
  DEFAULT_CREDENTIAL_TTL_MS,
  MAX_CREDENTIAL_TTL_MS,
  MAX_CREDENTIAL_VALUE_BYTES,
  SessionCredentialError,
} from '../storage/domains/session-credentials/base.js';
import type {
  CredentialRequestRecord,
  SessionCredentialRecord,
  SessionCredentialsStorage,
} from '../storage/domains/session-credentials/base.js';
import { tenantOrgId } from './provider-credentials.js';
import { loose, Route } from './route.js';
import type { RouteDependencies } from './route.js';

/**
 * The private entry path for session credentials. A person opens the link the
 * agent shared, signs in, and submits the value here. The value travels only
 * in this POST body: it is never put in a URL, a channel message, the
 * transcript or a model prompt, and no response echoes it back.
 */

export interface SessionCredentialRoutesDeps extends RouteDependencies {
  /** Absent when auth is on without an encryption key: Factory refuses to store these in plaintext. */
  credentials?: SessionCredentialsStorage;
  sessions: SourceControlSessionLookup;
  audit: AuditRecorder;
  /** Tell the session the credential is ready, by name only. Best-effort. */
  notifyAvailable(args: { request: CredentialRequestRecord; credential: SessionCredentialRecord }): Promise<void>;
}

/** Signed-in viewer, or `local` when Factory runs without auth (single trusted user). */
type Viewer = { kind: 'user'; orgId: string; userId: string } | { kind: 'local' };

const submitSchema = z
  .object({
    value: z.string().min(1),
    ttlMs: z.number().int().positive().max(MAX_CREDENTIAL_TTL_MS).optional(),
    allowSandbox: z.boolean(),
  })
  .strict();

function requestView(request: CredentialRequestRecord, now: Date) {
  const expired = request.status === 'pending' && request.expiresAt.getTime() <= now.getTime();
  return {
    id: request.id,
    name: request.name,
    purpose: request.purpose,
    sessionId: request.sessionId,
    factoryProjectId: request.factoryProjectId,
    status: expired ? ('expired' as const) : request.status,
    expiresAt: request.expiresAt.toISOString(),
  };
}

function credentialView(credential: SessionCredentialRecord) {
  return {
    name: credential.name,
    submittedBy: credential.submittedBy,
    allowSandbox: credential.allowSandbox,
    createdAt: credential.createdAt.toISOString(),
    expiresAt: credential.expiresAt.toISOString(),
  };
}

const ERROR_STATUS: Record<SessionCredentialError['code'], 400 | 404 | 409 | 410> = {
  not_found: 404,
  expired: 410,
  already_used: 409,
  invalid_name: 400,
  invalid_value: 400,
  missing: 404,
  sandbox_not_allowed: 400,
};

/** Keep these responses out of caches and keep the page URL out of Referer headers. */
function noStore(c: Context) {
  c.header('Cache-Control', 'no-store');
  c.header('Referrer-Policy', 'no-referrer');
}

export class SessionCredentialRoutes extends Route<SessionCredentialRoutesDeps> {
  async #viewer(c: Context): Promise<Viewer | { response: Response }> {
    if (!this.deps.auth.enabled()) return { kind: 'local' };
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized', reason: 'auth_required' }, 401) };
    return { kind: 'user', orgId: tenantOrgId(tenant), userId: tenant.userId };
  }

  #storage(c: Context): SessionCredentialsStorage | { response: Response } {
    if (this.deps.credentials) return this.deps.credentials;
    return {
      response: c.json(
        {
          error: 'credentials_unavailable',
          message:
            'Session credentials are disabled because this Factory has no encryption key. Configure FACTORY_CREDENTIAL_ENCRYPTION_KEY.',
        },
        503,
      ),
    };
  }

  /**
   * The request's session as its current owner sees it. Ownership is read from
   * the live session row, not the request, so a transfer after the link was
   * issued moves the right to answer it. Anyone else gets 404.
   */
  async #requestSession(viewer: Viewer, request: CredentialRequestRecord) {
    const session = await this.#ownedSession(viewer, request.sessionId);
    return session && session.orgId === request.orgId ? session : null;
  }

  /** The session owner manages its credentials. */
  async #ownedSession(viewer: Viewer, sessionId: string) {
    const session = await this.deps.sessions.getBySessionId(sessionId);
    if (!session) return null;
    if (viewer.kind === 'local') return session;
    return session.orgId === viewer.orgId && session.userId === viewer.userId ? session : null;
  }

  routes() {
    const limitBody = bodyLimit({
      // JSON framing plus escaping can grow the value; anything past this can't hold a valid one.
      maxSize: MAX_CREDENTIAL_VALUE_BYTES * 2 + 1024,
      onError: c => c.json({ error: 'The credential is too large.' }, 413),
    });
    return [
      registerApiRoute('/web/credential-requests/:requestId', {
        method: 'GET',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          noStore(c);
          const viewer = await this.#viewer(c);
          if ('response' in viewer) return viewer.response;
          const storage = this.#storage(c);
          if ('response' in storage) return storage.response;
          await storage.ensureReady();
          const request = await storage.getRequest(c.req.param('requestId') ?? '');
          const session = request ? await this.#requestSession(viewer, request) : null;
          if (!request || !session) return c.json({ error: 'Request not found' }, 404);
          return c.json({
            request: requestView(request, new Date()),
            session: { id: session.sessionId, title: session.title },
            defaultTtlMs: DEFAULT_CREDENTIAL_TTL_MS,
            maxTtlMs: MAX_CREDENTIAL_TTL_MS,
          });
        },
      }),
      registerApiRoute('/web/credential-requests/:requestId', {
        method: 'POST',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          noStore(c);
          const viewer = await this.#viewer(c);
          if ('response' in viewer) return viewer.response;
          const storage = this.#storage(c);
          if ('response' in storage) return storage.response;
          await storage.ensureReady();
          const request = await storage.getRequest(c.req.param('requestId') ?? '');
          if (!request || !(await this.#requestSession(viewer, request))) {
            return c.json({ error: 'Request not found' }, 404);
          }

          // A JSON body forces a CORS preflight, so a cross-site form post cannot submit on the owner's behalf.
          if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) {
            return c.json({ error: 'Expected an application/json body.' }, 415);
          }
          let body: unknown;
          const limited = await limitBody(c, async () => {
            body = await c.req.json().catch(() => undefined);
          });
          if (limited) return limited;
          const parsed = submitSchema.safeParse(body);
          // Never echo the issue: zod messages can quote the received value.
          if (!parsed.success) return c.json({ error: 'Expected { value, allowSandbox, ttlMs? }.' }, 400);

          const submittedBy = viewer.kind === 'local' ? 'local' : viewer.userId;
          let result: Awaited<ReturnType<SessionCredentialsStorage['fulfillRequest']>>;
          try {
            result = await storage.fulfillRequest({
              requestId: request.id,
              submittedBy,
              value: parsed.data.value,
              allowSandbox: parsed.data.allowSandbox,
              ...(parsed.data.ttlMs !== undefined ? { ttlMs: parsed.data.ttlMs } : {}),
            });
          } catch (error) {
            if (error instanceof SessionCredentialError) {
              return c.json({ error: error.message, code: error.code }, ERROR_STATUS[error.code]);
            }
            throw error;
          }
          await this.deps.audit.record({
            orgId: request.orgId,
            actorId: submittedBy,
            action: 'factory.credential.submitted',
            ...(request.factoryProjectId ? { factoryProjectId: request.factoryProjectId } : {}),
            targets: [{ type: 'session', id: request.sessionId }],
            metadata: {
              name: request.name,
              allowSandbox: parsed.data.allowSandbox,
              expiresAt: result.credential.expiresAt.toISOString(),
            },
          });
          await this.deps.notifyAvailable(result).catch((error: unknown) => {
            console.warn('[session-credentials] Could not notify the session', {
              sessionId: request.sessionId,
              name: request.name,
              error: error instanceof Error ? error.message : String(error),
            });
          });
          return c.json({ credential: credentialView(result.credential) });
        },
      }),
      registerApiRoute('/web/session-credentials/:sessionId', {
        method: 'GET',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          noStore(c);
          const viewer = await this.#viewer(c);
          if ('response' in viewer) return viewer.response;
          const storage = this.#storage(c);
          if ('response' in storage) return storage.response;
          await storage.ensureReady();
          const session = await this.#ownedSession(viewer, c.req.param('sessionId') ?? '');
          if (!session) return c.json({ error: 'Session not found' }, 404);
          const credentials = await storage.list({ orgId: session.orgId, sessionId: session.sessionId });
          return c.json({ credentials: credentials.map(credentialView) });
        },
      }),
      registerApiRoute('/web/session-credentials/:sessionId/:name', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          noStore(c);
          const viewer = await this.#viewer(c);
          if ('response' in viewer) return viewer.response;
          const storage = this.#storage(c);
          if ('response' in storage) return storage.response;
          await storage.ensureReady();
          const session = await this.#ownedSession(viewer, c.req.param('sessionId') ?? '');
          if (!session) return c.json({ error: 'Session not found' }, 404);
          const name = c.req.param('name') ?? '';
          const revoked = await storage.revoke({ orgId: session.orgId, sessionId: session.sessionId, name });
          if (!revoked) return c.json({ error: 'Credential not found' }, 404);
          await this.deps.audit.record({
            orgId: session.orgId,
            actorId: viewer.kind === 'local' ? 'local' : viewer.userId,
            action: 'factory.credential.revoked',
            ...(session.factoryProjectId ? { factoryProjectId: session.factoryProjectId } : {}),
            targets: [{ type: 'session', id: session.sessionId }],
            metadata: { name },
          });
          return c.json({ revoked: true });
        },
      }),
    ];
  }
}
