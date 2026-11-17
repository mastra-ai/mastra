import type { UIMessage } from '@internal/ai-sdk-v5';
import { DefaultChatTransport, readUIMessageStream } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { describe, expect, it, vi } from 'vitest';

import { chatRoute } from '../chat-route';

const messages: UIMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];
const MASTRA_AUTH_MODE_KEY = 'mastra__authMode';

function createControlledModel() {
  let finish!: () => void;
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: new ReadableStream<any>({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date(0) });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Hello from a resumable run' });
          finish = () => {
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 5, totalTokens: 6 },
            });
            controller.close();
          };
        },
      }),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });

  return { model, finish: () => finish() };
}

function createContext({
  mastra,
  method,
  runId,
  chatId,
  requestContext,
  signal,
  memory,
}: {
  mastra: Mastra;
  method: 'POST' | 'GET';
  runId: string;
  chatId?: string;
  requestContext?: RequestContext;
  signal?: AbortSignal;
  memory?: { resource?: string; thread?: string };
}) {
  const effectiveChatId =
    chatId ?? (requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) ?? memory?.thread ?? runId;
  const body = { id: effectiveChatId, messages, runId, ...(memory ? { memory } : {}) };
  const request = new Request(
    `http://localhost/chat/test-agent${method === 'GET' ? `/${effectiveChatId}/stream` : ''}`,
    {
      method,
      signal,
      ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    },
  );

  return {
    req: {
      raw: request,
      json: () => Promise.resolve(body),
      param: (name: string) => {
        if (name === 'agentId') return 'test-agent';
        if (name === 'chatId') return effectiveChatId;
        return undefined;
      },
      query: () => undefined,
    },
    get: (key: string) => {
      if (key === 'mastra') return mastra;
      if (key === 'requestContext') return requestContext;
      return undefined;
    },
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  };
}

function getRoute(mastra: Mastra, method: 'POST' | 'GET'): ApiRoute {
  const route = mastra.getServer()?.apiRoutes?.find(candidate => candidate.method === method);
  if (!route || !('handler' in route)) throw new Error(`Expected ${method} chat route handler`);
  return route;
}

async function invoke(route: ApiRoute, context: ReturnType<typeof createContext>): Promise<Response> {
  if (!('handler' in route)) throw new Error('Expected route handler');
  const response = await route.handler(context as never, async () => {});
  if (!(response instanceof Response)) throw new Error('Expected route handler to return a Response');
  return response;
}

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, expected: string) {
  const decoder = new TextDecoder();
  let body = '';
  while (!body.includes(expected)) {
    const { done, value } = await reader.read();
    if (done) throw new Error(`Stream ended before emitting ${expected}`);
    body += decoder.decode(value, { stream: true });
  }
  return body;
}

function createRouteFetch(mastra: Mastra) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(input.toString(), 'http://localhost'), init);
    const url = new URL(request.url);
    const method = request.method as 'POST' | 'GET';
    const body = method === 'POST' ? await request.clone().json() : undefined;
    const pathParts = url.pathname.split('/');
    const chatId = method === 'GET' ? pathParts.at(-2) : body.id;
    const context = {
      req: {
        raw: request,
        json: () => Promise.resolve(body),
        param: (name: string) => {
          if (name === 'agentId') return 'test-agent';
          if (name === 'chatId') return chatId;
          return undefined;
        },
        query: (name: string) => url.searchParams.get(name) ?? undefined,
      },
      get: (key: string) => (key === 'mastra' ? mastra : undefined),
    };
    return invoke(getRoute(mastra, method), context as ReturnType<typeof createContext>);
  };
}

describe('chatRoute resumable streams', () => {
  it('returns explicit POST and GET routes and normalizes them in server config', () => {
    const routes = chatRoute({ path: '/chat/:agentId', resumable: true });
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /chat/:agentId',
      'GET /chat/:agentId/:chatId/stream',
    ]);
    const mastra = new Mastra({
      logger: false,
      server: { apiRoutes: [routes] },
    });

    expect(mastra.getServer()?.apiRoutes?.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /chat/:agentId',
      'GET /chat/:agentId/:chatId/stream',
    ]);

    const fixedRoutes = chatRoute({ path: '/fixed-chat', agent: 'test-agent', resumable: true });
    const fixedMastra = new Mastra({ logger: false, server: { apiRoutes: [fixedRoutes] } });
    expect(fixedMastra.getServer()?.apiRoutes?.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /fixed-chat',
      'GET /fixed-chat/:chatId/stream',
    ]);
  });

  it('rejects body-only resource scope for resumable chats', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: new MockLanguageModelV2(),
    });
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      server: { apiRoutes: [route] },
    });

    const response = await invoke(
      getRoute(mastra, 'POST'),
      createContext({
        mastra,
        method: 'POST',
        runId: 'body-resource-run',
        memory: { resource: 'body-resource' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        'Resumable chat resource IDs must be set by authentication middleware or route request context, not in the request body.',
    });
  });

  it.each(['v5', 'v6', 'v7'] as const)(
    'replays the active chat run after the POST response disconnects with %s',
    async version => {
      const controlled = createControlledModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Help the user.',
        model: controlled.model,
      });
      const observe = vi.spyOn(agent, 'observe');
      const route = chatRoute({ path: '/chat/:agentId', resumable: true, version });
      const mastra = new Mastra({
        logger: false,
        agents: { [agent.id]: agent },
        server: { apiRoutes: [route] },
      });
      const runId = `resumable-run-id-${version}`;
      const requestAbort = new AbortController();

      const postResponse = await invoke(
        getRoute(mastra, 'POST'),
        createContext({ mastra, method: 'POST', runId, signal: requestAbort.signal }),
      );
      const postReader = postResponse.body!.getReader();
      await readUntil(postReader, 'Hello from a resumable run');
      requestAbort.abort();
      await postReader.cancel();

      await vi.waitFor(async () =>
        expect(await agent.__getRunRecord(runId)).toMatchObject({ runId, status: 'running' }),
      );

      const reconnectResponse = await invoke(getRoute(mastra, 'GET'), createContext({ mastra, method: 'GET', runId }));
      expect(reconnectResponse.status).toBe(200);
      const reconnectBody = reconnectResponse.text();
      controlled.finish();

      expect(await reconnectBody).toContain('Hello from a resumable run');
      expect(observe).toHaveBeenCalledWith(runId);
    },
  );

  it('uses the base agent for an unqualified reconnect when Editor has no published version', async () => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const applyStoredOverrides = vi
      .fn()
      .mockResolvedValueOnce(agent)
      .mockRejectedValue(new Error('No published agent version'));
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      editor: { registerWithMastra() {}, agent: { applyStoredOverrides } } as any,
      server: { apiRoutes: [route] },
    });
    const runId = 'editor-draft-run';

    const postResponse = await invoke(getRoute(mastra, 'POST'), createContext({ mastra, method: 'POST', runId }));
    const postReader = postResponse.body!.getReader();
    await readUntil(postReader, 'Hello from a resumable run');
    await postReader.cancel();

    const reconnectResponse = await invoke(getRoute(mastra, 'GET'), createContext({ mastra, method: 'GET', runId }));
    expect(reconnectResponse.status).toBe(200);
    expect(applyStoredOverrides).toHaveBeenCalledTimes(1);

    const reconnectBody = reconnectResponse.text();
    controlled.finish();
    expect(await reconnectBody).toContain('Hello from a resumable run');
  });

  it('reconstructs one complete message through DefaultChatTransport reconnect', async () => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      server: { apiRoutes: [route] },
    });
    const transport = new DefaultChatTransport({
      api: '/chat/test-agent',
      fetch: createRouteFetch(mastra),
    });

    const initialStream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'chat-id',
      messageId: undefined,
      messages,
      abortSignal: undefined,
    });
    const initialReader = initialStream.getReader();
    while (true) {
      const { done, value } = await initialReader.read();
      if (done) throw new Error('Initial stream ended before text was emitted');
      if (value.type === 'text-delta' && value.delta.includes('Hello from a resumable run')) break;
    }
    await initialReader.cancel();

    const reconnected = await transport.reconnectToStream({ chatId: 'chat-id' });
    expect(reconnected).not.toBeNull();
    const reconstructedMessages = readUIMessageStream({ stream: reconnected! });
    controlled.finish();

    let reconstructed: UIMessage | undefined;
    for await (const message of reconstructedMessages) reconstructed = message;

    const textParts = reconstructed?.parts.filter(part => part.type === 'text');
    expect(textParts).toEqual([
      { type: 'text', text: 'Hello from a resumable run', state: 'done', providerMetadata: undefined },
    ]);
  });

  it('hides active runs outside the caller resource and thread scope', async () => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      server: { apiRoutes: [route] },
    });
    const runId = 'owned-run';
    const ownerContext = new RequestContext();
    ownerContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    ownerContext.set(MASTRA_THREAD_ID_KEY, 'owner-thread');

    const postResponse = await invoke(
      getRoute(mastra, 'POST'),
      createContext({ mastra, method: 'POST', runId, requestContext: ownerContext }),
    );
    const postReader = postResponse.body!.getReader();
    await readUntil(postReader, 'Hello from a resumable run');
    await postReader.cancel();

    await vi.waitFor(async () =>
      expect(await agent.__getRunRecord(runId)).toMatchObject({
        resourceId: 'owner-resource',
        threadId: 'owner-thread',
      }),
    );
    const intruderContext = new RequestContext();
    intruderContext.set(MASTRA_RESOURCE_ID_KEY, 'other-resource');
    intruderContext.set(MASTRA_THREAD_ID_KEY, 'owner-thread');
    const intruderResponse = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId, requestContext: intruderContext }),
    );
    expect(intruderResponse.status).toBe(204);

    const missingScopeResponse = await invoke(getRoute(mastra, 'GET'), createContext({ mastra, method: 'GET', runId }));
    expect(missingScopeResponse.status).toBe(204);

    const ownerReconnectContext = new RequestContext();
    ownerReconnectContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    const ownerResponse = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId, chatId: 'owner-thread', requestContext: ownerReconnectContext }),
    );
    expect(ownerResponse.status).toBe(200);
    expect(ownerReconnectContext.get(MASTRA_THREAD_ID_KEY)).toBe('owner-thread');
    const ownerBody = ownerResponse.text();
    controlled.finish();
    expect(await ownerBody).toContain('Hello from a resumable run');
  });

  it('enforces thread FGA before reconnecting', async () => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const fga = {
      check: vi.fn(),
      require: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new Error('denied')),
      filterAccessible: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      server: { apiRoutes: [route], fga },
    });
    const runId = 'fga-owned-run';
    const ownerContext = new RequestContext();
    ownerContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    ownerContext.set(MASTRA_THREAD_ID_KEY, 'owner-thread');
    ownerContext.set('user', { id: 'owner-user' });
    const postResponse = await invoke(
      getRoute(mastra, 'POST'),
      createContext({ mastra, method: 'POST', runId, requestContext: ownerContext }),
    );
    const postReader = postResponse.body!.getReader();
    await readUntil(postReader, 'Hello from a resumable run');
    await postReader.cancel();

    const reconnectContext = new RequestContext();
    reconnectContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    reconnectContext.set('user', { id: 'owner-user' });
    const response = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId, chatId: 'owner-thread', requestContext: reconnectContext }),
    );

    expect(response.status).toBe(404);
    expect(fga.require).toHaveBeenCalled();
    controlled.finish();
  });

  it.each([
    ['a Studio-only provider', false],
    ['the Studio provider when both providers are configured', true],
  ])('enforces thread FGA with %s', async (_name, includeServerFga) => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const studioFga = {
      check: vi.fn(),
      require: vi.fn().mockRejectedValue(new Error('denied')),
      filterAccessible: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const serverFga = {
      check: vi.fn(),
      require: vi.fn().mockResolvedValue(undefined),
      filterAccessible: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      studio: { fga: studioFga },
      server: { apiRoutes: [route], ...(includeServerFga ? { fga: serverFga } : {}) },
    });
    const runId = `studio-fga-run-${includeServerFga}`;
    const ownerContext = new RequestContext();
    ownerContext.set(MASTRA_AUTH_MODE_KEY, 'studio');
    ownerContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    ownerContext.set(MASTRA_THREAD_ID_KEY, 'owner-thread');
    ownerContext.set('user', { id: 'owner-user' });
    const postResponse = await invoke(
      getRoute(mastra, 'POST'),
      createContext({ mastra, method: 'POST', runId, requestContext: ownerContext }),
    );
    const postReader = postResponse.body!.getReader();
    await readUntil(postReader, 'Hello from a resumable run');
    await postReader.cancel();

    const reconnectContext = new RequestContext();
    reconnectContext.set(MASTRA_AUTH_MODE_KEY, 'studio');
    reconnectContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    reconnectContext.set('user', { id: 'owner-user' });
    const studioCallsBeforeReconnect = studioFga.require.mock.calls.length;
    const serverCallsBeforeReconnect = serverFga.require.mock.calls.length;
    const response = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId, chatId: 'owner-thread', requestContext: reconnectContext }),
    );

    expect(response.status).toBe(404);
    expect(studioFga.require).toHaveBeenCalledTimes(studioCallsBeforeReconnect + 1);
    expect(serverFga.require).toHaveBeenCalledTimes(serverCallsBeforeReconnect);
    controlled.finish();
  });

  it('fails closed when only Studio FGA is configured for a server-auth reconnect', async () => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const studioFga = {
      check: vi.fn(),
      require: vi.fn().mockResolvedValue(undefined),
      filterAccessible: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      studio: { fga: studioFga },
      server: { apiRoutes: [route] },
    });
    const runId = 'studio-fga-server-auth-run';
    const ownerContext = new RequestContext();
    ownerContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    ownerContext.set(MASTRA_THREAD_ID_KEY, 'owner-thread');
    ownerContext.set('user', { id: 'owner-user' });
    const postResponse = await invoke(
      getRoute(mastra, 'POST'),
      createContext({ mastra, method: 'POST', runId, requestContext: ownerContext }),
    );
    const postReader = postResponse.body!.getReader();
    await readUntil(postReader, 'Hello from a resumable run');
    await postReader.cancel();

    const reconnectContext = new RequestContext();
    reconnectContext.set(MASTRA_RESOURCE_ID_KEY, 'owner-resource');
    reconnectContext.set('user', { id: 'owner-user' });
    const response = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId, chatId: 'owner-thread', requestContext: reconnectContext }),
    );

    expect(response.status).toBe(404);
    expect(studioFga.require).not.toHaveBeenCalled();
    controlled.finish();
  });

  it('reconnects with the route default request context when middleware context is absent', async () => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const routeRequestContext = new RequestContext();
    routeRequestContext.set(MASTRA_RESOURCE_ID_KEY, 'route-resource');
    const route = chatRoute({
      path: '/chat/:agentId',
      resumable: true,
      defaultOptions: { requestContext: routeRequestContext },
    });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      server: { apiRoutes: [route] },
    });
    const runId = 'route-default-context-run';

    const postResponse = await invoke(
      getRoute(mastra, 'POST'),
      createContext({ mastra, method: 'POST', runId, memory: { thread: 'route-thread' } }),
    );
    const postReader = postResponse.body!.getReader();
    await readUntil(postReader, 'Hello from a resumable run');
    await postReader.cancel();

    await vi.waitFor(async () =>
      expect(await agent.__getRunRecord(runId)).toMatchObject({
        resourceId: 'route-resource',
        threadId: 'route-thread',
      }),
    );

    const reconnectResponse = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId, chatId: 'route-thread' }),
    );
    expect(reconnectResponse.status).toBe(200);
    const reconnectBody = reconnectResponse.text();
    controlled.finish();
    expect(await reconnectBody).toContain('Hello from a resumable run');
    expect(routeRequestContext.has(MASTRA_THREAD_ID_KEY)).toBe(false);

    const laterRunId = 'route-default-context-later-run';
    const laterPostResponse = await invoke(
      getRoute(mastra, 'POST'),
      createContext({ mastra, method: 'POST', runId: laterRunId, memory: { thread: 'later-thread' } }),
    );
    const laterPostReader = laterPostResponse.body!.getReader();
    await readUntil(laterPostReader, 'Hello from a resumable run');
    await laterPostReader.cancel();

    await vi.waitFor(async () =>
      expect(await agent.__getRunRecord(laterRunId)).toMatchObject({
        resourceId: 'route-resource',
        threadId: 'later-thread',
      }),
    );
    controlled.finish();
  });

  it('hides an owner-less run from a tenant-scoped caller', async () => {
    const controlled = createControlledModel();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: controlled.model,
    });
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      server: {
        apiRoutes: [route],
        auth: { mapUserToResourceId: () => 'tenant-resource' } as any,
      },
    });
    const runId = 'owner-less-run';
    const postResponse = await invoke(getRoute(mastra, 'POST'), createContext({ mastra, method: 'POST', runId }));
    const postReader = postResponse.body!.getReader();
    await readUntil(postReader, 'Hello from a resumable run');
    await postReader.cancel();

    const tenantContext = new RequestContext();
    tenantContext.set(MASTRA_RESOURCE_ID_KEY, 'tenant-resource');
    const response = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId, requestContext: tenantContext }),
    );

    expect(response.status).toBe(204);
    controlled.finish();
  });

  it('returns 204 when the chat has no active run', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Help the user.',
      model: new MockLanguageModelV2(),
    });
    const route = chatRoute({ path: '/chat/:agentId', resumable: true });
    const mastra = new Mastra({
      logger: false,
      agents: { [agent.id]: agent },
      server: { apiRoutes: [route] },
    });

    const response = await invoke(
      getRoute(mastra, 'GET'),
      createContext({ mastra, method: 'GET', runId: 'missing-run' }),
    );

    expect(response.status).toBe(204);
  });
});
