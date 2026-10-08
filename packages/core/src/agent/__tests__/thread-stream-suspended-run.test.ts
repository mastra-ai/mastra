import { afterEach, describe, expect, it, vi } from 'vitest';
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

function approvalModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'r', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'checking' },
        { type: 'text-end', id: 't1' },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{"q":"x"}' },
        { type: 'finish', finishReason: 'tool-calls', usage },
      ]),
    }),
  });
}

function lifecycleEvents(pubsub: LeasePubSub): string[] {
  return pubsub
    .retainedTopics()
    .flatMap(topic => pubsub.retainedEvents(topic))
    .map(event => event.data?.type as string)
    .filter(type => type?.startsWith('run-'));
}

describe('thread stream: run waiting on approval', () => {
  afterEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it.each([0, 5, 30])('publishes run-suspended, not run-completed, with %i ms publish lag', async delayMs => {
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    pubsub.streamPartDelayMs = delayMs;
    const agent = new Agent({
      id: 'approval-agent',
      name: 'Approval Agent',
      instructions: 'test',
      model: approvalModel(),
      memory: new MockMemory({ storage: new InMemoryStore() }),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'l',
          inputSchema: z.object({ q: z.string() }),
          requireApproval: true,
          execute: async () => ({ found: true }),
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
    const registered = mastra.getAgent('agent');

    const output = await registered.stream('go', {
      memory: { thread: `suspended-run-${delayMs}`, resource: 'user' },
    });
    for await (const _chunk of output.fullStream) {
      // drain
    }
    expect(output.status).toBe('suspended');

    await vi.waitFor(() => expect(lifecycleEvents(pubsub).at(-1)).toMatch(/^run-(suspended|completed)$/));
    await nextTicks(20);

    const events = lifecycleEvents(pubsub);
    expect(events).toContain('run-suspended');
    expect(events).not.toContain('run-completed');
  });
});
