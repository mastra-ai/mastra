/**
 * `subscribeToThread({ withInitialHistory })` against a real agent, real memory
 * and a retaining pubsub: stored history must cover everything a finished run
 * published, so nothing from it replays after the `thread-history` chunk.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';
import { LeasePubSub, nextTicks } from './thread-stream-test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const threadId = 'history-agent-thread';
const resourceId = 'history-agent-user';

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

function setup(delayBacklog: boolean) {
  const pubsub = new LeasePubSub();
  pubsub.retain = true;
  pubsub.delayBacklog = delayBacklog;
  const lookup = createTool({
    id: 'lookup',
    description: 'look something up',
    inputSchema: z.object({ q: z.string() }),
    requireApproval: true,
    execute: async () => ({ found: true }),
  });
  const agent = new Agent({
    id: 'history-agent',
    name: 'History Agent',
    instructions: 'test',
    model: model(),
    memory: new MockMemory(),
    tools: { lookup },
  });
  const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
  return { agent: mastra.getAgent('agent'), pubsub };
}

const memory = { thread: threadId, resource: resourceId };

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  const types: string[] = [];
  for await (const chunk of stream.fullStream) types.push(chunk.type);
  await nextTicks(20);
  return types;
}

async function historyThenParts(
  agent: Agent<any, any, any, any>,
  withInitialHistory: boolean | { perPage?: number } = true,
) {
  const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory });
  const types: string[] = [];
  const consumed = (async () => {
    for await (const chunk of subscription.stream) types.push((chunk as { type: string }).type);
  })();
  await nextTicks(20);
  subscription.unsubscribe();
  await consumed;
  return types;
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe.each([
  ['immediate', false],
  ['delayed', true],
])('subscribeToThread withInitialHistory with a real agent (%s backlog)', (_mode, delayBacklog) => {
  it('a completed text run emits only thread-history', async () => {
    const { agent } = setup(delayBacklog);
    await drain(await agent.stream('hello', { memory }));

    expect(await historyThenParts(agent)).toEqual(['thread-history']);
  });

  it('an approved and completed tool run does not replay its approval', async () => {
    const { agent } = setup(delayBacklog);
    const first = await agent.stream('use the tool', { memory, requireToolApproval: true });
    expect(await drain(first)).toContain('tool-call-approval');
    await drain(await agent.approveToolCall({ runId: first.runId, toolCallId: 'call-1' }));

    expect(await historyThenParts(agent)).toEqual(['thread-history']);
  });

  it('does not replay an older completed run outside the perPage window', async () => {
    const { agent } = setup(delayBacklog);
    await drain(await agent.stream('hello', { memory }));
    await drain(await agent.stream('hello again', { memory }));

    expect(await historyThenParts(agent, { perPage: 1 })).toEqual(['thread-history']);
  });

  it('still emits the approval of a run waiting on it', async () => {
    const { agent } = setup(delayBacklog);
    await drain(await agent.stream('use the tool', { memory, requireToolApproval: true }));

    expect(await historyThenParts(agent)).toEqual(['thread-history', 'tool-call-approval']);
  });
});
