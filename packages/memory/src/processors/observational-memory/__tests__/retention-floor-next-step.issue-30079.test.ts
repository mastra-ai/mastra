import { MockLanguageModelV3, simulateReadableStream } from '@internal/ai-v6/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent, MessageList } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory, InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';

// Issue #30079: after a mid-turn buffered activation, cleanup keeps an activated message as raw
// context to honour the retention floor. The per-step filter on the next step must keep it too.
// A message cleanup kept only because the model had not read it yet is not a floor keep.

const MESSAGE_TOKENS = 9500; // floor = 9500 * (1 - default bufferActivation 0.8) = 1900
const TOOL_CALLS = 13;
const SHORT_FROM = 12;

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const streamOf = (chunks: any[]) => ({
  stream: simulateReadableStream({ chunks: [{ type: 'stream-start', warnings: [] }, ...chunks] }),
});
const finish = (reason: string) => ({ type: 'finish', finishReason: { unified: reason, raw: reason }, usage });
const textStream = (text: string) =>
  streamOf([
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: text },
    { type: 'text-end', id: 't' },
    finish('stop'),
  ]);

async function runLookups(observation: Record<string, unknown>, toolCalls = TOOL_CALLS, shortFrom = SHORT_FROM) {
  let observerCalls = 0;
  const observerText = () => `<observations>\nDate: Nov 11, 2026\n* 🟡 (10:00) Agent ran a lookup.\n</observations>`;
  const observer = new MockLanguageModelV3({
    doStream: async () => {
      observerCalls++;
      return textStream(observerText()) as any;
    },
    doGenerate: async () => {
      observerCalls++;
      return {
        content: [{ type: 'text', text: observerText() }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
        warnings: [],
      } as any;
    },
  });

  const requests: { results: number[]; observerCalls: number }[] = [];
  const actor = new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      const step = requests.length;
      const rawText = JSON.stringify(prompt.filter(m => m.role !== 'system'));
      requests.push({
        results: [...new Set([...rawText.matchAll(/RESULT-(\d+)/g)].map(m => Number(m[1])))],
        observerCalls,
      });
      if (step < toolCalls) {
        return streamOf([
          {
            type: 'tool-call',
            toolCallId: `call-${step + 1}`,
            toolName: 'lookup',
            input: JSON.stringify({ n: step + 1 }),
          },
          finish('tool-calls'),
        ]) as any;
      }
      return textStream('done') as any;
    },
  });

  const filler = 'alpha bravo charlie delta echo foxtrot golf hotel '.repeat(90);
  const lookup = createTool({
    id: 'lookup',
    description: 'Look up item n.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      // Let the fire-and-forget buffer call store its chunk before the next step.
      await new Promise(resolve => setTimeout(resolve, 300));
      return n >= shortFrom ? `RESULT-${n} ok` : `RESULT-${n} ${filler}`;
    },
  });

  const memory = new Memory({
    storage: new InMemoryStore(),
    options: { observationalMemory: { model: observer as any, observation } },
  });
  const agent = new Agent({
    id: 'issue-30079',
    name: 'issue-30079',
    instructions: 'Look up the items the user asks for.',
    model: actor as any,
    tools: { lookup },
    memory,
  });

  const output = await agent.stream('USER-REQUEST: look up the items one by one.', {
    memory: { thread: 'thread-1', resource: 'resource-1' },
    maxSteps: toolCalls + 2,
  });
  const activatedBeforeRequest = new Set<number>();
  for await (const chunk of output.fullStream as any) {
    if (chunk.type === 'data-om-activation') activatedBeforeRequest.add(requests.length);
  }
  await (memory as any).settled?.();

  return { requests, activatedBeforeRequest };
}

describe('retention floor after a mid-turn activation (#30079)', () => {
  it.each([
    { activations: 1, toolCalls: TOOL_CALLS, shortFrom: SHORT_FROM },
    { activations: 2, toolCalls: 22, shortFrom: 21 },
  ])(
    'keeps the floor-retained tail after $activations mid-turn activation(s)',
    async ({ activations, toolCalls, shortFrom }) => {
      const { requests, activatedBeforeRequest } = await runLookups(
        { messageTokens: MESSAGE_TOKENS },
        toolCalls,
        shortFrom,
      );

      expect(activatedBeforeRequest.size).toBeGreaterThanOrEqual(activations);

      // Between two model calls with no activation and no observer call, nothing the model already
      // saw may leave the prompt: the retention floor that cleanup honoured must still hold.
      for (let i = 1; i < requests.length; i++) {
        const prev = requests[i - 1]!;
        const cur = requests[i]!;
        if (activatedBeforeRequest.has(i) || cur.observerCalls !== prev.observerCalls) continue;
        const dropped = prev.results.filter(n => !cur.results.includes(n));
        expect({ request: i, dropped }).toEqual({ request: i, dropped: [] });
      }
    },
    60_000,
  );

  it('does not keep a message for the floor when it was kept only because it was in flight', async () => {
    const threadId = 'thread-in-flight';
    const resourceId = 'resource-in-flight';
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(), updatedAt: new Date() },
    });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: {
        model: 'openai/gpt-4o-mini' as any,
        messageTokens: 10_000,
        bufferTokens: 2_000,
        bufferActivation: 0.8,
        blockAfter: 1.2,
      },
      reflection: { model: 'openai/gpt-4o-mini' as any, observationTokens: 50_000 },
    });
    const cleanup = vi.spyOn(om, 'cleanupMessages');

    const t0 = Date.now() - 60_000;
    const msg = (id: string, role: 'user' | 'assistant', text: string, at: number): MastraDBMessage => ({
      id,
      role,
      content: { format: 2, parts: [{ type: 'text', text }] },
      type: 'text',
      createdAt: new Date(t0 + at),
      threadId,
      resourceId,
    });
    const oldUser = msg('old-user', 'user', 'hello '.repeat(300), 0);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), 1000);
    const request = msg('request', 'user', 'please run the tool', 2000);
    const toolResult = msg('tool-result', 'assistant', 'data '.repeat(11_000), 3000);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    // A buffered chunk that already covers the request and the tool result the model has not read.
    await storage.updateBufferedObservations({
      id: record.id,
      chunk: {
        observations: '- ran the tool',
        tokenCount: 20,
        messageIds: ['old-user', 'old-assistant', 'request', 'tool-result'],
        cycleId: 'cycle-a',
        messageTokens: 11_600,
        lastObservedAt: toolResult.createdAt,
      },
    });
    await storage.setPendingMessageTokens(record.id, 600);

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(request, 'input');
    messageList.add(toolResult, 'response');
    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();

    // Activation with a floor above 0: cleanup removes the old messages and keeps the unread ones
    // only because they are in flight.
    expect((await turn.step(1).prepare()).observed).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanup.mock.calls[0]![0].retentionFloor).toBeGreaterThan(0);
    expect(cleanup.mock.calls[0]![0].preserveMessageIds).toEqual(expect.arrayContaining(['request', 'tool-result']));
    expect(messageList.get.all.db().map(m => m.id)).toEqual(['request', 'tool-result']);

    // The model has now read them, so the next step's filter drops them like any observed message.
    await turn.step(2).prepare();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(messageList.get.all.db().map(m => m.id)).toEqual([]);
  });

  it('still drops observed messages the model already read when there is no floor', async () => {
    const { requests } = await runLookups({ messageTokens: 3_000, bufferTokens: false });
    // The request that observed kept its newest tool result only because the model had not read it
    // yet. Once read, it leaves the prompt on the next call like the rest of the observed messages.
    const observedAt = requests.findIndex((r, i) => i > 0 && r.observerCalls > requests[i - 1]!.observerCalls);
    expect(observedAt).toBeGreaterThan(0);
    expect(observedAt).toBeLessThan(requests.length - 1);
    const readInFlight = Math.max(...requests[observedAt]!.results);
    expect(requests[observedAt + 1]!.results).not.toContain(readInFlight);
  }, 60_000);
});
