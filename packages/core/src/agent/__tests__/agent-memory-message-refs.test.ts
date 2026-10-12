/**
 * A run suspended on tool approval persists its transcript in the snapshot.
 * Messages recalled from memory are stored there as refs to their memory
 * rows, and resuming restores them from memory storage.
 */
import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

const threadId = 'refs-thread';
const resourceId = 'refs-resource';
const historyText = (i: number) => `history turn ${i}: ${'h'.repeat(500)}`;

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

async function setup() {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
  await memory.createThread({ threadId, resourceId });
  const history: MastraDBMessage[] = Array.from({ length: 4 }, (_, i) => ({
    id: `history-${i}`,
    threadId,
    resourceId,
    role: i % 2 === 0 ? 'user' : 'assistant',
    createdAt: new Date(1_000 + i * 1_000),
    content: { format: 2, parts: [{ type: 'text', text: historyText(i) }] },
  }));
  await memory.saveMessages({ messages: history });

  const prompts: string[] = [];
  const execute = vi.fn(async () => ({ found: true }));
  const agent = new Agent({
    id: 'refs-agent',
    name: 'refs-agent',
    instructions: 'Use your tools.',
    model: createModel(prompts),
    memory,
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute,
      }),
    },
  });
  const mastra = new Mastra({ agents: { agent }, storage, logger: false });
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  const memoryStore = (await storage.getStore('memory'))!;
  return { agent, prompts, workflows, memoryStore, execute };
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

async function suspendedStreamState(workflows: Awaited<ReturnType<typeof setup>>['workflows']) {
  const { runs } = await workflows.listWorkflowRuns({});
  for (const run of runs) {
    const snapshot = run.snapshot as any;
    for (const step of Object.values<any>(snapshot?.context ?? {})) {
      if (step?.status === 'suspended' && step.suspendPayload?.__streamState) {
        return { serialized: JSON.stringify(runs), streamState: step.suspendPayload.__streamState };
      }
    }
  }
  throw new Error('no suspended stream state persisted');
}

describe('memory-recalled messages in suspended agent runs', () => {
  it('persists recalled messages as refs and resumes with the full conversation', async () => {
    const { agent, prompts, workflows } = await setup();
    const memory = { thread: threadId, resource: resourceId };

    const stream = await agent.stream('Look it up', { memory });
    const { toolCallId } = await drain(stream);
    expect(toolCallId).toBeTruthy();

    const { serialized, streamState } = await suspendedStreamState(workflows);
    const refIds = streamState.messageList.messages.filter((m: any) => m.__ref === 'memory').map((m: any) => m.id);
    expect(refIds).toEqual(['history-0', 'history-1', 'history-2', 'history-3']);
    expect(serialized).not.toContain(historyText(0));

    const resumed = await drain(await agent.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, memory }));
    expect(resumed.text).toBe('done');
    expect(prompts).toHaveLength(2);
    for (let i = 0; i < 4; i++) expect(prompts[1]).toContain(historyText(i));
  });

  it('resumes with the stored version of recalled messages edited or deleted while suspended', async () => {
    const { agent, prompts, workflows, memoryStore } = await setup();
    const memory = { thread: threadId, resource: resourceId };

    const stream = await agent.stream('Look it up', { memory });
    const { toolCallId } = await drain(stream);
    await suspendedStreamState(workflows);

    await memoryStore.updateMessages({
      messages: [
        { id: 'history-0', content: { format: 2, parts: [{ type: 'text', text: 'edited while suspended' }] } },
      ],
    });
    await memoryStore.deleteMessages(['history-1']);

    const resumed = await drain(await agent.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, memory }));
    expect(resumed.text).toBe('done');
    expect(prompts[1]).toContain('edited while suspended');
    expect(prompts[1]).not.toContain(historyText(0));
    expect(prompts[1]).not.toContain(historyText(1));
    expect(prompts[1]).toContain(historyText(2));
    expect(prompts[1]).toContain(historyText(3));
  });

  it('keeps the run suspended for a retry when memory storage cannot load the recalled messages', async () => {
    const { agent, prompts, workflows, memoryStore, execute } = await setup();
    const memory = { thread: threadId, resource: resourceId };

    const stream = await agent.stream('Look it up', { memory });
    const { toolCallId } = await drain(stream);
    await suspendedStreamState(workflows);

    const outage = vi.spyOn(memoryStore, 'listMessagesById').mockRejectedValue(new Error('memory storage down'));
    await expect(agent.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, memory })).rejects.toThrow(
      'memory storage down',
    );
    expect(execute).not.toHaveBeenCalled();
    expect(prompts).toHaveLength(1);
    const { runs } = await workflows.listWorkflowRuns({});
    expect(runs.map(run => (run.snapshot as any).status)).toEqual(runs.map(() => 'suspended'));
    outage.mockRestore();

    const resumed = await drain(await agent.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, memory }));
    expect(resumed.text).toBe('done');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(prompts).toHaveLength(2);
    for (let i = 0; i < 4; i++) expect(prompts[1]).toContain(historyText(i));
  });
});
