import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

import type { IdGenerator } from '../contracts/technical/primitives.js';
import type { Clock } from '../contracts/technical/primitives.js';
import { correlationIdSchema } from '../domain/identifiers.js';
import { demoSessionCookieName, type DemoSessionRecord, type DemoSessionStore } from './demo-session.js';
import { HttpBoundaryError, safeErrorResponse } from './http-errors.js';

export interface ApiEnv {
  Variables: {
    apiCorrelationId: string;
    apiSession: DemoSessionRecord;
  };
}

interface RateBucket {
  startedAt: number;
  count: number;
}

export class FixedWindowRateLimiter {
  readonly #buckets = new Map<string, RateBucket>();

  constructor(private readonly maximumBuckets = 1_024) {}

  get bucketCount(): number {
    return this.#buckets.size;
  }

  consume(key: string, limit: number, now: number): Readonly<{ allowed: boolean; retryAfter: number }> {
    for (const [bucketKey, bucket] of this.#buckets) {
      if (now - bucket.startedAt >= 60_000) this.#buckets.delete(bucketKey);
    }
    const existing = this.#buckets.get(key);
    if (existing === undefined && this.#buckets.size >= this.maximumBuckets) {
      const oldest = [...this.#buckets.entries()].sort(
        ([leftKey, left], [rightKey, right]) => left.startedAt - right.startedAt || leftKey.localeCompare(rightKey),
      )[0];
      if (oldest !== undefined) this.#buckets.delete(oldest[0]);
    }
    const bucket =
      existing === undefined || now - existing.startedAt >= 60_000 ? { startedAt: now, count: 0 } : existing;
    bucket.count += 1;
    this.#buckets.set(key, bucket);
    return {
      allowed: bucket.count <= limit,
      retryAfter: Math.max(1, Math.ceil((bucket.startedAt + 60_000 - now) / 1_000)),
    };
  }
}

const isProtectedApiPath = (path: string): boolean =>
  path.startsWith('/api/v1/kyc/') ||
  path === '/api/v1/kyc/cases' ||
  path.startsWith('/api/v1/reviews') ||
  path.startsWith('/api/v1/metrics') ||
  path === '/api/v1/demo/session/logout';

const isCsrfProtected = (method: string, path: string): boolean =>
  method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && isProtectedApiPath(path);

const rateProfile = (method: string, path: string): Readonly<{ name: string; limit: number }> => {
  if (path.startsWith('/api/v1/webhooks/')) return { name: 'webhook', limit: 60 };
  if (path.endsWith('/documents')) return { name: 'upload', limit: 10 };
  if (method === 'GET' || method === 'HEAD') return { name: 'read', limit: 120 };
  return { name: 'command', limit: 30 };
};

export const requireRole = (session: DemoSessionRecord, roles: readonly string[]): void => {
  if (!roles.some(role => session.actor.roles.includes(role))) {
    throw new HttpBoundaryError('FORBIDDEN', 'The demo persona cannot perform this action', 403);
  }
};

export const createApiSecurityMiddleware =
  (
    input: Readonly<{
      sessions: DemoSessionStore;
      clock: Clock;
      ids: IdGenerator;
      portalOrigin: string;
      rateLimiter: FixedWindowRateLimiter;
    }>,
  ): MiddlewareHandler<ApiEnv> =>
  async (context, next) => {
    const requestedCorrelationId = context.req.header('X-Correlation-Id');
    const parsedCorrelationId = correlationIdSchema.safeParse(requestedCorrelationId);
    const correlationId = parsedCorrelationId.success
      ? parsedCorrelationId.data
      : `http-${input.ids.generate('event')}`;
    context.set('apiCorrelationId', correlationId);
    context.header('X-Correlation-Id', correlationId);
    context.header('Cache-Control', 'no-store');

    try {
      const path = context.req.path;
      const session = input.sessions.get(getCookie(context, demoSessionCookieName), input.clock.now());
      if (isProtectedApiPath(path)) {
        if (session === undefined) {
          throw new HttpBoundaryError('UNAUTHENTICATED', 'A demo session is required', 401);
        }
        context.set('apiSession', session);
      }

      if (isCsrfProtected(context.req.method, path)) {
        if (context.req.header('Origin') !== input.portalOrigin) {
          throw new HttpBoundaryError('ORIGIN_NOT_ALLOWED', 'The request origin is not allowed', 403);
        }
        if (session === undefined || context.req.header('X-CSRF-Token') !== session.csrfToken) {
          throw new HttpBoundaryError('CSRF_INVALID', 'The CSRF token is invalid', 403);
        }
      }

      const profile = rateProfile(context.req.method, path);
      const key = path.startsWith('/api/v1/webhooks/') ? path : (session?.sessionId ?? 'anonymous');
      const consumed = input.rateLimiter.consume(`${profile.name}:${key}`, profile.limit, input.clock.now().getTime());
      context.header('X-RateLimit-Limit', String(profile.limit));
      if (!consumed.allowed) {
        context.header('Retry-After', String(consumed.retryAfter));
        throw new HttpBoundaryError('RATE_LIMITED', 'The request rate limit was exceeded', 429);
      }

      return await next();
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  };
