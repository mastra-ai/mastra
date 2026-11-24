import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from './http-context.js';

export type LogRecord = Readonly<{
  event: string;
  requestId?: string;
  correlationId?: string;
  incidentId?: string;
  workflowRunId?: string;
  stepId?: string;
  toolCallId?: string;
  provider?: string;
  errorCode?: string;
  status?: number;
  durationMs?: number;
  attempt?: number;
}>;

export interface StructuredLogger {
  write(record: LogRecord): void;
}

export const consoleLogger: StructuredLogger = Object.freeze({
  write: (record: LogRecord) => console.log(JSON.stringify(record)),
});

export function requestLoggingMiddleware(
  logger: StructuredLogger,
  now: () => number = Date.now,
): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const startedAt = now();
    try {
      await next();
    } finally {
      logger.write({
        event: 'http.request.completed',
        requestId: context.get('requestId'),
        correlationId: context.get('correlationId'),
        ...(context.get('incidentId') ? { incidentId: context.get('incidentId') } : {}),
        ...(context.get('workflowRunId') ? { workflowRunId: context.get('workflowRunId') } : {}),
        status: context.res.status,
        durationMs: Math.max(0, now() - startedAt),
      });
    }
  };
}
