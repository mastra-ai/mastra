import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { INestApplication } from '@nestjs/common';
import { REQUEST, ContextIdFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { MASTRA_OPTIONS } from '../constants';
import { MastraModule } from '../index';
import { RequestContextService } from '../services/request-context.service';
import { RouteHandlerService } from '../services/route-handler.service';
import { executeExpressRequest } from './test-helpers';

describe('NestJS Adapter - RequestContext parsing', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  const createService = async (context: AdapterTestContext, request: any) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestContextService,
        {
          provide: REQUEST,
          useValue: request,
        },
        {
          provide: MASTRA_OPTIONS,
          useValue: {
            mastra: context.mastra,
            contextOptions: { strict: false, logWarnings: false },
          },
        },
      ],
    }).compile();

    const contextId = ContextIdFactory.create();
    moduleRef.registerRequestByContextId(request, contextId);
    return moduleRef.resolve(RequestContextService, contextId);
  };

  it('parses requestContext from query string JSON', async () => {
    const context = await createDefaultTestContext();
    const encoded = JSON.stringify({ userId: 'user-123', traceId: 'trace-1' });
    const request = {
      method: 'GET',
      query: { requestContext: encoded },
      res: undefined,
    };

    const service = await createService(context, request);

    expect(service.requestContext.get('userId')).toBe('user-123');
    expect(service.requestContext.get('traceId')).toBe('trace-1');
  });

  it('parses requestContext from body for POST requests', async () => {
    const context = await createDefaultTestContext();
    const request = {
      method: 'POST',
      body: { requestContext: { sessionId: 'session-9' } },
      res: undefined,
    };

    const service = await createService(context, request);

    expect(service.requestContext.get('sessionId')).toBe('session-9');
  });

  it('passes body requestContext through to Mastra route execution', async () => {
    const context = await createDefaultTestContext();
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: context.mastra })],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const routeHandler = app.get(RouteHandlerService);
    const executeHandler = vi.spyOn(routeHandler, 'executeHandler').mockResolvedValue({
      data: { ok: true },
      responseType: 'json',
    });

    const expressApp = app.getHttpAdapter().getInstance() as Application;
    const response = await executeExpressRequest(expressApp, {
      method: 'POST',
      path: '/agents/test-agent/generate',
      body: {
        messages: [{ role: 'user', content: 'hello' }],
        requestContext: { sessionId: 'session-42' },
      },
    });

    expect(response.status).toBe(200);
    expect(executeHandler).toHaveBeenCalledOnce();
    expect(executeHandler.mock.calls[0]?.[1].requestContext.get('sessionId')).toBe('session-42');
    expect(executeHandler.mock.calls[0]?.[1].body).toMatchObject({
      requestContext: { sessionId: 'session-42' },
    });
  });

  it('normalizes repeated query params before Mastra route execution', async () => {
    const context = await createDefaultTestContext();
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: context.mastra })],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const routeHandler = app.get(RouteHandlerService);
    const executeHandler = vi.spyOn(routeHandler, 'executeHandler').mockResolvedValue({
      data: { ok: true },
      responseType: 'json',
    });

    const expressApp = app.getHttpAdapter().getInstance() as Application;
    const response = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/agents?tag=1&tag=2&requestContext=%7B%22traceId%22%3A%22trace-99%22%7D',
    });

    expect(response.status).toBe(200);
    expect(executeHandler).toHaveBeenCalledOnce();
    expect(executeHandler.mock.calls[0]?.[1].queryParams).toMatchObject({
      tag: [1, 2],
    });
    expect(executeHandler.mock.calls[0]?.[1].requestContext.get('traceId')).toBe('trace-99');
  });
});
