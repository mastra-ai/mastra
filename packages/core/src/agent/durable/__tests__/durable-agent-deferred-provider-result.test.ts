/**
 * DurableAgent deferred provider-executed tool result tests (#14282 parity port).
 *
 * When a provider-executed tool (e.g. Anthropic web_search) is called alongside
 * a client tool, the provider may defer the result: the tool-call arrives in
 * step N's stream but the tool-result only arrives in step N+1's stream. The
 * tool-call step's passthrough gate skips client execution for provider tools,
 * so without the llm-execution patch the invocation stays `state:'call'`
 * forever and the real result never reaches durable thread history.
 *
 * These tests pin the ported behavior:
 * 1. the deferred result is patched onto the existing call part,
 * 2. `processToolResult` runs BEFORE the raw result is emitted or persisted
 *    (post-processor mutations reach both the stream and history), and
 * 3. a processor tripwire blocks the raw result entirely and bails the run.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const PROVIDER_CALL_ID = 'tc-provider-1';
const CLIENT_CALL_ID = 'tc-client-1';

/**
 * Step 1: provider-executed `web_search` call (result deferred) + client
 * `getWeather` call, finishReason 'tool-calls'.
 * Step 2: the deferred provider tool-result + text, finishReason 'stop'.
 */
function createDeferredProviderModel(deferredResult: Record<string, unknown>) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallId: PROVIDER_CALL_ID,
              toolName: 'web_search',
              input: JSON.stringify({ query: 'mastra' }),
              providerExecuted: true,
            },
            {
              type: 'tool-call' as const,
              toolCallId: CLIENT_CALL_ID,
              toolName: 'getWeather',
              input: JSON.stringify({ city: 'NYC' }),
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
          {
            type: 'tool-result' as const,
            toolCallId: PROVIDER_CALL_ID,
            toolName: 'web_search',
            result: deferredResult,
            providerExecuted: true,
          },
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
  });
}

const weatherTool = createTool({
  id: 'getWeather',
  description: 'Get weather',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temp: z.number() }),
  execute: async () => ({ temp: 72 }),
});

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

/** Recursively collect every object carrying the given toolCallId. */
function findInvocations(value: unknown, toolCallId: string, found: any[] = []): any[] {
  if (Array.isArray(value)) {
    for (const item of value) findInvocations(item, toolCallId, found);
  } else if (value && typeof value === 'object') {
    if ((value as any).toolCallId === toolCallId) found.push(value);
    for (const key of Object.keys(value)) findInvocations((value as any)[key], toolCallId, found);
  }
  return found;
}

interface SetupOptions {
  deferredResult: Record<string, unknown>;
  outputProcessors?: any[];
}

function setup(pubsub: EventEmitterPubSub, { deferredResult, outputProcessors }: SetupOptions) {
  const mockMemory = new MockMemory();
  const baseAgent = new Agent({
    id: 'deferred-provider-agent',
    name: 'Deferred Provider Agent',
    instructions: 'You are a helpful agent.',
    model: createDeferredProviderModel(deferredResult) as LanguageModelV2,
    memory: mockMemory,
    tools: { getWeather: weatherTool },
    ...(outputProcessors ? { outputProcessors } : {}),
  });
  const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
  new Mastra({
    agents: { 'deferred-provider-agent': durableAgent as any },
    logger: false,
    storage: new InMemoryStore(),
    pubsub,
  });
  return { mockMemory, durableAgent };
}

describe('DurableAgent deferred provider-executed tool results (#14282)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('patches a deferred provider-executed tool result into thread history', async () => {
    const { mockMemory, durableAgent } = setup(pubsub, {
      deferredResult: { hits: 3, source: 'deferred-search' },
    });

    const result = await durableAgent.stream('search and check weather', {
      memory: { thread: 'thread-deferred-1', resource: 'resource-deferred-1' },
    });
    const chunks = await drain(result.fullStream);

    // The deferred result streams to the client.
    const streamedResult = chunks.find(
      (c: any) => c.type === 'tool-result' && c.payload?.toolCallId === PROVIDER_CALL_ID,
    );
    expect(streamedResult?.payload?.result).toEqual({ hits: 3, source: 'deferred-search' });

    // And it lands in thread history as state:'result' — before the port the
    // invocation stayed 'call' forever (passthrough gate skips client
    // execution, llm-mapping skips provider-executed commits).
    const recalled = await mockMemory.recall({
      threadId: 'thread-deferred-1',
      resourceId: 'resource-deferred-1',
    });
    const invocations = findInvocations(recalled.messages, PROVIDER_CALL_ID);
    expect(invocations.length).toBeGreaterThan(0);
    expect(invocations.some((inv: any) => inv.state === 'result')).toBe(true);
    expect(JSON.stringify(recalled.messages)).toContain('deferred-search');
    result.cleanup();
  });

  it('runs processToolResult on the deferred result before emission and persistence', async () => {
    const seen: Array<{ toolCallId: string; result: unknown; providerExecuted?: boolean }> = [];
    const redactingProcessor = {
      id: 'deferred-redactor',
      name: 'Deferred Redactor',
      processToolResult: async ({ toolCallId, toolName, args, result, providerExecuted, messageList }: any) => {
        seen.push({ toolCallId, result, providerExecuted });
        if (toolCallId === PROVIDER_CALL_ID) {
          messageList.updateToolInvocation({
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId, toolName, args, result: { hits: 3, source: 'REDACTED' } },
            providerExecuted: true,
          });
        }
      },
    };

    const { mockMemory, durableAgent } = setup(pubsub, {
      deferredResult: { hits: 3, source: 'SECRET-SOURCE' },
      outputProcessors: [redactingProcessor],
    });

    const result = await durableAgent.stream('search and check weather', {
      memory: { thread: 'thread-deferred-2', resource: 'resource-deferred-2' },
    });
    const chunks = await drain(result.fullStream);

    // The processor saw the raw deferred provider result.
    const providerCall = seen.find(s => s.toolCallId === PROVIDER_CALL_ID);
    expect(providerCall).toBeDefined();
    expect(providerCall?.result).toEqual({ hits: 3, source: 'SECRET-SOURCE' });
    expect(providerCall?.providerExecuted).toBe(true);

    // The hook ran pre-emission: the streamed chunk carries the redacted
    // value and the raw value never reaches the client.
    const streamedResult = chunks.find(
      (c: any) => c.type === 'tool-result' && c.payload?.toolCallId === PROVIDER_CALL_ID,
    );
    expect(streamedResult?.payload?.result).toEqual({ hits: 3, source: 'REDACTED' });
    expect(JSON.stringify(chunks)).not.toContain('SECRET-SOURCE');

    // And pre-persistence: history carries the redacted value only.
    const recalled = await mockMemory.recall({
      threadId: 'thread-deferred-2',
      resourceId: 'resource-deferred-2',
    });
    const serialized = JSON.stringify(recalled.messages);
    expect(serialized).toContain('REDACTED');
    expect(serialized).not.toContain('SECRET-SOURCE');
    result.cleanup();
  });

  it('blocks the raw deferred result when processToolResult trips the wire', async () => {
    const blockingProcessor = {
      id: 'deferred-blocker',
      name: 'Deferred Blocker',
      processToolResult: async ({ toolCallId, providerExecuted, abort }: any) => {
        if (toolCallId === PROVIDER_CALL_ID && providerExecuted) {
          abort('blocked deferred provider result');
        }
      },
    };

    const { mockMemory, durableAgent } = setup(pubsub, {
      deferredResult: { hits: 3, source: 'SECRET-SOURCE' },
      outputProcessors: [blockingProcessor],
    });

    const result = await durableAgent.stream('search and check weather', {
      memory: { thread: 'thread-deferred-3', resource: 'resource-deferred-3' },
    });
    const chunks = await drain(result.fullStream);

    // The run bails through the tripwire path and the raw result is never
    // emitted to the client.
    expect(chunks.some((c: any) => c.type === 'tripwire')).toBe(true);
    expect(chunks.some((c: any) => c.type === 'tool-result' && c.payload?.toolCallId === PROVIDER_CALL_ID)).toBe(false);
    expect(JSON.stringify(chunks)).not.toContain('SECRET-SOURCE');

    // Nor is it persisted to thread history.
    const recalled = await mockMemory.recall({
      threadId: 'thread-deferred-3',
      resourceId: 'resource-deferred-3',
    });
    expect(JSON.stringify(recalled.messages)).not.toContain('SECRET-SOURCE');
    result.cleanup();
  });
});
