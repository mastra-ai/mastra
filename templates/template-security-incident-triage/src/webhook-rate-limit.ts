import type { Context, MiddlewareHandler } from 'hono';

import { errorResponse } from './http-errors.js';
import type { AppEnv } from './http-context.js';
import type { StructuredLogger } from './logging.js';

type Bucket = { windowStartMs: number; count: number };

export type WebhookRateLimiter = Readonly<{
  take(input: Readonly<{ route: string; client: string }>): Readonly<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
}>;

export type WebhookClientKeyResolver = (context: Context<AppEnv>) => string;

/** Bounded fixed-window limiter; capacity exhaustion deliberately rejects. */
export class FixedWindowWebhookRateLimiter implements WebhookRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly options: Readonly<{
      maxRequests: number;
      windowMs: number;
      maxBuckets: number;
      cleanupBatchSize: number;
      nowMs: () => number;
    }>,
  ) {
    for (const value of [options.maxRequests, options.windowMs, options.maxBuckets, options.cleanupBatchSize]) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error('Webhook rate limit configuration must be a positive integer');
      }
    }
  }

  take(input: Readonly<{ route: string; client: string }>) {
    const now = this.options.nowMs();
    this.cleanup(now);
    const windowStartMs = Math.floor(now / this.options.windowMs) * this.options.windowMs;
    const key = `${input.route}\u0000${input.client}`;
    const existing = this.buckets.get(key);
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + this.options.windowMs - now) / 1_000));
    if (existing?.windowStartMs === windowStartMs) {
      if (existing.count >= this.options.maxRequests) return { allowed: false, retryAfterSeconds };
      existing.count += 1;
      return { allowed: true, retryAfterSeconds };
    }
    if (!existing && this.buckets.size >= this.options.maxBuckets) return { allowed: false, retryAfterSeconds };
    this.buckets.set(key, { windowStartMs, count: 1 });
    return { allowed: true, retryAfterSeconds };
  }

  private cleanup(now: number) {
    let visited = 0;
    for (const [key, bucket] of this.buckets) {
      if (visited++ >= this.options.cleanupBatchSize) break;
      if (bucket.windowStartMs + this.options.windowMs <= now) this.buckets.delete(key);
    }
  }
}

/** X-Forwarded-For is attacker-controlled without an approved proxy boundary. */
export const defaultWebhookClientKey: WebhookClientKeyResolver = context => {
  const incoming = (context.env as { incoming?: { socket?: { remoteAddress?: unknown } } } | undefined)?.incoming;
  return typeof incoming?.socket?.remoteAddress === 'string' && incoming.socket.remoteAddress.length > 0
    ? `socket:${incoming.socket.remoteAddress}`
    : 'unattributed';
};

export function webhookRateLimitMiddleware(
  input: Readonly<{
    limiter: WebhookRateLimiter;
    route: string;
    logger: StructuredLogger;
    resolveClient?: WebhookClientKeyResolver;
  }>,
): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const result = input.limiter.take({
      route: input.route,
      client: (input.resolveClient ?? defaultWebhookClientKey)(context),
    });
    if (result.allowed) return next();
    context.header('Retry-After', String(result.retryAfterSeconds));
    return errorResponse(context, 'RATE_LIMITED', 429, true, input.logger);
  };
}
