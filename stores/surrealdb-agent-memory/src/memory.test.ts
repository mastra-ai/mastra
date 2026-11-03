import type { MastraDBMessage } from '@mastra/core/agent';
import type { StorageThreadType } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { AgentMemoryError } from '@surrealdb/memory';
import type { AgentMemory as AgentMemoryClient } from '@surrealdb/memory';
import { beforeEach, describe, expect, it } from 'vitest';
import { AgentMemory } from './memory';

type Calls = {
  sessionsCreate: unknown[];
  rememberMany: Array<{ batch: Array<{ role: string; content: string }> }>;
  recall: Array<{ query: string; options?: unknown }>;
  remember: unknown[];
  forget: unknown[];
};

function makeFakeAgentMemory(overrides: Partial<Record<keyof AgentMemoryClient, unknown>> = {}): {
  agentMemory: AgentMemoryClient;
  calls: Calls;
} {
  const calls: Calls = {
    sessionsCreate: [],
    rememberMany: [],
    recall: [],
    remember: [],
    forget: [],
  };
  const fake = {
    sessions: {
      create: async (opts: unknown) => {
        calls.sessionsCreate.push(opts);
        return { id: 'sess-1', createdAt: '', scopes: [] };
      },
    },
    documents: { query: async () => ({ hits: [] }) },
    whoami: async () => ({}),
    rememberMany: async (batch: Array<{ role: string; content: string }>) => {
      calls.rememberMany.push({ batch });
      return {};
    },
    recall: async (query: string, options?: unknown) => {
      calls.recall.push({ query, options });
      return {
        hits: [
          {
            id: 'h1',
            score: 0.9,
            source: 'facts',
            text: 'Alice hikes',
          },
        ],
      };
    },
    remember: async (...args: unknown[]) => {
      calls.remember.push(args);
      return {};
    },
    forget: async (...args: unknown[]) => {
      calls.forget.push(args);
      return {};
    },
    context: async () => ({
      context: 'known things',
      queryMs: 0,
      tier: '',
    }),
    ...overrides,
  };
  return { agentMemory: fake as unknown as AgentMemoryClient, calls };
}

function textMsg(id: string, role: MastraDBMessage['role'], text: string, threadId = 'thread-1'): MastraDBMessage {
  return {
    id,
    role,
    type: 'text',
    threadId,
    resourceId: 'user-1',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  } as MastraDBMessage;
}

const thread: StorageThreadType = {
  id: 'thread-1',
  resourceId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AgentMemory', () => {
  let calls: Calls;
  let memory: AgentMemory;

  beforeEach(async () => {
    const fake = makeFakeAgentMemory();
    calls = fake.calls;
    memory = new AgentMemory({
      agentMemory: fake.agentMemory,
      storage: new InMemoryStore(),
      agentMemoryRecall: { topK: 3 },
    });
    await memory.saveThread({ thread });
  });

  it('creates an Agent Memory session lazily on saveThread and caches it', async () => {
    expect(calls.sessionsCreate.length).toBe(1);
    const saved = await memory.getThreadById({ threadId: 'thread-1' });
    expect((saved?.metadata?.__agentMemory as { sessionId?: string })?.sessionId).toBe('sess-1');
  });

  it('mirrors only non-empty, non-synthetic messages to rememberMany', async () => {
    const messages: MastraDBMessage[] = [
      textMsg('m1', 'user', 'My name is Alice'),
      textMsg('agentMemory:x', 'assistant', 'synthetic recall'),
      {
        ...textMsg('m2', 'assistant', ''),
        content: { format: 2, parts: [] },
      } as MastraDBMessage,
    ];
    const result = await memory.saveMessages({ messages });

    expect(result.messages).toHaveLength(3); // verbatim store keeps all
    expect(calls.rememberMany).toHaveLength(1);
    const batch = calls.rememberMany[0]?.batch;
    expect(batch).toEqual([{ role: 'user', content: 'My name is Alice' }]);
  });

  it('recall merges verbatim history with synthesized Agent Memory hits', async () => {
    await memory.saveMessages({ messages: [textMsg('m1', 'user', 'hi')] });
    const res = await memory.recall({
      threadId: 'thread-1',
      resourceId: 'user-1',
      vectorSearchString: 'hobbies',
    } as never);

    expect(calls.recall).toHaveLength(1);
    const ids = res.messages.map(m => m.id);
    expect(ids).toContain('agentMemory:h1');
    expect(ids).toContain('m1');
    // synthesized hit is prepended
    expect(ids[0]).toBe('agentMemory:h1');
  });

  it('scopes semantic recall to the resource and thread being served', async () => {
    await memory.recall({ threadId: 'thread-1', resourceId: 'user-1', vectorSearchString: 'hobbies' } as never);

    expect(calls.recall[0]?.options).toEqual({
      k: 3,
      sessionId: undefined,
      lens: [['mastra/resource/user-1'], ['mastra/thread/thread-1']],
    });
  });

  it('scopes thread-level semantic recall to the thread only', async () => {
    const fake = makeFakeAgentMemory();
    const mem = new AgentMemory({
      agentMemory: fake.agentMemory,
      storage: new InMemoryStore(),
      agentMemoryRecall: { topK: 3, scope: 'thread' },
    });
    await mem.saveThread({ thread });

    await mem.recall({ threadId: 'thread-1', resourceId: 'user-1', vectorSearchString: 'hobbies' } as never);

    expect(fake.calls.recall[0]?.options).toEqual({
      k: 3,
      sessionId: 'sess-1',
      lens: [['mastra/thread/thread-1']],
    });
  });

  it('does not forget Agent Memory facts with a context-wide query when a thread is deleted', async () => {
    await memory.deleteThread('thread-1');

    expect(calls.forget).toHaveLength(0);
    expect(await memory.getThreadById({ threadId: 'thread-1' })).toBeNull();
  });

  it("does not add another resource's thread to the recall or profile lens", async () => {
    const contextCalls: unknown[] = [];
    const fake = makeFakeAgentMemory({
      context: async (_query: string, options: unknown) => {
        contextCalls.push(options);
        return { context: 'known things', queryMs: 0, tier: '' };
      },
    });
    const mem = new AgentMemory({ agentMemory: fake.agentMemory, storage: new InMemoryStore(), injectProfile: true });
    await mem.saveThread({ thread: { ...thread, id: 'thread-2', resourceId: 'user-2' } });

    await mem.recall({ threadId: 'thread-2', resourceId: 'user-1', vectorSearchString: 'hobbies' } as never);
    await mem.getSystemMessage({ threadId: 'thread-2', resourceId: 'user-1' });

    expect(fake.calls.recall[0]?.options).toMatchObject({ lens: [['mastra/resource/user-1']] });
    expect(contextCalls[0]).toMatchObject({ lens: [['mastra/resource/user-1']] });
  });

  it("does not read a deleted thread's remaining facts", async () => {
    await memory.deleteThread('thread-1');

    await memory.recall({ threadId: 'thread-1', resourceId: 'user-2', vectorSearchString: 'hobbies' } as never);

    expect(calls.recall[0]?.options).toMatchObject({ lens: [['mastra/resource/user-2']] });
  });

  it('does not call AgentMemoryClient recall when no vectorSearchString', async () => {
    await memory.saveMessages({ messages: [textMsg('m1', 'user', 'hi')] });
    const res = await memory.recall({
      threadId: 'thread-1',
      resourceId: 'user-1',
    } as never);
    expect(calls.recall).toHaveLength(0);
    expect(res.messages.map(m => m.id)).toEqual(['m1']);
  });

  it('guards AgentMemoryClient failures so the local write still succeeds', async () => {
    const fake = makeFakeAgentMemory({
      rememberMany: async () => {
        throw new AgentMemoryError({ status: 500, title: 'boom' });
      },
    });
    const mem = new AgentMemory({
      agentMemory: fake.agentMemory,
      storage: new InMemoryStore(),
      blocking: true,
    });
    await mem.saveThread({ thread });
    const result = await mem.saveMessages({
      messages: [textMsg('m1', 'user', 'still saved')],
    });
    expect(result.messages).toHaveLength(1);
    const back = await mem.recall({
      threadId: 'thread-1',
      resourceId: 'user-1',
    } as never);
    expect(back.messages.map(m => m.id)).toEqual(['m1']);
  });

  it('scopes the injected profile to the thread and resource being served', async () => {
    const contextCalls: Array<{ query: string; options: unknown }> = [];
    const fake = makeFakeAgentMemory({
      context: async (query: string, options: unknown) => {
        contextCalls.push({ query, options });
        return { context: 'Alice hikes', queryMs: 0, tier: '' };
      },
    });
    const mem = new AgentMemory({ agentMemory: fake.agentMemory, storage: new InMemoryStore(), injectProfile: true });
    await mem.saveThread({ thread });

    const message = await mem.getSystemMessage({ threadId: 'thread-1', resourceId: 'user-1' });

    expect(message).toContain('Alice hikes');
    expect(contextCalls[0]?.options).toEqual({
      k: 10,
      lens: [['mastra/resource/user-1'], ['mastra/thread/thread-1']],
    });
  });
});
