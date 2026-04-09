import { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { createAuthMiddleware } from '../index';

function createMastraWithAuth() {
  const mastra = new Mastra({ logger: false });
  const originalGetServer = mastra.getServer.bind(mastra);

  mastra.getServer = () =>
    ({
      ...originalGetServer(),
      auth: {
        authenticateToken: async (token: string) =>
          token === 'valid-token' ? { id: 'user-1', email: 'user@example.com' } : null,
        authorize: async () => true,
      },
    }) as any;

  return mastra;
}

describe('Express auth middleware helper', () => {
  function createMockResponse(): Response {
    const locals = {
      requestContext: new RequestContext(),
    } as any;

    const res = {
      locals,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    return res;
  }

  it('protects raw Express routes outside Mastra route registration', async () => {
    const mastra = createMastraWithAuth();
    const middleware = createAuthMiddleware({ mastra });
    const next = vi.fn<NextFunction>();

    const unauthenticatedReq = {
      method: 'GET',
      path: '/custom/protected',
      headers: {},
      query: {},
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost'),
      originalUrl: '/custom/protected',
      url: '/custom/protected',
    } as unknown as Request;
    const unauthenticatedRes = createMockResponse();

    await middleware(unauthenticatedReq, unauthenticatedRes, next);

    expect(unauthenticatedRes.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();

    const authenticatedReq = {
      method: 'GET',
      path: '/custom/protected',
      headers: { authorization: 'Bearer valid-token' },
      query: {},
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost'),
      originalUrl: '/custom/protected',
      url: '/custom/protected',
    } as unknown as Request;
    const authenticatedRes = createMockResponse();

    await middleware(authenticatedReq, authenticatedRes, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(authenticatedRes.locals.requestContext.get('user')).toEqual({
      id: 'user-1',
      email: 'user@example.com',
    });
  });

  it('allows opting a raw Express route out with requiresAuth false', async () => {
    const mastra = createMastraWithAuth();
    const middleware = createAuthMiddleware({ mastra, requiresAuth: false });
    const next = vi.fn<NextFunction>();
    const req = {
      method: 'GET',
      path: '/custom/public',
      headers: {},
      query: {},
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost'),
      originalUrl: '/custom/public',
      url: '/custom/public',
    } as unknown as Request;
    const res = createMockResponse();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
