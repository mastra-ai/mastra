import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

describe('NestJS Adapter - Auth and Rate Limiting', () => {
  let context: AdapterTestContext;
  let app: INestApplication;
  let expressApp: Application;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.restoreAllMocks();
  });

  it('should enforce authentication when auth config is provided', async () => {
    vi.spyOn(context.mastra, 'getServer').mockReturnValue({
      auth: {
        protected: ['/*'],
        public: [],
        authenticateToken: async (token: string) => {
          if (token === 'valid') {
            return { id: 'user-1', isAdmin: true };
          }
          return null;
        },
      },
    } as any);

    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();

    const missingToken = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
    });
    expect(missingToken.status).toBe(401);

    const invalidToken = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
      headers: { authorization: 'Bearer invalid' },
    });
    expect(invalidToken.status).toBe(401);

    const validToken = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
      headers: { authorization: 'Bearer valid' },
    });
    expect(validToken.status).toBe(200);
  });

  it('passes a Web Request with readable headers to authenticateToken', async () => {
    let receivedRequest: unknown;

    vi.spyOn(context.mastra, 'getServer').mockReturnValue({
      auth: {
        protected: ['/*'],
        public: [],
        authenticateToken: async (token: string, request: unknown) => {
          receivedRequest = request;
          if (!(request instanceof Request)) {
            return null;
          }
          // Cookie-based providers (e.g. better-auth) call headers.get — this
          // must not throw on the Nest/Express request shape.
          const cookie = request.headers.get('cookie');
          if (token === 'valid' && cookie?.includes('session=abc')) {
            return { id: 'user-1', isAdmin: true };
          }
          return null;
        },
      },
    } as any);

    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();

    const response = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
      headers: {
        authorization: 'Bearer valid',
        cookie: 'session=abc',
      },
    });

    expect(receivedRequest).toBeInstanceOf(Request);
    expect((receivedRequest as Request).headers.get('cookie')).toBe('session=abc');
    expect(response.status).toBe(200);
  });

  it('passes a Web Request with readable headers to authorizeUser', async () => {
    let receivedRequest: unknown;

    vi.spyOn(context.mastra, 'getServer').mockReturnValue({
      auth: {
        protected: ['/*'],
        public: [],
        authenticateToken: async (token: string) => {
          if (token === 'valid') {
            return { id: 'user-1' };
          }
          return null;
        },
        authorizeUser: async (_user: unknown, request: unknown) => {
          receivedRequest = request;
          if (!(request instanceof Request)) {
            return false;
          }
          return request.headers.get('cookie')?.includes('session=abc') === true;
        },
      },
    } as any);

    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();

    const response = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
      headers: {
        authorization: 'Bearer valid',
        cookie: 'session=abc',
      },
    });

    expect(receivedRequest).toBeInstanceOf(Request);
    expect((receivedRequest as Request).headers.get('cookie')).toBe('session=abc');
    expect(response.status).toBe(200);
  });

  it('passes a Web Request with readable headers to authorize context.req', async () => {
    let receivedRequest: unknown;

    vi.spyOn(context.mastra, 'getServer').mockReturnValue({
      auth: {
        protected: ['/*'],
        public: [],
        authenticateToken: async (token: string) => {
          if (token === 'valid') {
            return { id: 'user-1' };
          }
          return null;
        },
        authorize: async (_path: string, _method: string, _user: unknown, authContext: { req?: unknown }) => {
          receivedRequest = authContext.req;
          if (!(authContext.req instanceof Request)) {
            return false;
          }
          return authContext.req.headers.get('cookie')?.includes('session=abc') === true;
        },
      },
    } as any);

    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();

    const response = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
      headers: {
        authorization: 'Bearer valid',
        cookie: 'session=abc',
      },
    });

    expect(receivedRequest).toBeInstanceOf(Request);
    expect((receivedRequest as Request).headers.get('cookie')).toBe('session=abc');
    expect(response.status).toBe(200);
  });

  it('should only allow query apiKey auth when explicitly enabled', async () => {
    vi.spyOn(context.mastra, 'getServer').mockReturnValue({
      auth: {
        protected: ['/*'],
        public: [],
        authenticateToken: async (token: string) => {
          if (token === 'valid') {
            return { id: 'user-1', isAdmin: true };
          }
          return null;
        },
      },
    } as any);

    const disabledModuleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
          auth: {
            enabled: true,
          },
        }),
      ],
    }).compile();

    app = disabledModuleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();

    const disabledResponse = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents?apiKey=valid',
    });
    expect(disabledResponse.status).toBe(401);

    await app.close();

    const enabledModuleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
          auth: {
            enabled: true,
            allowQueryApiKey: true,
          },
        }),
      ],
    }).compile();

    app = enabledModuleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();

    const enabledResponse = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents?apiKey=valid',
    });
    expect(enabledResponse.status).toBe(200);

    const repeatedApiKeyResponse = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents?apiKey=valid&apiKey=ignored',
    });
    expect(repeatedApiKeyResponse.status).toBe(200);
  });

  it('should rate limit requests when enabled', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
          rateLimitOptions: {
            enabled: true,
            defaultLimit: 1,
            windowMs: 60000,
          },
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();

    const first = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
    });
    expect(first.status).toBe(200);

    const second = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
    });
    expect(second.status).toBe(429);
  });
});
