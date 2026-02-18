import { coreAuthMiddleware } from '@mastra/server/auth';
import type { AuthMiddlewareContext } from '@mastra/server/auth';
import type { NextFunction, Request, Response } from 'express';

const buildCtx = (req: Request, res: Response): AuthMiddlewareContext => {
  const mastra = res.locals.mastra;
  const authConfig = mastra.getServer()?.auth!;
  const authHeader = req.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
  if (!token && req.query.apiKey) {
    token = (req.query.apiKey as string) || null;
  }

  return {
    path: req.path,
    method: req.method,
    getHeader: (name: string) => req.headers[name.toLowerCase()] as string | undefined,
    mastra,
    authConfig,
    customRouteAuthConfig: res.locals.customRouteAuthConfig,
    requestContext: res.locals.requestContext,
    rawRequest: req,
    token,
    buildAuthorizeContext: () => ({
      get: (key: string) => {
        if (key === 'mastra') return res.locals.mastra;
        if (key === 'requestContext') return res.locals.requestContext;
        if (key === 'registeredTools') return res.locals.registeredTools;
        if (key === 'taskStore') return res.locals.taskStore;
        if (key === 'customRouteAuthConfig') return res.locals.customRouteAuthConfig;
        return undefined;
      },
      req: req as any,
    }),
  };
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authConfig = res.locals.mastra.getServer()?.auth;
  if (!authConfig) return next();

  const result = await coreAuthMiddleware(buildCtx(req, res));
  if (result.action === 'next') return next();
  return res.status(result.status!).json(result.body);
};
