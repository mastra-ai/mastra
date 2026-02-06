import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { REQUEST, ContextIdFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, it, expect } from 'vitest';

import { MASTRA_OPTIONS } from '../constants';
import { RequestContextService } from '../services/request-context.service';

describe('NestJS Adapter - RequestContext parsing', () => {
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
});
