import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createAgreementMemory } from './agreement-memory';
import { createScriptModel, toolResults } from './restart-agreement-support';
import { loadGraph } from './restart-harness';

async function persisted(storage: any, threadId: string, resourceId: string) {
  const store = await storage.getStore('memory');
  const out = await store.listMessages({
    threadId,
    resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  return out.messages as any[];
}

async function memoryFor(storage: any) {
  const { MockMemory } = await import('../../../memory/mock');
  return createAgreementMemory({ MockMemory, storage });
}

const message = (id: string, role: string, parts: any[], extra: Record<string, any> = {}) => ({
  id,
  role,
  threadId: 'am-hide-thread',
  resourceId: 'am-hide-resource',
  createdAt: new Date(),
  content: { format: 2, parts, content: '', ...extra },
});

const workingMemoryCall = {
  type: 'tool-invocation',
  toolInvocation: {
    toolName: 'updateWorkingMemory',
    toolCallId: 'wm-1',
    state: 'result',
    args: { memory: '# Profile\n- name: Ada' },
    result: { success: true },
  },
};

describe('agreement memory', () => {
  it('persists a plain agent turn: user message, tool part, and answer all read back', async () => {
    const core: any = await loadGraph();
    const storage = new core.InMemoryStore();
    const memory = await memoryFor(storage);
    const tool = core.createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ n: z.number() }),
      execute: async ({ n }: { n: number }) => ({ doubled: n * 2 }),
    });
    const agent = new core.Agent({
      id: 'agreement-memory-agent',
      instructions: 'Use the tool, then answer.',
      model: createScriptModel(p =>
        toolResults(p).length ? { text: 'answered' } : { tools: [{ name: 'lookup', args: { n: 21 } }] },
      ),
      tools: { lookup: tool },
      memory,
    });

    const output = await agent.stream('Double 21.', { memory: { thread: 'am-thread', resource: 'am-resource' } });
    for await (const _ of output.fullStream) void _;

    const messages = await persisted(storage, 'am-thread', 'am-resource');
    expect(messages.every((m: any) => m.role !== 'system')).toBe(true);
    expect(messages.filter((m: any) => m.role === 'user')).toHaveLength(1);

    const parts = messages.flatMap((m: any) => m.content?.parts ?? []);
    const invocation = parts.find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'lookup');
    expect(invocation?.toolInvocation).toMatchObject({ state: 'result', result: { doubled: 42 } });
    expect(parts.some((p: any) => p.type === 'text' && p.text === 'answered')).toBe(true);
  });

  it('stores only what @mastra/memory would: no system, transient, or working-memory-only messages', async () => {
    const core: any = await loadGraph();
    const storage = new core.InMemoryStore();
    const memory = await memoryFor(storage);

    await memory.saveMessages({
      messages: [
        message('m-system', 'system', [{ type: 'text', text: 'runtime instructions' }]),
        message('m-transient', 'signal', [{ type: 'text', text: 'delivery only' }], {
          metadata: { signal: { type: 'user', transient: true } },
        }),
        message('m-wm-only', 'assistant', [{ type: 'step-start' }, workingMemoryCall]),
        message('m-user', 'user', [{ type: 'text', text: 'remember this' }]),
        message('m-assistant', 'assistant', [
          { type: 'step-start' },
          workingMemoryCall,
          { type: 'text', text: 'saved' },
        ]),
      ],
    });

    const messages = await persisted(storage, 'am-hide-thread', 'am-hide-resource');
    expect(messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);

    const parts = messages.flatMap((m: any) => m.content?.parts ?? []);
    expect(
      parts.some((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'updateWorkingMemory'),
    ).toBe(false);
    expect(parts).toEqual([
      { type: 'text', text: 'remember this' },
      { type: 'text', text: 'saved' },
    ]);
  });
});
