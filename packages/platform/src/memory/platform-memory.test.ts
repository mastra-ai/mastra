import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlatformMemoryClient } from './client';
import { PlatformMemory } from './platform-memory';

type StoredMessage = {
  id: string;
  role: string;
  content: string;
  parts?: { type: string; text?: string }[];
  createdAt: string;
};

/** In-memory stand-in for `/v1/memory/:instanceId/*`, with the server's observation already applied. */
function fakeMemoryApi() {
  const threads = new Map<string, { id: string; resourceId: string; title: string; metadata: object }>();
  const messages = new Map<string, StoredMessage[]>();
  const requests: { method: string; path: string; headers: Headers; body?: any }[] = [];
  let observations: string | null = null;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/v1\/memory\/mem_1/, '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path, headers: new Headers(init?.headers), body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    const now = new Date().toISOString();
    const thread = (id: string) => {
      const t = threads.get(id);
      return t && { ...t, createdAt: now, updatedAt: now };
    };

    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/threads\/([^/]+)\/messages$/)) && method === 'POST') {
      const id = decodeURIComponent(m[1]!);
      if (!threads.has(id)) threads.set(id, { id, resourceId: body.resourceId, title: '', metadata: {} });
      const list = messages.get(id) ?? [];
      for (const msg of body.messages) {
        const idx = list.findIndex(x => x.id === msg.id);
        if (idx >= 0) list[idx] = msg;
        else list.push(msg);
      }
      messages.set(id, list);
      return json({ messages: body.messages }, 201);
    }
    if ((m = path.match(/^\/threads\/([^/]+)\/processors$/)) && method === 'POST') {
      const id = decodeURIComponent(m[1]!);
      const list = body.messageList;
      if (body.phase === 'inputStep') {
        const saved = messages.get(id) ?? [];
        list.messages = [
          ...saved.map(msg => ({
            ...msg,
            threadId: id,
            resourceId: body.resourceId,
            content: { format: 2, parts: msg.parts ?? [{ type: 'text', text: msg.content }] },
          })),
          ...list.messages,
        ];
        if (observations) list.systemMessages.push({ role: 'system', content: observations });
      } else if (body.phase === 'output') {
        const saved = messages.get(id) ?? [];
        for (const msg of list.messages) {
          if (msg.role !== 'user' && msg.role !== 'assistant') continue;
          const stored = {
            id: msg.id,
            role: msg.role,
            content:
              msg.content.content ??
              msg.content.parts
                ?.filter((part: { type: string }) => part.type === 'text')
                .map((part: { text: string }) => part.text)
                .join('\n') ??
              '',
            parts: msg.content.parts,
            createdAt: msg.createdAt,
          };
          const index = saved.findIndex(existing => existing.id === msg.id);
          if (index < 0) saved.push(stored);
          else saved[index] = stored;
        }
        messages.set(id, saved);
      }
      return json({ aborted: null, chunks: [], rotations: 0, messageList: list });
    }
    if ((m = path.match(/^\/threads\/([^/]+)\/context$/))) {
      const id = decodeURIComponent(m[1]!);
      // Like the service: read-only, observations first as `om-system`, then unobserved messages.
      const unobserved = messages.get(id) ?? [];
      const system = observations
        ? [{ id: 'om-system', role: 'system', content: observations, parts: [], createdAt: new Date(0).toISOString() }]
        : [];
      return json({ system: observations, messages: unobserved, prompt: [...system, ...unobserved], observedAt: null });
    }
    if ((m = path.match(/^\/threads\/([^/]+)\/messages$/))) {
      const all = messages.get(decodeURIComponent(m[1]!)) ?? [];
      const page = Number(url.searchParams.get('page') ?? 0);
      const perPage = Number(url.searchParams.get('perPage') ?? 40);
      return json({
        messages: all.slice(page * perPage, (page + 1) * perPage),
        hasMore: (page + 1) * perPage < all.length,
      });
    }
    if ((m = path.match(/^\/threads\/([^/]+)$/))) {
      const t = thread(decodeURIComponent(m[1]!));
      return t ? json(t) : json({ title: 'Not found' }, 404);
    }
    if (path === '/threads' && method === 'GET') {
      const page = Number(url.searchParams.get('page') ?? 0);
      const perPage = Number(url.searchParams.get('perPage') ?? 100);
      const all = [...threads.keys()]
        .map(id => thread(id)!)
        .filter(t => !url.searchParams.has('resourceId') || t.resourceId === url.searchParams.get('resourceId'));
      return json({
        threads: all.slice(page * perPage, (page + 1) * perPage),
        hasMore: (page + 1) * perPage < all.length,
      });
    }
    if (path === '/threads' && method === 'POST') {
      threads.set(body.id, {
        id: body.id,
        resourceId: body.resourceId,
        title: body.title ?? '',
        metadata: body.metadata ?? {},
      });
      return json(thread(body.id), 201);
    }
    return json({ title: `unhandled ${method} ${path}` }, 500);
  };

  return {
    fetchImpl,
    requests,
    messages,
    observe(text: string) {
      observations = text;
    },
  };
}

describe('PlatformMemory', () => {
  let api: ReturnType<typeof fakeMemoryApi>;

  beforeEach(() => {
    api = fakeMemoryApi();
  });

  function agentWith(prompts: unknown[]) {
    const memory = new PlatformMemory({
      accessToken: 'tok_1',
      instanceId: 'mem_1',
      apiUrl: 'https://platform.test',
      fetch: api.fetchImpl,
    });
    const agent = new Agent({
      id: 'assistant',
      name: 'assistant',
      instructions: 'You are helpful.',
      model: createMockModel({ mockText: 'Noted.', spyGenerate: props => prompts.push(props.prompt) }),
      memory,
    });
    return { agent, memory };
  }

  it('paginates across multiple threads and reports full message counts', async () => {
    const { memory } = agentWith([]);
    await memory.client.createThread({ id: 'thread_1', resourceId: 'user' });
    await memory.client.createThread({ id: 'thread_2', resourceId: 'user' });
    const messages = Array.from({ length: 205 }, (_, i) => ({
      id: `msg_${i}`,
      role: 'user',
      content: `message ${i}`,
      createdAt: new Date(2024, 0, 1, 0, i).toISOString(),
    }));
    api.messages.set('thread_1', messages);
    api.messages.set('thread_2', [
      { id: 'other', role: 'user', content: 'other thread', createdAt: new Date(2025, 0, 1).toISOString() },
    ]);
    const all = await memory.recall({ threadId: ['thread_1', 'thread_2'], perPage: false });
    expect(all.messages).toHaveLength(206);
    expect(all.total).toBe(206);
    expect(all.messages.at(-1)?.id).toBe('other');
    const recent = await memory.recall({
      threadId: ['thread_1', 'thread_2'],
      perPage: 2,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    expect(recent.messages.map(m => m.id)).toEqual(['other', 'msg_204']);
    expect(recent.total).toBe(206);
    expect(recent.hasMore).toBe(true);
    const filtered = await memory.recall({
      threadId: ['thread_1', 'thread_2'],
      filter: { dateRange: { start: new Date(2025, 0, 1) } },
    });
    expect(filtered.messages.map(m => m.id)).toEqual(['other']);
    expect(filtered.total).toBe(1);
  });

  it('reports full thread totals and applies metadata filtering', async () => {
    const { memory } = agentWith([]);
    for (let i = 0; i < 205; i++) {
      await memory.client.createThread({
        id: `thread_${i}`,
        resourceId: 'user',
        metadata: { group: i % 2 ? 'odd' : 'even' },
      });
    }
    const all = await memory.listThreads({ perPage: false });
    expect(all.threads).toHaveLength(205);
    expect(all.total).toBe(205);
    const filtered = await memory.listThreads({ perPage: 2, page: 1, filter: { metadata: { group: 'even' } } });
    expect(filtered.total).toBe(103);
    expect(filtered.threads).toHaveLength(2);
  });

  it('saves each turn and replays the thread on the next one', async () => {
    const prompts: any[] = [];
    const { agent } = agentWith(prompts);
    const memory = { thread: 'thread_1', resource: 'user_1' };

    await agent.generate('My name is Ada.', { memory });
    await agent.generate('What is my name?', { memory });
    expect(api.messages.get('thread_1')!.map(m => [m.role, m.content])).toEqual([
      ['user', 'My name is Ada.'],
      ['assistant', 'Noted.'],
      ['user', 'What is my name?'],
      ['assistant', 'Noted.'],
    ]);
    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).toContain('My name is Ada.');
    expect(api.requests.every(r => r.headers.get('authorization') === 'Bearer tok_1')).toBe(true);
  });

  it('cancels an in-flight processor request when the run is aborted', async () => {
    const controller = new AbortController();
    let abortedInFlight: boolean | undefined;
    const fetchImpl = api.fetchImpl;
    api.fetchImpl = async (input, init) => {
      if (
        new URL(String(input)).pathname.endsWith('/processors') &&
        JSON.parse(String(init?.body)).phase === 'inputStep'
      ) {
        controller.abort();
        abortedInFlight = init?.signal?.aborted;
      }
      return fetchImpl(input, init);
    };
    const { agent } = agentWith([]);

    await agent
      .generate('Hello', { memory: { thread: 'thread_1', resource: 'user_1' }, abortSignal: controller.signal })
      .catch(() => {});
    expect(abortedInFlight).toBe(true);
  });

  it('times out a hosted request that never responds', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    try {
      const client = new PlatformMemoryClient({
        accessToken: 'tok_1',
        instanceId: 'mem_1',
        apiUrl: 'https://platform.test',
        fetch: (_input, init) =>
          new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))),
      });
      const pending = client.getThread('thread_1');
      expect(timeout).toHaveBeenCalledWith(30_000);
      deadline.abort(new DOMException('timed out', 'TimeoutError'));
      await expect(pending).rejects.toThrow('timed out');
    } finally {
      timeout.mockRestore();
    }
  });

  it('gives processor runs a 5-minute bound and never aborts the output-phase save', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const controller = new AbortController();
    const outputSignals: AbortSignal[] = [];
    const fetchImpl = api.fetchImpl;
    api.fetchImpl = async (input, init) => {
      if (
        new URL(String(input)).pathname.endsWith('/processors') &&
        JSON.parse(String(init?.body)).phase === 'output'
      ) {
        controller.abort();
        outputSignals.push(init!.signal!);
      }
      return fetchImpl(input, init);
    };
    try {
      const { agent } = agentWith([]);
      await agent
        .generate('Hello', { memory: { thread: 'thread_1', resource: 'user_1' }, abortSignal: controller.signal })
        .catch(() => {});
      expect(timeout).toHaveBeenCalledWith(5 * 60_000);
      timeout.mockClear();
      await new PlatformMemoryClient({
        accessToken: 'tok_1',
        instanceId: 'mem_1',
        apiUrl: 'https://platform.test',
        fetch: async () => new Response('{}'),
      }).runProcessors('thread_1', { phase: 'output', resourceId: 'user_1', messageList: {} as never });
      expect(timeout.mock.calls).toEqual([[5 * 60_000]]);
      expect(outputSignals).toHaveLength(1);
      expect(outputSignals[0]!.aborted).toBe(false);
      expect(api.messages.get('thread_1')?.length).toBeGreaterThan(0);
    } finally {
      timeout.mockRestore();
    }
  });

  it('injects server-side observations as a system message', async () => {
    const prompts: any[] = [];
    const { agent } = agentWith(prompts);
    api.observe('<observations>\n* User prefers TypeScript.\n</observations>');

    await agent.generate('Pick a language for me.', { memory: { thread: 'thread_2', resource: 'user_1' } });

    const system = prompts[0].filter((m: any) => m.role === 'system').map((m: any) => m.content);
    expect(system.join('\n')).toContain('User prefers TypeScript.');
    expect(api.requests.some(r => r.path === '/threads/thread_2/processors' && r.body.phase === 'inputStep')).toBe(
      true,
    );
  });

  it('maps thread lookups and recall onto the API', async () => {
    const { agent, memory } = agentWith([]);
    expect(await memory.getThreadById({ threadId: 'missing' })).toBeNull();

    await agent.generate('hello', { memory: { thread: 'thread_3', resource: 'user_9' } });

    expect((await memory.getThreadById({ threadId: 'thread_3' }))?.resourceId).toBe('user_9');
    const recalled = await memory.recall({ threadId: 'thread_3' });
    expect(recalled.messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(recalled.messages.map(m => m.resourceId)).toEqual(['user_9', 'user_9']);
    const unfiltered = await memory.recall({ threadId: 'thread_3', filter: { metadata: {} } });
    expect(unfiltered.messages).toHaveLength(2);
    await expect(memory.recall({ threadId: 'thread_3', filter: { metadata: { k: 'v' } } })).rejects.toThrow(
      'does not support metadata filters',
    );
    expect((await memory.recall({ threadId: 'missing' })).messages).toEqual([]);
  });

  it("keeps a read-only run read-only but still gives it the thread's stored context", async () => {
    const prompts: any[] = [];
    const { agent } = agentWith(prompts);
    await agent.generate('My name is Ada.', { memory: { thread: 'thread_ro', resource: 'user_1' } });
    api.observe('<observations>\n* User prefers TypeScript.\n</observations>');
    const stored = structuredClone(api.messages.get('thread_ro'));
    const before = api.requests.length;

    await agent.generate('What do you know about me?', {
      memory: { thread: 'thread_ro', resource: 'user_1', options: { readOnly: true } },
    });

    const prompt = JSON.stringify(prompts.at(-1));
    expect(prompt).toContain('User prefers TypeScript.');
    expect(prompt).toContain('My name is Ada.');
    const writes = api.requests.slice(before).filter(r => r.method !== 'GET');
    expect(writes).toEqual([]);
    expect(api.messages.get('thread_ro')).toEqual(stored);
  });

  it('does not expose hosted working memory calls or model context', async () => {
    const prompts: any[] = [];
    const { agent, memory } = agentWith(prompts);
    expect(memory.listTools()).toEqual({});
    await expect(memory.getWorkingMemory()).rejects.toThrow('does not support working memory');
    await expect(memory.updateWorkingMemory()).rejects.toThrow('does not support working memory');
    await agent.generate('Hi.', { memory: { thread: 'thread_no_wm', resource: 'user_1' } });
    expect(JSON.stringify(prompts[0])).not.toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
    expect(api.requests.some(request => request.path === '/working-memory')).toBe(false);
  });
});

describe('PlatformMemoryClient', () => {
  const envNames = [
    'MASTRA_PLATFORM_ACCESS_TOKEN',
    'MASTRA_PLATFORM_SECRET_KEY',
    'MASTRA_MEMORY_INSTANCE_ID',
    'MASTRA_MEMORY_API_URL',
    'MASTRA_MEMORY_SERVICE_URL',
    'MASTRA_PROJECT_ID',
    'MASTRA_ENVIRONMENT_ID',
  ];
  beforeEach(() => {
    for (const name of envNames) vi.stubEnv(name, '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to Platform env vars', () => {
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_env');
    vi.stubEnv('MASTRA_MEMORY_INSTANCE_ID', 'mem_env');
    vi.stubEnv('MASTRA_MEMORY_API_URL', 'https://api.example/');
    const client = new PlatformMemoryClient();
    expect(client.instanceId).toBe('mem_env');
    expect(client.mcpUrl).toBe('https://api.example/v1/memory/mem_env/mcp');
    expect(new PlatformMemoryClient({ apiUrl: 'http://localhost:8080/' }).mcpUrl).toBe(
      'http://localhost:8080/v1/memory/mem_env/mcp',
    );
  });

  it('ignores MASTRA_MEMORY_SERVICE_URL; only MASTRA_MEMORY_API_URL overrides the default', () => {
    vi.stubEnv('MASTRA_MEMORY_SERVICE_URL', 'http://injected.local/');
    expect(new PlatformMemoryClient({ accessToken: 't', instanceId: 'mem_1' }).mcpUrl).toBe(
      'https://memory-api.mastra.ai/v1/memory/mem_1/mcp',
    );
    vi.stubEnv('MASTRA_MEMORY_API_URL', 'https://api.example/');
    expect(new PlatformMemoryClient({ accessToken: 't', instanceId: 'mem_1' }).mcpUrl).toBe(
      'https://api.example/v1/memory/mem_1/mcp',
    );
  });

  it('defaults to the hosted Memory API', () => {
    const client = new PlatformMemoryClient({ accessToken: 't', instanceId: 'mem_1' });
    expect(client.mcpUrl).toBe('https://memory-api.mastra.ai/v1/memory/mem_1/mcp');
  });

  it('requires an access token and instance id', () => {
    expect(() => new PlatformMemoryClient({ instanceId: 'mem_1' })).toThrow(/accessToken/);
    expect(() => new PlatformMemoryClient({ accessToken: 't' })).toThrow(/instanceId/);
  });
});
