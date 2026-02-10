import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

describe('NestJS Adapter - Abort Signal', () => {
  let context: AdapterTestContext;
  let app: INestApplication;
  let expressApp: Application;

  const abortSignalRoute: ServerRoute<any, any, any> = {
    method: 'POST',
    path: '/test/abort-signal',
    responseType: 'json',
    handler: async (params: any) => ({
      signalAborted: params.abortSignal?.aborted ?? null,
    }),
  };

  const abortSignalExistsRoute: ServerRoute<any, any, any> = {
    method: 'POST',
    path: '/test/abort-signal-exists',
    responseType: 'json',
    handler: async (params: any) => ({
      hasSignal: !!params.abortSignal,
    }),
  };

  const registerRoute = (route: ServerRoute) => {
    SERVER_ROUTES.push(route);
  };

  const unregisterRoute = (route: ServerRoute) => {
    const index = SERVER_ROUTES.indexOf(route);
    if (index >= 0) {
      SERVER_ROUTES.splice(index, 1);
    }
  };

  const setupApp = async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
          prefix: '',
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();
  };

  beforeAll(() => {
    registerRoute(abortSignalRoute);
    registerRoute(abortSignalExistsRoute);
  });

  afterAll(() => {
    unregisterRoute(abortSignalRoute);
    unregisterRoute(abortSignalExistsRoute);
  });

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should not have aborted signal when route handler executes', async () => {
    await setupApp();

    const response = await executeExpressRequest(expressApp, {
      method: 'POST',
      path: '/test/abort-signal',
      body: { test: 'data' },
    });

    expect(response.status).toBe(200);
    const result = response.body as any;
    expect(result.signalAborted).toBe(false);
  });

  it('should provide abort signal to route handlers', async () => {
    await setupApp();

    const response = await executeExpressRequest(expressApp, {
      method: 'POST',
      path: '/test/abort-signal-exists',
      body: {},
    });

    expect(response.status).toBe(200);
    const result = response.body as any;
    expect(result.hasSignal).toBe(true);
  });
});
