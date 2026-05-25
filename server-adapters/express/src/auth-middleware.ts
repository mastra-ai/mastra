import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware } from '@mastra/server/auth';
import type { NextFunction, Request, Response } from 'express';

export interface ExpressAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

function toWebRequest(req: Request): globalThis.Request {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  const url = `${protocol}://${host}${req.originalUrl || req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  return new globalThis.Request(url, {
    method: req.method,
    headers,
  });
}

export function createAuthMiddleware({
  mastra,
  requiresAuth = true,
}: ExpressAuthMiddlewareOptions): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!requiresAuth) {
      next();
      return;
    }

    const authConfig = mastra.getServer()?.auth;
    if (!authConfig) {
      next();
      return;
    }

    const requestContext = res.locals.requestContext ?? new RequestContext();
    res.locals.requestContext = requestContext;
    res.locals.mastra = res.locals.mastra ?? mastra;

    const path = String(req.path || '/');
    const method = String(req.method || 'GET');
    const customRouteAuthConfig = new Map<string, boolean>(res.locals.customRouteAuthConfig ?? []);
    customRouteAuthConfig.set(`${method}:${path}`, true);

    const authHeader = req.headers.authorization;
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token && req.query.apiKey) {
      token = (req.query.apiKey as string) || null;
    }

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader: name => req.headers[name.toLowerCase()] as string | undefined,
      mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext,
      rawRequest: toWebRequest(req),
      token,
      buildAuthorizeContext: () => toWebRequest(req),
    });

    if (result.action === 'next') {
      next();
      return;
    }

    res.status(result.status).json(result.body);
  };
}
