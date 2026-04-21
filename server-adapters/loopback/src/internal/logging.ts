import type { Request, Response } from '@loopback/rest';
import type { HttpLoggingConfig } from '@mastra/core/server';

import { toHeaderRecord } from './request-utils.js';
import type { RequestLogPayload } from './types.js';

export function logLoopbackRequest(input: {
  req: Request;
  res: Response;
  startedAt: number;
  config?: HttpLoggingConfig;
  shouldLogRequest: (path: string) => boolean;
}): void {
  const { config } = input;
  if (!config || !input.shouldLogRequest(input.req.path)) {
    return;
  }

  const payload: RequestLogPayload = {
    method: input.req.method,
    path: input.req.path,
    status: input.res.statusCode ?? 200,
    durationMs: Date.now() - input.startedAt,
  };

  if (config.includeHeaders) {
    payload.headers = redactHeaders(toHeaderRecord(input.req.headers), config);
  }
  if (config.includeQueryParams) {
    payload.query = input.req.query as Record<string, unknown>;
  }

  const level = config.level ?? 'info';
  const logger: ((message?: unknown, ...optionalParams: unknown[]) => void) | undefined =
    level === 'warn' ? console.warn : console.info;
  logger?.('Mastra request', payload);
}

function redactHeaders(
  headers: Record<string, string | string[] | undefined>,
  config: HttpLoggingConfig,
): Record<string, string | string[] | undefined> {
  const redacted = new Set((config.redactHeaders ?? []).map(header => header.toLowerCase()));
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (redacted.has(key.toLowerCase())) {
        return [key, '[REDACTED]'] as const;
      }
      return [key, value] as const;
    }),
  );
}
