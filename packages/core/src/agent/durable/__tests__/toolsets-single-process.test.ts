/**
 * Call-time toolsets in a single-process durable run (#25852 follow-up).
 *
 * The cross-process toolset check must not fire when the caller's process still
 * holds the toolset tools, e.g. when tool-call rebuilds only to obtain a save
 * queue (memoryless agent + `memory.thread`) or because the model asked for an
 * unknown tool.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function toolCallThenText(toolName: string) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const meta = { type: 'response-metadata', id: `id-${calls}`, modelId: 'mock', timestamp: new Date(0) } as const;
      const parts =
        calls === 1
          ? [
              { type: 'stream-start', warnings: [] },
              meta,
              { type: 'tool-call', toolCallId: 'call-1', toolName, input: '{"text":"hi"}', providerExecuted: false },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              meta,
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return { stream: convertArrayToReadableStream(parts as any), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });
}

async function run(toolName: string, agentId: string) {
  let shoutCalls = 0;
  const shout = createTool({
    id: 'shout',
    description: 'Shout',
    inputSchema: z.object({ text: z.string() }),
    execute: async ({ text }) => {
      shoutCalls++;
      return text.toUpperCase();
    },
  });
  const baseAgent = new Agent({
    id: agentId,
    name: agentId,
    instructions: 'test',
    model: toolCallThenText(toolName) as LanguageModelV2,
  });
  const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: new EventEmitterPubSub() });
  void new Mastra({ agents: { [agentId]: durableAgent }, logger: false });

  let error: unknown;
  const { output, cleanup } = await durableAgent.stream('go', {
    maxSteps: 3,
    toolsets: { ts: { shout } },
    memory: { thread: 'thread-1', resource: 'user-1' },
    onError: ({ error: e }) => {
      error = e;
    },
  });
  const text = await output.text;
  cleanup();
  return { text, error, shoutCalls };
}

describe('call-time toolsets in a single process', () => {
  it('runs toolset tools on a memoryless agent called with a memory thread', async () => {
    const { text, error, shoutCalls } = await run('shout', 'memoryless-thread-agent');
    expect(error).toBeUndefined();
    expect(shoutCalls).toBe(1);
    expect(text).toBe('done');
  });

  it('lets the model recover from an unknown tool name when toolsets are present', async () => {
    const { text, error, shoutCalls } = await run('nope', 'unknown-tool-agent');
    expect(String((error as Error | undefined)?.message ?? '')).not.toMatch(/not available/);
    expect(shoutCalls).toBe(0);
    expect(text).toBe('done');
  });
});
