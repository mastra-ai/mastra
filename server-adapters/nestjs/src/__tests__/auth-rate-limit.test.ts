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
      path: '/agents',
    });
    expect(missingToken.status).toBe(401);

    const invalidToken = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/agents',
      headers: { authorization: 'Bearer invalid' },
    });
    expect(invalidToken.status).toBe(401);

    const validToken = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/agents',
      headers: { authorization: 'Bearer valid' },
    });
    expect(validToken.status).toBe(200);
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
      path: '/agents',
    });
    expect(first.status).toBe(200);

    const second = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/agents',
    });
    expect(second.status).toBe(429);
  });
});
