/**
 * DurableAgent.generate / DurableAgent.resumeGenerate
 *
 * Parity sanity for the non-streaming convenience wrappers. The wrappers run
 * the exact same durable workflow as `stream()` / `resume()` and just drain
 * the underlying `MastraModelOutput` into the shared `FullOutput` shape, so
 * the tests focus on:
 *
 *  - returning a populated `FullOutput` for a simple text turn
 *  - re-throwing errors instead of returning them on `error`
 *  - generate → suspend (requireToolApproval) → resumeGenerate round-trip
 *  - cleanup happens (registry entry removed) on success and on error
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function createTextModel(text: string) {
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
          usage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

describe('DurableAgent.generate()', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('returns a FullOutput with text + usage for a plain text turn', async () => {
    const model = createTextModel('Hello from durable generate');
    const baseAgent = new Agent({
      id: 'generate-text-agent',
      name: 'Generate Text Agent',
      instructions: 'Be brief.',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const out = await durableAgent.generate('hi');

    expect(out.text).toBe('Hello from durable generate');
    expect(out.finishReason).toBe('stop');
    expect(out.usage?.totalTokens).toBe(18);
    expect(out.error).toBeUndefined();
    expect(out.runId).toBeDefined();
  });

  it('cleans up the registry entry after success', async () => {
    const model = createTextModel('done');
    const baseAgent = new Agent({
      id: 'generate-cleanup-agent',
      name: 'Generate Cleanup Agent',
      instructions: 'Be brief.',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const out = await durableAgent.generate('hi');

    expect(out.runId).toBeDefined();
    // generate() owns the run and tears it down on its way out.
    expect(globalRunRegistry.get(out.runId!)).toBeUndefined();
  });

  it('rethrows MastraModelOutput errors instead of swallowing them on FullOutput.error', async () => {
    const failingModel = new MockLanguageModelV2({
      doStream: async () => {
        throw new Error('model exploded');
      },
    });
    const baseAgent = new Agent({
      id: 'generate-error-agent',
      name: 'Generate Error Agent',
      instructions: 'Test errors',
      model: failingModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    await expect(durableAgent.generate('boom')).rejects.toThrow(/model exploded/);
  });
});

describe('DurableAgent.resumeGenerate()', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('drives a generate → tool-approval suspend → resumeGenerate round-trip', async () => {
    const model = createToolCallThenTextModel('searchTool', { query: 'mastra' }, 'Found: mastra');
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ results: ['mastra'] }),
    });

    const baseAgent = new Agent({
      id: 'generate-resume-agent',
      name: 'Generate Resume Agent',
      instructions: 'Use the search tool when asked.',
      model: model as LanguageModelV2,
      tools: { searchTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra so the durable workflow has a storage backend
    // to persist the suspended snapshot resumeGenerate needs to re-enter.
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'generate-resume-agent': durableAgent as any },
    });

    // First turn: tool call requires approval → suspends.
    const first = await durableAgent.generate('search for mastra', {
      requireToolApproval: true,
    });

    // On suspend the durable adapter closes the stream early with the
    // suspended finish reason so callers can detect the pause and resume.
    expect(first.finishReason).toBe('suspended');
    expect(first.runId).toBeDefined();

    // Second turn: approve and drain to a final answer via resumeGenerate.
    const second = await durableAgent.resumeGenerate(first.runId!, { approved: true });

    expect(second.text).toBe('Found: mastra');
    expect(second.finishReason).toBe('stop');
    expect(second.error).toBeUndefined();
  });
});
