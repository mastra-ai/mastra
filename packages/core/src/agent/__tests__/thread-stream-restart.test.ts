/**
 * The two restart scenarios verified by hand against Factory, against a real
 * agent: shared storage, memory and stream backend, fresh runtime state per boot.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import type { Agent } from '../agent';
import { Agent as AgentClass } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';
import { LeasePubSub, nextTicks } from './thread-stream-test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const threadId = 'restart-thread';
const resourceId = 'restart-user';
const memory = { thread: threadId, resource: resourceId };

function model() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const text = JSON.stringify(prompt);
      const callTool = text.includes('use the tool') && !text.includes('"type":"tool-result"');
      const parts = callTool
        ? [
            { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'lookup', input: '{"q":"x"}' },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ]
        : [
            { type: 'text-start' as const, id: 't' },
            { type: 'text-delta' as const, id: 't', delta: 'answer' },
            { type: 'text-end' as const, id: 't' },
            { type: 'finish' as const, finishReason: 'stop' as const, usage },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'r', modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ]),
      };
    },
  });
}

/** Everything that outlives a process: storage, memory storage, and the stream backend. */
function backend() {
  const storage = new InMemoryStore();
  const memoryStorage = new InMemoryStore();
  let pubsub = new LeasePubSub();
  pubsub.retain = true;
  const topics = new Set<string>();
  const executed: string[] = [];

  const boot = () => {
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic: string, event: any) => {
      topics.add(topic);
      return publish(topic, event);
    };
    const lookup = createTool({
      id: 'lookup',
      description: 'look something up',
      inputSchema: z.object({ q: z.string() }),
      requireApproval: true,
      execute: async () => {
        executed.push('lookup');
        return { found: true };
      },
    });
    const agent = new AgentClass({
      id: 'restart-agent',
      name: 'Restart Agent',
      instructions: 'test',
      model: model(),
      memory: new MockMemory({ storage: memoryStorage }),
      tools: { lookup },
    });
    const mastra = new Mastra({ agents: { agent }, storage, logger: false, pubsub });
    return mastra.getAgent('agent');
  };

  return {
    boot,
    restart: () => {
      agentThreadStreamRuntime.resetForTests();
      pubsub = pubsub.restart();
      return boot();
    },
    executed,
    runEntries: () =>
      [...topics].flatMap(topic => pubsub.retainedEvents(topic)).filter(event => event.runId !== undefined),
  };
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  const types: string[] = [];
  for await (const chunk of stream.fullStream) types.push(chunk.type);
  await nextTicks(20);
  return types;
}

/** What a reloaded page sees: the history chunk plus anything replayed after it. */
async function reload(agent: Agent<any, any, any, any>) {
  const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true });
  const chunks: any[] = [];
  const consumed = (async () => {
    for await (const chunk of subscription.stream) chunks.push(chunk);
  })();
  await nextTicks(20);
  subscription.unsubscribe();
  await consumed;
  return chunks;
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('thread history across a restart', () => {
  it('a completed run loads once from history and leaves nothing on the stream', async () => {
    const env = backend();
    await drain(await env.boot().stream('hello', { memory }));
    expect(env.runEntries()).toEqual([]);

    const chunks = await reload(env.restart());

    expect(chunks.map(chunk => chunk.type)).toEqual(['thread-history']);
    const [history] = chunks;
    expect(history.payload.messages.filter((m: any) => m.role === 'user')).toHaveLength(1);
    expect(history.payload.messages.filter((m: any) => m.role === 'assistant')).toHaveLength(1);
  });

  it('a pending approval survives a restart once, can be answered, and is gone after the next restart', async () => {
    const env = backend();
    const first = await env.boot().stream('use the tool', { memory, requireToolApproval: true });
    expect(await drain(first)).toContain('tool-call-approval');
    expect(env.runEntries().length).toBeGreaterThan(0);

    // Restart before answering: the card comes back exactly once.
    const restarted = env.restart();
    const restored = await reload(restarted);
    expect(restored.map(chunk => chunk.type)).toEqual(['thread-history', 'tool-call-approval']);

    // Answer it the way a restored card is answered: find the stored suspended run.
    const { runs } = await restarted.listSuspendedRuns({ threadId, resourceId });
    const run = runs.find(r => r.toolCalls.some(call => call.toolCallId === 'call-1'));
    expect(run).toBeDefined();
    await drain(await restarted.approveToolCall({ runId: run!.runId, toolCallId: 'call-1' }));

    expect(env.executed).toEqual(['lookup']);
    expect((await restarted.listSuspendedRuns({ threadId, resourceId })).runs).toEqual([]);
    // Both halves of the run — before and after the restart — leave the stream.
    expect(env.runEntries()).toEqual([]);

    // Restart again: no card, no replay.
    expect((await reload(env.restart())).map(chunk => chunk.type)).toEqual(['thread-history']);
    expect(env.executed).toEqual(['lookup']);
  });
});
