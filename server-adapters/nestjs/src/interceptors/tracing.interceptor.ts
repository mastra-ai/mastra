import { createRequire } from 'node:module';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';

import { MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';

type OtelSpan = {
  setAttribute: (key: string, value: unknown) => void;
  setStatus: (status: { code: number; message?: string }) => void;
  recordException: (error: Error) => void;
  end: () => void;
};

type OtelTracer = {
  startSpan: (name: string, options?: { kind?: number; attributes?: Record<string, unknown> }) => OtelSpan;
};

type OtelApi = {
  trace: {
    getTracer: (name: string) => OtelTracer;
    setSpan: (context: unknown, span: OtelSpan) => unknown;
  };
  context: {
    active: () => unknown;
    with: <T>(context: unknown, fn: () => T) => T;
  };
  SpanKind: {
    SERVER: number;
  };
  SpanStatusCode: {
    OK: number;
    ERROR: number;
  };
};

const require = createRequire(import.meta.url);
let cachedOtel: OtelApi | null | undefined;

function getOtelApi(): OtelApi | null {
  if (cachedOtel !== undefined) return cachedOtel;
  try {
    cachedOtel = require('@opentelemetry/api') as OtelApi;
  } catch {
    cachedOtel = null;
  }
  return cachedOtel;
}

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TracingInterceptor.name);

  constructor(@Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.options.tracingOptions?.enabled;
    if (enabled === false) {
      return next.handle();
    }

    const otel = getOtelApi();
    if (!otel) {
      return next.handle();
    }

    const tracerName = this.options.tracingOptions?.serviceName || 'mastra-nestjs';
    const tracer = otel.trace.getTracer(tracerName);

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const span = tracer.startSpan(`HTTP ${request.method} ${request.path}`, {
      kind: otel.SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.route': request.path,
        'http.target': request.originalUrl || request.url,
      },
    });

    const spanContext = otel.trace.setSpan(otel.context.active(), span);

    return otel.context.with(spanContext, () =>
      next.handle().pipe(
        tap(() => {
          span.setAttribute('http.status_code', response.statusCode);
          span.setStatus({ code: otel.SpanStatusCode.OK });
        }),
        catchError(error => {
          span.recordException(error as Error);
          span.setStatus({
            code: otel.SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          this.logger.debug(`Tracing span error: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }),
        finalize(() => {
          span.end();
        }),
      ),
    );
  }
}
