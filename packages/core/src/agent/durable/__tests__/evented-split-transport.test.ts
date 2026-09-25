/**
 * Split-transport regression tests for EventedAgent (Phase 2, Item 5).
 *
 * The evented engine always publishes run events on `mastra.pubsub` (workers
 * in a fleet cannot reach a caller's in-process bus), while the agent's
 * stream adapter subscribes on the agent's own pubsub. When the two buses are
 * different instances, every suspend/finish/tool event used to land on a bus
 * the stream never listened on: the stream silently resolved with no chunks,
 * `null` finish data, and `null` suspended data.
 *
 * The fix is subscriber-side: the agent's CachingPubSub follows
 * `mastra.pubsub` as a source (wired in `__registerMastra`), so events the
 * engine publishes there are cached and re-delivered to local subscribers.
 *
 * These tests pin the split-bus arrangement explicitly: the agent gets its
 * own EventEmitterPubSub while Mastra keeps its default internal bus.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';
import type { EventedAgent } from '../evented-agent';

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

function createToolCallModel(toolName: string, args: Record<string, unknown>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(args),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

async function collectStreamChunks(stream: AsyncIterable<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('EventedAgent split transport (agent pubsub ≠ mastra.pubsub)', () => {
  let agentPubsub: EventEmitterPubSub;

  beforeEach(() => {
    agentPubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await agentPubsub.close();
  });

  function createSetup(model: LanguageModelV2, tools?: Record<string, any>) {
    const baseAgent = new Agent({
      id: 'split-transport-agent',
      name: 'Split Transport Agent',
      instructions: 'You are a helpful assistant',
      model,
      tools,
    });
    // The agent gets its own bus; Mastra keeps its default internal bus. The
    // evented engine publishes on mastra.pubsub, so without source-following
    // the stream below would see nothing.
    const agent = createEventedAgent({ agent: baseAgent, pubsub: agentPubsub });
    void new Mastra({
      agents: { 'split-transport-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
    });
    return agent as EventedAgent;
  }

  it('delivers text and finish chunks to the stream across split buses', async () => {
    const agent = createSetup(createTextStreamModel('Hello!'));

    const { output, cleanup } = await agent.stream('Hi');
    const chunks = await collectStreamChunks(output.fullStream);

    const chunkTypes = chunks.map(chunk => chunk.type);
    expect(chunkTypes).toContain('text-delta');
    expect(chunkTypes).toContain('finish');
    expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'Hello!')).toBe(true);

    cleanup();
  }, 30_000);

  it('delivers tool-approval suspension data across split buses', async () => {
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => ({ results: ['result1'] }),
    });
    const agent = createSetup(createToolCallModel('searchTool', { query: 'test' }), { searchTool });

    let suspendedData: any = null;
    const { cleanup } = await agent.stream('Search for test', {
      requireToolApproval: true,
      onSuspended: (data: any) => {
        suspendedData = data;
      },
    });

    await vi.waitFor(
      () => {
        expect(suspendedData).not.toBeNull();
      },
      { timeout: 15_000 },
    );
    expect(suspendedData.type).toBe('approval');
    expect(suspendedData.toolName).toBe('searchTool');
    expect(suspendedData.toolCallId).toBe('call-1');

    cleanup();
  }, 30_000);
});
