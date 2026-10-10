import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { PlatformMemoryClient } from './client';
import { PlatformMemory } from './platform-memory';

type StoredMessage = { id: string; role: string; content: string; createdAt: string };

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
    if (path === '/working-memory' && method === 'PUT') return json({ ok: true });
    if ((m = path.match(/^\/threads\/([^/]+)\/context$/))) {
      const id = decodeURIComponent(m[1]!);
      return json({ system: observations, messages: messages.get(id) ?? [], observedAt: null });
    }
    if ((m = path.match(/^\/threads\/([^/]+)\/messages$/))) {
      return json({ messages: messages.get(decodeURIComponent(m[1]!)) ?? [], hasMore: false });
    }
    if ((m = path.match(/^\/threads\/([^/]+)$/))) {
      const t = thread(decodeURIComponent(m[1]!));
      return t ? json(t) : json({ title: 'Not found' }, 404);
    }
    if (path === '/threads' && method === 'POST') {
      threads.set(body.id, { id: body.id, resourceId: body.resourceId, title: body.title ?? '', metadata: {} });
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

  it('injects server-side observations as a system message', async () => {
    const prompts: any[] = [];
    const { agent } = agentWith(prompts);
    api.observe('<observations>\n* User prefers TypeScript.\n</observations>');

    await agent.generate('Pick a language for me.', { memory: { thread: 'thread_2', resource: 'user_1' } });

    const system = prompts[0].filter((m: any) => m.role === 'system').map((m: any) => m.content);
    expect(system.join('\n')).toContain('User prefers TypeScript.');
    const ctx = api.requests.find(r => r.path === '/threads/thread_2/context')!;
    expect(ctx).toBeDefined();
  });

  it('maps thread lookups and recall onto the API', async () => {
    const { agent, memory } = agentWith([]);
    expect(await memory.getThreadById({ threadId: 'missing' })).toBeNull();

    await agent.generate('hello', { memory: { thread: 'thread_3', resource: 'user_9' } });

    expect((await memory.getThreadById({ threadId: 'thread_3' }))?.resourceId).toBe('user_9');
    const recalled = await memory.recall({ threadId: 'thread_3' });
    expect(recalled.messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });

  it('lets the agent update working memory in tool mode', async () => {
    const opts = { accessToken: 'tok_1', instanceId: 'mem_1', apiUrl: 'https://platform.test', fetch: api.fetchImpl };
    expect(Object.keys(new PlatformMemory(opts).listTools())).toEqual([]);
    const memory = new PlatformMemory({ ...opts, workingMemory: 'tool' });
    expect(Object.keys(memory.listTools({ readOnly: true }))).toEqual([]);

    const tool = memory.listTools().updateWorkingMemory!;
    await tool.execute!({ memory: '# User\n- Name: Ada' }, { agent: { threadId: 't', resourceId: 'user_1' } } as never);

    const put = api.requests.find(r => r.path === '/working-memory')!;
    expect(put.body).toEqual({ resourceId: 'user_1', workingMemory: '# User\n- Name: Ada' });
  });
});

describe('PlatformMemoryClient', () => {
  it('falls back to Platform env vars', () => {
    process.env.MASTRA_PLATFORM_SECRET_KEY = 'sk_env';
    process.env.MASTRA_MEMORY_INSTANCE_ID = 'mem_env';
    process.env.MASTRA_PLATFORM_API_URL = 'https://api.example/';
    try {
      const client = new PlatformMemoryClient();
      expect(client.instanceId).toBe('mem_env');
      expect(client.mcpUrl).toBe('https://api.example/v1/memory/mem_env/mcp');
    } finally {
      delete process.env.MASTRA_PLATFORM_SECRET_KEY;
      delete process.env.MASTRA_MEMORY_INSTANCE_ID;
      delete process.env.MASTRA_PLATFORM_API_URL;
    }
  });

  it('requires an access token and instance id', () => {
    expect(() => new PlatformMemoryClient({ instanceId: 'mem_1' })).toThrow(/accessToken/);
    expect(() => new PlatformMemoryClient({ accessToken: 't' })).toThrow(/instanceId/);
  });
});
