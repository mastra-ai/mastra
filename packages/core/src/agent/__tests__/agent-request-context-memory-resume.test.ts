/**
 * Resuming a run suspended on tool approval when the agent chooses its memory
 * from the request context. The run suspends with tenant 'a' in the context;
 * tenant 'a' gets its own memory store, any other caller the shared store.
 */
import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

const threadId = 'tenant-thread';
const resourceId = 'tenant-resource';
const memoryOption = { thread: threadId, resource: resourceId };
const historyText = (i: number) => `history turn ${i}: ${'h'.repeat(200)}`;

function createModel(prompts: string[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: LanguageModelV2Prompt }) => {
      prompts.push(JSON.stringify(prompt));
      const answered = prompt.some(message => message.role === 'tool');
      const parts = answered
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{"query":"a"}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${prompts.length}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  }) as unknown as LanguageModelV2;
}

const tenantContext = () => {
  const requestContext = new RequestContext();
  requestContext.set('tenant', 'a');
  return requestContext;
};

/**
 * - `fixed`: the tenant store is the agent's only memory.
 * - `per-tenant`: other callers get the shared store.
 * - `tenant-only`: the memory function returns nothing for other callers.
 */
async function setup(memoryMode: 'fixed' | 'per-tenant' | 'tenant-only') {
  const tenantStore = new InMemoryStore();
  const sharedStore = new InMemoryStore();
  const tenantMemory = new MockMemory({ storage: tenantStore, options: { lastMessages: 20 } });
  const sharedMemory = new MockMemory({ storage: sharedStore, options: { lastMessages: 20 } });

  await tenantMemory.createThread({ threadId, resourceId });
  const history: MastraDBMessage[] = Array.from({ length: 4 }, (_, i) => ({
    id: `history-${i}`,
    threadId,
    resourceId,
    role: i % 2 === 0 ? 'user' : 'assistant',
    createdAt: new Date(1_000 + i * 1_000),
    content: { format: 2, parts: [{ type: 'text', text: historyText(i) }] },
  }));
  await tenantMemory.saveMessages({ messages: history });

  const prompts: string[] = [];
  const agent = new Agent({
    id: 'tenant-agent',
    name: 'tenant-agent',
    instructions: 'Use your tools.',
    model: createModel(prompts),
    memory:
      memoryMode === 'fixed'
        ? tenantMemory
        : ({ requestContext }) => {
            if (requestContext.get('tenant') === 'a') return tenantMemory;
            return memoryMode === 'per-tenant' ? sharedMemory : (undefined as unknown as MockMemory);
          },
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute: async () => ({ found: true }),
      }),
    },
  });
  new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });

  const stream = await agent.stream('Look it up', { memory: memoryOption, requestContext: tenantContext() });
  const { toolCallId } = await drain(stream);
  expect(toolCallId).toBeTruthy();
  expect(prompts).toHaveLength(1);

  return { agent, prompts, tenantStore, runId: stream.runId, toolCallId: toolCallId! };
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  let toolCallId: string | undefined;
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return { toolCallId, text };
}

async function threadTexts(storage: InMemoryStore) {
  const memory = (await storage.getStore('memory'))!;
  const { messages } = await memory.listMessages({ threadId, perPage: false });
  return messages.flatMap(message => message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])));
}

const expectFullHistory = (prompt: string | undefined) => {
  for (let i = 0; i < 4; i++) expect(prompt).toContain(historyText(i));
};

describe('resuming an agent whose memory is chosen from the request context', () => {
  it('resumes with fixed memory when the resume call passes no memory option or request context', async () => {
    const { agent, prompts, tenantStore, runId, toolCallId } = await setup('fixed');

    const resumed = await drain(await agent.approveToolCall({ runId, toolCallId }));

    expect(resumed.text).toBe('done');
    expect(prompts).toHaveLength(2);
    expectFullHistory(prompts[1]);
    expect(await threadTexts(tenantStore)).toContain('done');
  });

  it('resumes with the recalled conversation when the resume call passes the same request context', async () => {
    const { agent, prompts, tenantStore, runId, toolCallId } = await setup('per-tenant');

    const resumed = await drain(
      await agent.approveToolCall({ runId, toolCallId, memory: memoryOption, requestContext: tenantContext() }),
    );

    expect(resumed.text).toBe('done');
    expect(prompts).toHaveLength(2);
    expectFullHistory(prompts[1]);
    expect(await threadTexts(tenantStore)).toContain('done');
  });

  it('resumes with the recalled conversation when the resume call omits the request context that chose memory', async () => {
    const { agent, prompts, runId, toolCallId } = await setup('per-tenant');

    // Memory now resolves to the shared store, which does not hold the recalled messages.
    const resumed = await drain(await agent.approveToolCall({ runId, toolCallId, memory: memoryOption }));

    expect(resumed.text).toBe('done');
    expect(prompts).toHaveLength(2);
    expectFullHistory(prompts[1]);
  });

  it('fails to resume when the memory function returns nothing for the resume call', async () => {
    const { agent, prompts, runId, toolCallId } = await setup('tenant-only');

    await expect(agent.approveToolCall({ runId, toolCallId, memory: memoryOption })).rejects.toThrow(
      'Function-based memory returned empty value',
    );
    expect(prompts).toHaveLength(1);
  });
});
