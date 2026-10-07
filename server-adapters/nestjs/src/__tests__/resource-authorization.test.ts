import { registerApiRoute } from '@mastra/core/server';
import { LIST_THREADS_ROUTE } from '@mastra/server/handlers/memory';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

const RESOURCE_ID_KEY = 'mastra__resourceId';

describe('NestJS Adapter - authorizeUserResource', () => {
  let context: AdapterTestContext;
  let app: INestApplication;
  let expressApp: Application;
  let seenResource: unknown;

  beforeEach(async () => {
    context = await createDefaultTestContext();
    seenResource = undefined;
    vi.spyOn(LIST_THREADS_ROUTE, 'handler').mockImplementation((async ({ requestContext }: any) => {
      seenResource = requestContext.get(RESOURCE_ID_KEY);
      return { threads: [], total: 0, page: 0, perPage: 100, hasMore: false };
    }) as any);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.restoreAllMocks();
  });

  async function start(authorizeUserResource?: (...args: any[]) => unknown) {
    const handler = vi.fn(async (c: any) => c.json({ resource: c.get('requestContext').get(RESOURCE_ID_KEY) }));
    vi.spyOn(context.mastra, 'getServer').mockReturnValue({
      auth: {
        authenticateToken: async () => ({ id: 'u1' }),
        mapUserToResourceId: () => 'mapped',
        ...(authorizeUserResource ? { authorizeUserResource } : {}),
      },
      apiRoutes: [registerApiRoute('/custom', { method: 'POST', handler })],
    } as any);
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: context.mastra })],
    }).compile();
    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();
    return handler;
  }

  const listThreads = () =>
    executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/memory/threads?resourceId=session-r&agentId=test-agent',
      headers: { authorization: 'Bearer t' },
    });

  it('runs a built-in route under the requested resource when the policy approves', async () => {
    const policy = vi.fn(async () => true);
    await start(policy);
    const response = await listThreads();
    expect(response.status).toBe(200);
    expect(policy).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'session-r', expect.anything());
    expect(seenResource).toBe('session-r');
  });

  it('returns 403 from a built-in route when the policy denies', async () => {
    const policy = vi.fn(async () => false);
    await start(policy);
    const response = await listThreads();
    expect(response.status).toBe(403);
    expect(policy).toHaveBeenCalledOnce();
    expect(seenResource).toBeUndefined();
  });

  it('returns 403 from a custom route when the policy denies a JSON body resourceId', async () => {
    const policy = vi.fn(async () => false);
    const handler = await start(policy);
    const response = await executeExpressRequest(expressApp, {
      method: 'POST',
      path: '/custom',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      body: { resourceId: 'session-r' },
    });
    expect(response.status).toBe(403);
    expect(policy).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
  });

  it('asks the policy about a resourceId in a custom route JSON body', async () => {
    const policy = vi.fn(async () => true);
    const handler = await start(policy);
    const response = await executeExpressRequest(expressApp, {
      method: 'POST',
      path: '/custom',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      body: { resourceId: 'session-r' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ resource: 'session-r' });
    expect(policy).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'session-r', expect.anything());
    expect(handler).toHaveBeenCalledOnce();
  });

  it('keeps the mapped resource when no policy is set', async () => {
    await start();
    const response = await listThreads();
    expect(response.status).toBe(200);
    expect(seenResource).toBe('mapped');
  });
});
