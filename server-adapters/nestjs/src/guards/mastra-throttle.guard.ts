import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext, OnModuleDestroy } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { MASTRA_OPTIONS, THROTTLE_KEY } from '../constants';
import type { ThrottleOptions } from '../decorators/throttle.decorator';
import type { MastraModuleOptions } from '../mastra.module';

interface ThrottleEntry {
  count: number;
  resetAt: number;
}

/**
 * Maximum number of entries in the rate limit store.
 * Prevents unbounded memory growth from many unique IP+path combinations.
 */
const MAX_STORE_SIZE = 10000;

/**
 * Guard that implements rate limiting.
 * Rate limiting is ON by default - set rateLimitOptions.enabled: false to disable.
 */
@Injectable()
export class MastraThrottleGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(MastraThrottleGuard.name);
  private readonly store = new Map<string, ThrottleEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {
    this.cleanupInterval = setInterval(() => this.cleanupExpiredEntries(), 60000);
    this.cleanupInterval.unref();
  }

  /**
   * Clean up the interval when the module is destroyed.
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.debug('Rate limit cleanup interval cleared');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.options.rateLimitOptions?.enabled === false) {
      return true;
    }

    const throttleMetadata = this.reflector.getAllAndOverride<ThrottleOptions & { skip?: boolean }>(THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (throttleMetadata?.skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const { limit, windowMs } = this.getRateLimitSettings(request, throttleMetadata);
    await this.checkLimit(request, limit, windowMs);

    return true;
  }

  /**
   * Check rate limit for a request.
   * Can be called directly from controllers for manual rate limiting.
   */
  async checkLimit(request: Request, limit: number, windowMs: number): Promise<void> {
    const clientId = this.getClientId(request);
    const key = `${clientId}:${request.path}`;
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      // New window or expired entry
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, entry);

      // Enforce max store size AFTER inserting new entries
      // This prevents unbounded growth from high-cardinality attacks
      // (many unique IP+path combinations)
      if (this.store.size > MAX_STORE_SIZE) {
        this.evictOldestEntries();
      }
      return;
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

      this.logger.debug(`Rate limit exceeded for client on ${request.path}`);

      throw new HttpException(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Get rate limit settings for this request.
   */
  getRateLimitSettings(request: Request, decoratorOptions?: ThrottleOptions): { limit: number; windowMs: number } {
    if (decoratorOptions && !('skip' in decoratorOptions)) {
      return {
        limit: decoratorOptions.limit,
        windowMs: decoratorOptions.windowMs,
      };
    }

    // Use stricter limits for /generate endpoints (LLM calls are expensive)
    if (/\/generate(?:$|\/)/.test(request.path)) {
      return {
        limit: this.options.rateLimitOptions?.generateLimit ?? 10,
        windowMs: this.options.rateLimitOptions?.windowMs ?? 60000,
      };
    }

    return {
      limit: this.options.rateLimitOptions?.defaultLimit ?? 100,
      windowMs: this.options.rateLimitOptions?.windowMs ?? 60000,
    };
  }

  /**
   * Get client identifier for rate limiting.
   * Uses user ID if authenticated, IP address otherwise.
   *
   * Security note: X-Forwarded-For is only trusted when the app is configured
   * with 'trust proxy' in Express. Without that setting, we use the direct
   * connection IP to prevent header spoofing attacks.
   */
  private getClientId(request: Request): string {
    const user = (request as any).user;
    if (user?.id) {
      return `user:${user.id}`;
    }

    // Use Express's request.ip which respects the 'trust proxy' setting.
    // When 'trust proxy' is configured, request.ip will be the correct client IP
    // from X-Forwarded-For. When not configured, it uses the socket address,
    // preventing X-Forwarded-For spoofing attacks.
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  /**
   * Evict oldest entries when store exceeds max size.
   * Uses a simple LRU-like approach based on resetAt time.
   */
  private evictOldestEntries(): void {
    const entries = Array.from(this.store.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt);

    const toRemove = Math.max(1, Math.floor(MAX_STORE_SIZE * 0.1));
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        this.store.delete(entry[0]);
      }
    }

    this.logger.debug(`Evicted ${toRemove} oldest rate limit entries due to max size`);
  }

  /**
   * Clean up expired entries from the store.
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }
}
