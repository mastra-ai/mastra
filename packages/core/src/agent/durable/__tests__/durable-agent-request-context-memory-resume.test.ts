/**
 * Approving a durable run when the agent chooses its memory from the request
 * context. The run suspends with tenant 'a' in the context; tenant 'a' gets its
 * own memory store, any other caller the shared store. An approval that passes
 * no request context resumes with the context the run started with.
 */
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { MastraDBMessage } from '../../message-list';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

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
      };
    },
  });
}

type Stores = { workflows: InMemoryStore; tenant: InMemoryStore; shared: InMemoryStore };

/**
 * - `per-tenant`: other callers get the shared store.
 * - `tenant-only`: the memory function returns nothing for other callers.
 */
function startProcess(stores: Stores, memoryMode: 'per-tenant' | 'tenant-only', prompts: string[]) {
  globalRunRegistry.clear();
  const tenantMemory = new MockMemory({ storage: stores.tenant, options: { lastMessages: 20 } });
  const sharedMemory = new MockMemory({ storage: stores.shared, options: { lastMessages: 20 } });
  const agent = new Agent({
    id: 'tenant-agent',
    name: 'tenant-agent',
    instructions: 'Use your tools.',
    model: createModel(prompts),
    memory: ({ requestContext }) => {
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
  const durableAgent = createDurableAgent({ agent });
  new Mastra({ agents: { durableAgent }, storage: stores.workflows, logger: false });
  return durableAgent;
}

async function setup(memoryMode: 'per-tenant' | 'tenant-only') {
  const stores: Stores = { workflows: new InMemoryStore(), tenant: new InMemoryStore(), shared: new InMemoryStore() };
  const tenantMemory = new MockMemory({ storage: stores.tenant, options: { lastMessages: 20 } });
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
  const durableAgent = startProcess(stores, memoryMode, prompts);
  const requestContext = new RequestContext();
  requestContext.set('tenant', 'a');
  const stream = await durableAgent.stream('Look it up', { memory: memoryOption, requestContext });

  let toolCallId: string | undefined;
  for await (const chunk of stream.fullStream as AsyncIterable<any>) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
      break;
    }
  }
  expect(toolCallId).toBeTruthy();
  const workflows = (await stores.workflows.getStore('workflows'))!;
  await vi.waitFor(async () => {
    const run = await workflows.getWorkflowRunById({ runId: stream.runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    expect((run?.snapshot as any)?.status).toBe('suspended');
  });
  expect(prompts).toHaveLength(1);

  return { durableAgent, stores, prompts, runId: stream.runId, toolCallId: toolCallId! };
}

async function collectText(stream: { fullStream: AsyncIterable<any> }) {
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return text;
}

async function threadTexts(storage: InMemoryStore) {
  const memory = (await storage.getStore('memory'))!;
  const { messages } = await memory.listMessages({ threadId, perPage: false });
  return messages.flatMap(message => message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])));
}

async function expectResumedAgainstTenantMemory(
  { stores, prompts }: { stores: Stores; prompts: string[] },
  resumed: { fullStream: AsyncIterable<any> },
) {
  expect(await collectText(resumed)).toBe('done');
  expect(prompts).toHaveLength(2);
  for (let i = 0; i < 4; i++) expect(prompts[1]).toContain(historyText(i));
  expect(await threadTexts(stores.tenant)).toContain('done');
  expect(await threadTexts(stores.shared)).toEqual([]);
}

describe('approving a durable agent whose memory is chosen from the request context', () => {
  it('resumes against the run memory when approved in the same process without the request context', async () => {
    const run = await setup('per-tenant');

    const resumed = await run.durableAgent.approveToolCall({
      runId: run.runId,
      toolCallId: run.toolCallId,
      memory: memoryOption,
    });

    await expectResumedAgainstTenantMemory(run, resumed);
  });

  it('resumes against the run memory when approved in a fresh process without the request context', async () => {
    const run = await setup('per-tenant');
    const durableAgent = startProcess(run.stores, 'per-tenant', run.prompts);

    const resumed = await durableAgent.approveToolCall({
      runId: run.runId,
      toolCallId: run.toolCallId,
      memory: memoryOption,
    });

    await expectResumedAgainstTenantMemory(run, resumed);
  });

  it('resumes in a fresh process when the memory function returns nothing without the request context', async () => {
    const run = await setup('tenant-only');
    const durableAgent = startProcess(run.stores, 'tenant-only', run.prompts);

    const resumed = await durableAgent.approveToolCall({
      runId: run.runId,
      toolCallId: run.toolCallId,
      memory: memoryOption,
    });

    await expectResumedAgainstTenantMemory(run, resumed);
  });

  it('resumes with the recalled conversation when approved in a fresh process with a request context that chose other memory', async () => {
    const run = await setup('per-tenant');
    const durableAgent = startProcess(run.stores, 'per-tenant', run.prompts);

    // The caller's context wins over the saved one, so memory resolves to the shared store,
    // which does not hold the recalled messages.
    const resumed = await durableAgent.approveToolCall({
      runId: run.runId,
      toolCallId: run.toolCallId,
      memory: memoryOption,
      requestContext: new RequestContext(),
    });

    expect(await collectText(resumed)).toBe('done');
    expect(run.prompts).toHaveLength(2);
    for (let i = 0; i < 4; i++) expect(run.prompts[1]).toContain(historyText(i));
  });
});
