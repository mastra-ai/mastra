import type { AgentMemory as AgentMemoryClient } from '@surrealdb/memory';
import { describe, expect, it } from 'vitest';
import { createAgentMemoryTools } from './tools';

function makeClient() {
  const calls: Record<'remember' | 'recall' | 'context', unknown[]> = { remember: [], recall: [], context: [] };
  const client = {
    remember: async (text: string, options: unknown) => {
      calls.remember.push(options);
      return { facts: [{ text }] };
    },
    recall: async (_query: string, options: unknown) => {
      calls.recall.push(options);
      return { hits: [] };
    },
    context: async (_query: string, options: unknown) => {
      calls.context.push(options);
      return { context: '' };
    },
  };
  return { client: client as unknown as AgentMemoryClient, calls };
}

const agentContext = {
  agent: { agentId: 'assistant', toolCallId: 'call-1', resourceId: 'user-1', threadId: 'thread-1' },
};
const userScopes = [['mastra/resource/user-1'], ['mastra/thread/thread-1']];

describe('createAgentMemoryTools', () => {
  it("scopes writes and reads to the agent's resource and thread", async () => {
    const { client, calls } = makeClient();
    const tools = createAgentMemoryTools(client);

    await tools.agentMemoryRemember.execute!({ text: 'Alice hikes' }, agentContext as never);
    await tools.agentMemoryRecall.execute!({ query: 'hobbies' }, agentContext as never);
    await tools.agentMemoryContext.execute!({ query: 'hobbies' }, agentContext as never);

    expect(calls.remember[0]).toEqual({ labels: undefined, scopes: userScopes });
    expect(calls.recall[0]).toEqual({ k: undefined, lens: userScopes });
    expect(calls.context[0]).toEqual({ k: undefined, lens: userScopes });
  });

  it('uses the configured scope prefix', async () => {
    const { client, calls } = makeClient();
    const tools = createAgentMemoryTools(client, { scopePrefix: 'app' });

    await tools.agentMemoryRecall.execute!({ query: 'hobbies' }, agentContext as never);

    expect(calls.recall[0]).toEqual({
      k: undefined,
      lens: [['app/resource/user-1'], ['app/thread/thread-1']],
    });
  });

  it('refuses calls without an agent memory identity unless allowUnscoped is set', async () => {
    const { client, calls } = makeClient();

    const refused = await createAgentMemoryTools(client).agentMemoryRecall.execute!({ query: 'hobbies' }, {} as never);
    expect(refused).toHaveProperty('error');
    expect(calls.recall).toHaveLength(0);

    await createAgentMemoryTools(client, { allowUnscoped: true }).agentMemoryRecall.execute!(
      { query: 'hobbies' },
      {} as never,
    );
    expect(calls.recall[0]).toEqual({ k: undefined, lens: undefined });
  });

  it('only enables the context-wide forget tool with allowUnscoped', async () => {
    let forgets = 0;
    const { client } = makeClient();
    (client as unknown as { forget: () => Promise<unknown> }).forget = async () => {
      forgets++;
      return { deleted: 0 };
    };

    const refused = await createAgentMemoryTools(client).agentMemoryForget.execute!(
      { query: 'alice' },
      agentContext as never,
    );
    expect(refused).toHaveProperty('error');
    expect(forgets).toBe(0);

    await createAgentMemoryTools(client, { allowUnscoped: true }).agentMemoryForget.execute!(
      { query: 'alice' },
      agentContext as never,
    );
    expect(forgets).toBe(1);
  });
});
