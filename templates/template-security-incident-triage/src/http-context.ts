import { randomUUID } from 'node:crypto';

import type { MiddlewareHandler } from 'hono';

export type AppEnv = {
  Variables: {
    requestId: string;
    correlationId: string;
    incidentId?: string;
    workflowRunId?: string;
    dashboardAuthTransient?: boolean;
  };
};

const safeCorrelationId = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/u;

export function requestContextMiddleware(createId: () => string = randomUUID): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const requestId = createId();
    const candidate = context.req.header('X-Correlation-ID');
    context.set('requestId', requestId);
    context.set('correlationId', candidate && safeCorrelationId.test(candidate) ? candidate : requestId);
    context.header('X-Request-ID', requestId);
    context.header('X-Correlation-ID', context.get('correlationId'));
    await next();
  };
}

export const defensiveHeadersMiddleware: MiddlewareHandler<AppEnv> = async (context, next) => {
  await next();
  const path = new URL(context.req.url).pathname;
  // All dashboard HTML, including an incident detail, needs the same strictly
  // self-hosted asset policy.  APIs/SSE deliberately keep the deny-all policy.
  const dashboardDocument = path === '/' || path.startsWith('/dashboard') || path.startsWith('/auth/');
  if (!path.startsWith('/assets/')) context.header('Cache-Control', 'no-store');
  context.header(
    'Content-Security-Policy',
    dashboardDocument
      ? "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'"
      : "default-src 'none'",
  );
  context.header('Referrer-Policy', 'no-referrer');
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('X-Frame-Options', 'DENY');
  context.res.headers.delete('Server');
};
