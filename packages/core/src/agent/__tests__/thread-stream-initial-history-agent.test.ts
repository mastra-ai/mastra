/**
 * `subscribeToThread({ withInitialHistory })` against a real agent, real memory
 * and a retaining pubsub: stored history must cover everything a finished run
 * published, so nothing from it replays after the `thread-history` chunk.
 */
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import type { AgentThreadSubscription } from '../types';
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
  withRunStatus = true,
) {
  const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory, withRunStatus });
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
  it('does not emit run outcomes unless the subscriber opts in (COR-1500)', async () => {
    const { agent } = setup(delayBacklog);
    await drain(await agent.stream('hello', { memory }));
    expect(await historyThenParts(agent, true, false)).toEqual(['thread-history']);
    const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true });
    const types: string[] = [];
    const consumed = (async () => {
      for await (const chunk of subscription.stream) types.push(chunk.type);
    })();
    await nextTicks(20);
    subscription.unsubscribe();
    await consumed;
    expect(types).toEqual(['thread-history']);
  });

  it('preserves inferred stream types unless each optional chunk is requested', async () => {
    const { agent } = setup(delayBacklog);
    const defaultSubscription = await agent.subscribeToThread({ threadId, resourceId });
    expectTypeOf(defaultSubscription).toEqualTypeOf<AgentThreadSubscription<unknown>>();
    defaultSubscription.unsubscribe();
    const history = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true });
    expectTypeOf(history).toEqualTypeOf<AgentThreadSubscription<unknown, true>>();
    history.unsubscribe();
    const status = await agent.subscribeToThread({ threadId, resourceId, withRunStatus: true });
    expectTypeOf(status).toEqualTypeOf<AgentThreadSubscription<unknown, false, true>>();
    status.unsubscribe();
    const both = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true, withRunStatus: true });
    expectTypeOf(both).toEqualTypeOf<AgentThreadSubscription<unknown, true, true>>();
    both.unsubscribe();
  });

  it('an opted-in completed text run emits history and its outcome', async () => {
    const { agent } = setup(delayBacklog);
    await drain(await agent.stream('hello', { memory }));

    expect(await historyThenParts(agent)).toEqual(['thread-history', 'thread-run-status']);
  });

  it('an approved and completed tool run does not replay its approval', async () => {
    const { agent } = setup(delayBacklog);
    const first = await agent.stream('use the tool', { memory, requireToolApproval: true });
    expect(await drain(first)).toContain('tool-call-approval');
    await drain(await agent.approveToolCall({ runId: first.runId, toolCallId: 'call-1' }));

    expect(await historyThenParts(agent)).toEqual(['thread-history', 'thread-run-status']);
  });

  it('does not replay an older completed run outside the perPage window', async () => {
    const { agent } = setup(delayBacklog);
    await drain(await agent.stream('hello', { memory }));
    await drain(await agent.stream('hello again', { memory }));

    expect(await historyThenParts(agent, { perPage: 1 })).toEqual([
      'thread-history',
      'thread-run-status',
      'thread-run-status',
    ]);
  });

  it('still emits the approval of a run waiting on it', async () => {
    const { agent } = setup(delayBacklog);
    await drain(await agent.stream('use the tool', { memory, requireToolApproval: true }));

    expect(await historyThenParts(agent)).toEqual(['thread-history', 'tool-call-approval', 'thread-run-status']);
  });
});
