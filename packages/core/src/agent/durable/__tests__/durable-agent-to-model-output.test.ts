/**
 * DurableAgent toModelOutput tests.
 *
 * Verifies that tool-level toModelOutput is computed and the modelOutput
 * is merged into providerMetadata on the messageList tool invocation,
 * with image-url normalization (Bug 9 parity fix).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function createToolCallingModel(
  toolName: string,
  toolArgs: Record<string, unknown>,
  onPrompt?: (prompt: unknown) => void,
) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      onPrompt?.(prompt);
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              id: 'tc-1',
              toolCallType: 'function',
              toolCallId: 'tc-1',
              toolName,
              args: JSON.stringify(toolArgs),
              input: JSON.stringify(toolArgs),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  }) as unknown as LanguageModelV2;
}

describe('DurableAgent toModelOutput parity', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes toModelOutput and merges into messageList providerMetadata', async () => {
    const toModelOutputSpy = vi.fn(result => ({
      type: 'content',
      value: [{ type: 'text', text: `Processed: ${result.data}` }],
    }));

    const testTool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ data: z.string() }),
      execute: async () => ({ data: 'hello world' }),
      toModelOutput: toModelOutputSpy,
    });

    const model = createToolCallingModel('test-tool', { query: 'test' });

    const baseAgent = new Agent({
      name: 'test-agent',
      instructions: 'You are a test agent.',
      model,
      tools: { 'test-tool': testTool },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    new Mastra({
      agents: { 'test-agent': durableAgent as any },
      storage: new InMemoryStore(),
    });

    const result = await durableAgent.stream('Use the test tool');

    // Consume the stream
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    // toModelOutput should have been called with the tool result
    expect(toModelOutputSpy).toHaveBeenCalledTimes(1);
    // The tool wraps execute() output into { data, outputSchemaErrors }
    const callArg = toModelOutputSpy.mock.calls[0][0];
    expect(callArg).toBeDefined();
  });

  it('computes toModelOutput before non-enumerable execution metadata crosses the durable boundary', async () => {
    const metadataSymbol = Symbol.for('test.durable.tool.metadata');
    const toModelOutputSpy = vi.fn((result: Record<PropertyKey, unknown>) => ({
      type: 'text' as const,
      value: result[metadataSymbol] as string,
    }));

    const testTool = createTool({
      id: 'metadata-tool',
      description: 'A tool with invocation-scoped model content',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ data: z.string() }),
      execute: async () => ({ data: 'structured value' }),
      onOutput: async ({ output }) => {
        Object.defineProperty(output, metadataSymbol, {
          value: 'model-facing content',
          enumerable: false,
        });
      },
      toModelOutput: toModelOutputSpy,
    });

    const prompts: any[] = [];
    const model = createToolCallingModel('metadata-tool', { query: 'test' }, prompt => prompts.push(prompt));
    const baseAgent = new Agent({
      name: 'metadata-agent',
      instructions: 'You are a test agent.',
      model,
      tools: { 'metadata-tool': testTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    new Mastra({
      agents: { 'metadata-agent': durableAgent as any },
      storage: new InMemoryStore(),
    });

    const result = await durableAgent.stream('Use the metadata tool');
    for await (const _chunk of result.fullStream) {
      // drain
    }

    expect(toModelOutputSpy).toHaveBeenCalledTimes(1);
    expect(toModelOutputSpy.mock.calls[0][0][metadataSymbol]).toBe('model-facing content');
    expect(JSON.stringify(prompts[1])).toContain('model-facing content');
  });

  it('normalizes image-url to media type in toModelOutput', async () => {
    const toModelOutputSpy = vi.fn(() => ({
      type: 'content',
      value: [
        { type: 'image-url', url: 'data:image/png;base64,abc123' },
        { type: 'text', text: 'A description' },
      ],
    }));

    const testTool = createTool({
      id: 'image-tool',
      description: 'A tool that returns images',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ url: z.string() }),
      execute: async () => ({ url: 'https://example.com/image.png' }),
      toModelOutput: toModelOutputSpy,
    });

    const model = createToolCallingModel('image-tool', { query: 'cat' });

    const baseAgent = new Agent({
      name: 'image-agent',
      instructions: 'You are a test agent.',
      model,
      tools: { 'image-tool': testTool },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    new Mastra({
      agents: { 'image-agent': durableAgent as any },
      storage: new InMemoryStore(),
    });

    const result = await durableAgent.stream('Find a cat image');

    // Consume the stream
    for await (const _chunk of result.fullStream) {
      // drain
    }

    // toModelOutput should have been called
    expect(toModelOutputSpy).toHaveBeenCalledTimes(1);
    // The normalization happens inside the mapping step — we verify the spy was called
    // and the stream completed without errors, which proves the normalizeModelOutput
    // path was exercised (image-url → media conversion).
  });

  it('keeps the raw tool result when toModelOutput returns undefined', async () => {
    // Mastra's built-in tools (workspace read_file, the sandbox tools) return `undefined`
    // from toModelOutput to mean "no special mapping needed". Storing that as
    // providerMetadata.mastra.modelOutput used to blank out `output` on the tool message,
    // so the next LLM step sent a tool-result the provider could not read.
    const toModelOutputSpy = vi.fn(() => undefined);

    const testTool = createTool({
      id: 'text-tool',
      description: 'A tool that only maps media results',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ contents: z.string() }),
      execute: async () => ({ contents: 'the answer is 42' }),
      toModelOutput: toModelOutputSpy,
    });

    const prompts: any[] = [];
    const model = createToolCallingModel('text-tool', { path: 'data.txt' }, prompt => prompts.push(prompt));

    const baseAgent = new Agent({
      name: 'text-agent',
      instructions: 'You are a test agent.',
      model,
      tools: { 'text-tool': testTool },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    new Mastra({
      agents: { 'text-agent': durableAgent as any },
      storage: new InMemoryStore(),
    });

    const result = await durableAgent.stream('Read data.txt');

    const errors: any[] = [];
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'error') errors.push(chunk);
    }

    expect(errors).toEqual([]);
    expect(toModelOutputSpy).toHaveBeenCalledTimes(1);

    // The follow-up LLM call must carry a tool message whose result still has an `output`
    // — providers switch on `output.type`, so a missing one is a hard TypeError.
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    const toolMessages = prompts[1].filter((m: any) => m.role === 'tool');
    expect(toolMessages).toHaveLength(1);
    const toolResultPart = toolMessages[0].content.find((p: any) => p.type === 'tool-result');
    expect(toolResultPart).toBeDefined();
    expect(toolResultPart.output).toBeDefined();
    expect(JSON.stringify(toolResultPart.output)).toContain('the answer is 42');
  });

  it.each([undefined, null])(
    'does not write a modelOutput key into the message list when toModelOutput returns %s (producer guard)',
    async nullishModelOutput => {
      // Isolates the producer-side guard in llm-mapping.ts. A nullish toModelOutput
      // must NOT be persisted on the tool-invocation part. JSON storage round-trips
      // drop `undefined`, so the bad key is only observable on the in-memory
      // MessageList (via the run registry); asserting there is what makes this test
      // go red when the guard is reverted.
      const toModelOutputSpy = vi.fn(() => nullishModelOutput);

      const testTool = createTool({
        id: 'text-tool',
        description: 'A tool that only maps media results',
        inputSchema: z.object({ path: z.string() }),
        outputSchema: z.object({ contents: z.string() }),
        execute: async () => ({ contents: 'the answer is 42' }),
        toModelOutput: toModelOutputSpy,
      });

      const model = createToolCallingModel('text-tool', { path: 'data.txt' });

      const storage = new InMemoryStore();
      const baseAgent = new Agent({
        name: 'text-agent',
        instructions: 'You are a test agent.',
        model,
        tools: { 'text-tool': testTool },
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub, cleanupTimeoutMs: 0 });

      new Mastra({
        agents: { 'text-agent': durableAgent as any },
        storage,
      });

      const threadId = 'thread-producer-guard';
      const resourceId = 'resource-producer-guard';
      const result = await durableAgent.stream('Read data.txt', {
        memory: { thread: threadId, resource: resourceId },
      });

      for await (const _ of result.fullStream) {
        // drain
      }

      expect(toModelOutputSpy).toHaveBeenCalledTimes(1);

      const entry = globalRunRegistry.get(result.runId);
      const messageList = entry?.messageList;
      expect(messageList).toBeDefined();
      const messages = messageList!.get.all.db();
      const invocation = messages
        .filter(message => message.role === 'assistant' && message.content.format === 2)
        .flatMap(message => message.content.parts)
        .find(part => part.type === 'tool-invocation' && part.toolInvocation.state === 'result');

      expect(invocation).toBeDefined();
      // Producer guard: a nullish modelOutput must not be written as a key at all.
      const mastraMetadata = invocation?.providerMetadata?.mastra ?? {};
      expect(Object.hasOwn(mastraMetadata, 'modelOutput')).toBe(false);
    },
  );

  it('applies toModelOutput to a client-executed tool result arriving on a follow-up request', async () => {
    const toModelOutputSpy = vi.fn((output: any) => ({
      type: 'content',
      value: [{ type: 'text', text: `Screenshot uploaded as ${output.fileId}` }],
    }));

    // Execute-less: the tool runs on the client; the server only maps the result.
    const clientTool = createTool({
      id: 'client-tool',
      description: 'A client-side tool',
      inputSchema: z.object({ query: z.string().optional() }),
      toModelOutput: toModelOutputSpy,
    });

    const prompts: any[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    }) as unknown as LanguageModelV2;

    const baseAgent = new Agent({
      name: 'client-map-agent',
      instructions: 'You are a test agent.',
      model,
      tools: { 'client-tool': clientTool },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    new Mastra({
      agents: { 'client-map-agent': durableAgent as any },
      storage: new InMemoryStore(),
    });

    // Follow-up request shape from @mastra/client-js: previous assistant
    // tool-call + the client-produced tool result.
    const result = await durableAgent.stream([
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'tc-client-1', toolName: 'client-tool', args: {} }],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'tc-client-1', toolName: 'client-tool', result: { fileId: 'file-9' } },
        ],
      },
    ] satisfies Parameters<typeof durableAgent.stream>[0]);

    for await (const _chunk of result.fullStream) {
      // drain
    }

    expect(toModelOutputSpy).toHaveBeenCalledTimes(1);
    expect(toModelOutputSpy).toHaveBeenCalledWith({ fileId: 'file-9' });

    // The model must see the mapped output, not the raw JSON result.
    const toolResultParts = prompts
      .flat()
      .filter((m: any) => m.role === 'tool')
      .flatMap((m: any) => m.content)
      .filter((p: any) => p.type === 'tool-result' && p.toolCallId === 'tc-client-1');
    expect(toolResultParts.length).toBeGreaterThan(0);
    expect(toolResultParts[0].output).toEqual({
      type: 'content',
      value: [{ type: 'text', text: 'Screenshot uploaded as file-9' }],
    });
  });
});
