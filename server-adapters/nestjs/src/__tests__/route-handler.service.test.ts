import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { RouteHandlerService, ValidationError } from '../services/route-handler.service';

describe('RouteHandlerService', () => {
  it('validates empty object bodies when a body schema is present', async () => {
    const context = await createDefaultTestContext();
    const service = new RouteHandlerService(context.mastra, { mastra: context.mastra, prefix: '/api' });

    const route = {
      method: 'POST',
      path: '/test',
      responseType: 'json' as const,
      bodySchema: z.object({ name: z.string() }),
      handler: vi.fn(),
    };

    await expect(
      service.executeHandler(route, {
        pathParams: {},
        queryParams: {},
        body: {},
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('validates empty string bodies when a body schema is present', async () => {
    const context = await createDefaultTestContext();
    const service = new RouteHandlerService(context.mastra, { mastra: context.mastra, prefix: '/api' });

    const route = {
      method: 'POST',
      path: '/test',
      responseType: 'json' as const,
      bodySchema: z.string().min(1),
      handler: vi.fn(),
    };

    await expect(
      service.executeHandler(route, {
        pathParams: {},
        queryParams: {},
        body: '',
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('preserves context keys while stripping reserved request input keys', async () => {
    const context = await createDefaultTestContext();
    const service = new RouteHandlerService(context.mastra, {
      mastra: context.mastra,
      prefix: '/api',
      tools: { safeTool: { name: 'safeTool' } } as any,
      taskStore: {} as any,
    });

    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });
    const abortSignal = new AbortController().signal;

    const route = {
      method: 'POST',
      path: '/test',
      responseType: 'json' as const,
      handler: vi.fn(async params => params),
    };

    const result = await service.executeHandler(route, {
      pathParams: {
        id: '123',
        mastra: 'spoofed',
      },
      queryParams: {
        page: '2',
        abortSignal: 'spoofed',
      },
      body: {
        requestContext: 'spoofed',
        routePrefix: '/spoofed',
        custom: 'ok',
      },
      requestContext,
      abortSignal,
    });

    const handlerParams = await route.handler.mock.results[0]?.value;

    expect(result.responseType).toBe('json');
    expect(handlerParams.id).toBe('123');
    expect(handlerParams.page).toBe('2');
    expect(handlerParams.custom).toBe('ok');
    expect(handlerParams.mastra).toBe(context.mastra);
    expect(handlerParams.requestContext).toBe(requestContext);
    expect(handlerParams.abortSignal).toBe(abortSignal);
    expect(handlerParams.routePrefix).toBe('/api');
  });
});
