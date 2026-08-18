import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { MASTRA_AUTH_MODE_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { GET_THREAD_BY_ID_ROUTE, LIST_MESSAGES_ROUTE, LIST_THREADS_ROUTE } from './memory';

/**
 * Regression tests for cross-resource memory enumeration: an authenticated
 * request without a server-derived resource scope used to read and list every
 * resource's threads.
 */
describe('memory resource scope enforcement', () => {
  let memory: MockMemory;
  let agent: Agent;
  let storage: InMemoryStore;

  beforeEach(async () => {
    storage = new InMemoryStore();
    memory = new MockMemory({ storage });
    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test-instructions',
      model: {} as any,
      memory,
    });
    await memory.createThread({ threadId: 'alice-thread', resourceId: 'user-alice' });
    await memory.createThread({ threadId: 'bob-thread', resourceId: 'user-bob' });
  });

  function createMastra(server?: Record<string, any>) {
    return new Mastra({ logger: false, agents: { 'test-agent': agent }, server: server as any });
  }

  function createContext({
    mastra,
    authenticated,
    scopedResourceId,
    authMode,
  }: {
    mastra: Mastra;
    authenticated?: boolean;
    scopedResourceId?: string;
    authMode?: string;
  }) {
    const requestContext = new RequestContext();
    if (authenticated) {
      requestContext.set('user', { id: 'user-bob' });
    }
    if (scopedResourceId) {
      requestContext.set(MASTRA_RESOURCE_ID_KEY, scopedResourceId);
    }
    if (authMode) {
      requestContext.set(MASTRA_AUTH_MODE_KEY, authMode);
    }
    return { mastra, requestContext, abortSignal: new AbortController().signal };
  }

  const listArgs = { agentId: 'test-agent', page: 0, perPage: 10 } as const;

  it('denies thread listing for an authenticated request with no server-derived scope', async () => {
    const mastra = createMastra();

    await expect(
      LIST_THREADS_ROUTE.handler({
        ...createContext({ mastra, authenticated: true }),
        ...listArgs,
        resourceId: undefined,
      } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('ignores a client-supplied resourceId when a scope is required', async () => {
    const mastra = createMastra();

    await expect(
      LIST_THREADS_ROUTE.handler({
        ...createContext({ mastra, authenticated: true }),
        ...listArgs,
        resourceId: 'user-alice',
      } as any),
    ).rejects.toThrow(/resource scope/);
  });

  it('denies reading another resource thread by id when no scope is derived', async () => {
    const mastra = createMastra();

    await expect(
      GET_THREAD_BY_ID_ROUTE.handler({
        ...createContext({ mastra, authenticated: true }),
        agentId: 'test-agent',
        threadId: 'alice-thread',
        resourceId: undefined,
      } as any),
    ).rejects.toThrow(/resource scope/);
  });

  it('denies reading another resource thread messages when no scope is derived', async () => {
    const mastra = createMastra();

    await expect(
      LIST_MESSAGES_ROUTE.handler({
        ...createContext({ mastra, authenticated: true }),
        agentId: 'test-agent',
        threadId: 'alice-thread',
        resourceId: undefined,
      } as any),
    ).rejects.toThrow(/resource scope/);
  });

  it('scopes listing to the server-derived resource id', async () => {
    const mastra = createMastra();

    const result = await LIST_THREADS_ROUTE.handler({
      ...createContext({ mastra, authenticated: true, scopedResourceId: 'user-bob' }),
      ...listArgs,
      resourceId: 'user-alice',
    } as any);

    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]!.id).toBe('bob-thread');
  });

  it('still denies cross-resource reads when a scope is derived', async () => {
    const mastra = createMastra();

    await expect(
      GET_THREAD_BY_ID_ROUTE.handler({
        ...createContext({ mastra, authenticated: true, scopedResourceId: 'user-bob' }),
        agentId: 'test-agent',
        threadId: 'alice-thread',
      } as any),
    ).rejects.toThrow(/different resource/);
  });

  it('leaves unauthenticated local development unrestricted', async () => {
    const mastra = createMastra();

    const result = await LIST_THREADS_ROUTE.handler({
      ...createContext({ mastra }),
      ...listArgs,
      resourceId: undefined,
    } as any);

    expect(result.threads).toHaveLength(2);
  });

  it('exempts studio auth mode', async () => {
    const mastra = createMastra();

    const result = await LIST_THREADS_ROUTE.handler({
      ...createContext({ mastra, authenticated: true, authMode: 'studio' }),
      ...listArgs,
      resourceId: undefined,
    } as any);

    expect(result.threads).toHaveLength(2);
  });

  it('honors the requireResourceScope opt-out', async () => {
    const mastra = createMastra({ memory: { requireResourceScope: false } });

    const result = await LIST_THREADS_ROUTE.handler({
      ...createContext({ mastra, authenticated: true }),
      ...listArgs,
      resourceId: undefined,
    } as any);

    expect(result.threads).toHaveLength(2);
  });
});
