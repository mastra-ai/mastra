import type { Context, Next } from 'hono';

import type { LogEntry } from '../types';

/**
 * Request logger middleware configuration.
 */
export interface RequestLoggerConfig {
  /**
   * Log level (default: 'info').
   */
  level?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Paths to skip logging.
   */
  skipPaths?: string[];

  /**
   * Custom log formatter.
   */
  formatter?: (entry: LogEntry) => string;
}

/**
 * Format a log entry into a string.
 */
function formatLogEntry(entry: LogEntry): string {
  const { method, path, status, duration, userId, requestId } = entry;
  const user = userId ? ` user=${userId}` : '';
  return `[${requestId}] ${method} ${path} ${status} ${duration}ms${user}`;
}

/**
 * Create request logger middleware.
 */
export function createRequestLoggerMiddleware(config?: RequestLoggerConfig) {
  const skipPaths = config?.skipPaths ?? ['/health', '/ready'];

  return async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();

    // Set request ID for tracing
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);

    // Skip logging for certain paths
    if (skipPaths.includes(c.req.path)) {
      return next();
    }

    await next();

    const duration = Date.now() - start;
    const entry: LogEntry = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      userId: c.get('userId') as string | undefined,
      teamId: c.get('teamId') as string | undefined,
      requestId,
      userAgent: c.req.header('User-Agent'),
      ip: c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP'),
    };

    const message = config?.formatter?.(entry) ?? formatLogEntry(entry);
    console.info(message);
  };
}
