import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import express from 'express';
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

const REFRESHED_COOKIE = 'session=valid; HttpOnly; Path=/';

function createMastraWithSessionRefresh() {
  const mastra = new Mastra({ logger: false });
  const originalGetServer = mastra.getServer.bind(mastra);

  mastra.getServer = () =>
    ({
      ...originalGetServer(),
      auth: {
        authenticateToken: async (_token: string, request: any) =>
          request.headers.get('cookie')?.includes('session=valid') ? { id: 'user-1' } : null,
        authorize: async (path: string) => path !== '/custom/forbidden',
        getSessionIdFromRequest: (request: Request) =>
          request.headers.get('cookie')?.includes('session=expired') ? 'session-1' : null,
        refreshSession: async () => ({ id: 'session-1' }),
        getSessionHeaders: () => ({ 'Set-Cookie': REFRESHED_COOKIE }),
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
    expect(authenticatedRes.locals.requestContext.get('mastra__user')).toEqual({
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

  it('forwards refreshed session headers after a transparent session refresh', async () => {
    const mastra = createMastraWithSessionRefresh();
    const middleware = createAuthMiddleware({ mastra });

    const createRequest = (path: string) =>
      ({
        method: 'GET',
        path,
        headers: { cookie: 'session=expired' },
        query: {},
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost'),
        originalUrl: path,
        url: path,
      }) as unknown as Request;
    const createResponse = () => {
      const res = createMockResponse();
      (res as any).append = vi.fn();
      return res;
    };

    const next = vi.fn<NextFunction>();
    const allowedRes = createResponse();
    await middleware(createRequest('/custom/protected'), allowedRes, next);

    expect(allowedRes.append).toHaveBeenCalledWith('Set-Cookie', REFRESHED_COOKIE);
    expect(next).toHaveBeenCalledTimes(1);

    const deniedNext = vi.fn<NextFunction>();
    const deniedRes = createResponse();
    await middleware(createRequest('/custom/forbidden'), deniedRes, deniedNext);

    expect(deniedRes.append).toHaveBeenCalledWith('Set-Cookie', REFRESHED_COOKIE);
    expect(deniedRes.status).toHaveBeenCalledWith(403);
    expect(deniedNext).not.toHaveBeenCalled();
  });

  it('keeps cookies set by earlier middleware when forwarding refresh headers', async () => {
    const mastra = createMastraWithSessionRefresh();
    const authMiddleware = createAuthMiddleware({ mastra });
    const app = express();
    // A plain node server with Express's request/response prototypes gives real
    // Express cookie handling without an Express route, which CodeQL's
    // js/missing-rate-limiting would flag on this test-only server.
    const server: Server = createServer((rawReq, rawRes) => {
      const req = Object.setPrototypeOf(rawReq, app.request) as Request;
      const res = Object.setPrototypeOf(rawRes, app.response) as Response;
      req.res = res;
      res.req = req;
      req.originalUrl = req.url;
      res.locals = {};
      res.cookie('other', '1');
      void authMiddleware(req, res, () => res.json({ ok: true }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Failed to get server address');
      const res = await fetch(`http://127.0.0.1:${address.port}/custom/protected`, {
        headers: { Cookie: 'session=expired' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie()).toEqual(['other=1; Path=/', REFRESHED_COOKIE]);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
