import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { CompositeAuth } from '@mastra/core/server';
import type { MastraAuthConfig } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { coreAuthMiddleware } from '../auth/helpers';
import { MASTRA_AUTH_MODE_KEY } from '../constants';
import { GET_THREAD_BY_ID_ROUTE, LIST_THREADS_ROUTE } from './memory';

describe('memory resource mapping', () => {
  let memory: MockMemory;
  let mastra: Mastra;

  beforeEach(async () => {
    const storage = new InMemoryStore();
    memory = new MockMemory({ storage });
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test-instructions',
      model: {} as any,
      memory,
    });
    mastra = new Mastra({ logger: false, storage, agents: { 'test-agent': agent } });
    await memory.createThread({ threadId: 'alice-thread', resourceId: 'alice' });
    await memory.createThread({ threadId: 'bob-thread', resourceId: 'bob' });
  });

  function authenticate(authConfig: MastraAuthConfig, requestContext: RequestContext, path = '/api/memory/threads') {
    return coreAuthMiddleware({
      mastra,
      authConfig,
      requestContext,
      path,
      method: 'GET',
      token: 'test-token',
      getHeader: () => undefined,
      rawRequest: new Request(`http://localhost${path}?resourceId=alice`),
      buildAuthorizeContext: () => null,
    });
  }

  function listThreads(requestContext: RequestContext, resourceId?: string) {
    return LIST_THREADS_ROUTE.handler({
      mastra,
      requestContext,
      agentId: 'test-agent',
      page: 0,
      perPage: 10,
      resourceId,
      abortSignal: new AbortController().signal,
    });
  }

  const auth = { protected: ['/api/*'], authenticateToken: async () => ({ id: 'bob' }) };

  it.each([
    '/api/memory/threads',
    '/api/agents/test-agent/suspended-runs',
    '/api/agents/test-agent/stream',
    '/api/v1/responses/alice-response',
  ])('rejects failed mapping before dispatching %s despite a client resource ID', async path => {
    const context = new RequestContext();
    const result = await authenticate({ ...auth, mapUserToResourceId: () => undefined }, context, path);
    expect(result).toMatchObject({ action: 'error', status: 500 });
    expect(context.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
  });

  it.each(['api', 'studio'])('does not exempt failed mappings in %s mode', async mode => {
    const context = new RequestContext();
    context.set(MASTRA_AUTH_MODE_KEY, mode);
    expect(await authenticate({ ...auth, mapUserToResourceId: () => null }, context)).toMatchObject({
      action: 'error',
      status: 500,
    });
  });

  it('uses mapped identity instead of the client resource ID and denies cross-resource reads', async () => {
    const context = new RequestContext();
    expect(await authenticate({ ...auth, mapUserToResourceId: () => 'bob' }, context)).toMatchObject({
      action: 'next',
    });
    expect((await listThreads(context, 'alice')).threads.map(thread => thread.id)).toEqual(['bob-thread']);
    await expect(
      GET_THREAD_BY_ID_ROUTE.handler({
        mastra,
        requestContext: context,
        agentId: 'test-agent',
        threadId: 'alice-thread',
        abortSignal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('preserves authenticated access without a mapper', async () => {
    const context = new RequestContext();
    expect(await authenticate(auth, context)).toMatchObject({ action: 'next' });
    expect((await listThreads(context)).threads).toHaveLength(2);
    expect((await listThreads(context, 'alice')).threads.map(thread => thread.id)).toEqual(['alice-thread']);
  });

  it('preserves custom middleware scoping without a mapper', async () => {
    const context = new RequestContext();
    expect(await authenticate(auth, context)).toMatchObject({ action: 'next' });
    context.set(MASTRA_RESOURCE_ID_KEY, 'bob');
    expect((await listThreads(context, 'alice')).threads.map(thread => thread.id)).toEqual(['bob-thread']);
  });

  it('does not let an existing middleware scope rescue a failed mapping', async () => {
    const context = new RequestContext();
    context.set(MASTRA_RESOURCE_ID_KEY, 'bob');
    expect(await authenticate({ ...auth, mapUserToResourceId: () => '' }, context)).toMatchObject({
      action: 'error',
      status: 500,
    });
  });

  it('preserves no-mapper access inside a mixed composite', async () => {
    const context = new RequestContext();
    const composite = new CompositeAuth([
      {
        authenticateToken: async () => null,
        authorizeUser: () => true,
        mapUserToResourceId: () => 'alice',
        protected: ['/api/*'],
      },
      { authenticateToken: async () => ({ id: 'bob' }), authorizeUser: () => true },
    ]);
    expect(await authenticate(composite, context)).toMatchObject({ action: 'next' });
    expect(context.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
    expect((await listThreads(context)).threads).toHaveLength(2);
  });

  it('rejects a failed mapping inside a mixed composite', async () => {
    const context = new RequestContext();
    const composite = new CompositeAuth([
      { authenticateToken: async () => null, authorizeUser: () => true, protected: ['/api/*'] },
      { authenticateToken: async () => ({ id: 'bob' }), authorizeUser: () => true, mapUserToResourceId: () => null },
    ]);
    expect(await authenticate(composite, context)).toMatchObject({ action: 'error', status: 500 });
  });

  it('preserves unauthenticated local access', async () => {
    expect((await listThreads(new RequestContext())).threads).toHaveLength(2);
  });
});
