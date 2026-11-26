/**
 * End-to-end identity contract: the assistant message emitted over the live
 * stream must carry the same id as its persisted copy. Clients reconcile a
 * live transcript against refetched history by id — two ids for one turn
 * render the turn twice (doubled assistant bubble after an SSE reconnect).
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import type { AgentConfig } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

function createTextStreamModel(responseText: string, identity: { provider?: string; modelId?: string } = {}) {
  return new MockLanguageModelV2({
    ...identity,
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id-2026-01-01', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

function createToolCallModel(identity: { provider: string; modelId: string }) {
  return new MockLanguageModelV2({
    ...identity,
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Looking it up.' },
        { type: 'text-end', id: 'text-1' },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

function createFailingModel(identity: { provider: string; modelId: string }) {
  return new MockLanguageModelV2({
    ...identity,
    doStream: async () => {
      throw new Error('rate limited');
    },
  });
}

function createModelStoppedMidReply(identity: { provider: string; modelId: string }) {
  return new MockLanguageModelV2({
    ...identity,
    doStream: async ({ abortSignal }) => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Half a sent' });
          abortSignal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
        },
      }),
    }),
  });
}

type AgentOverrides = Partial<
  Pick<
    AgentConfig,
    'model' | 'tools' | 'inputProcessors' | 'errorProcessors' | 'errorProcessorDefaults' | 'maxProcessorRetries'
  >
>;
type Engine = 'default' | 'durable';

async function sendOneMessage(
  agentOverrides: AgentOverrides = {},
  engine: Engine = 'default',
  { stopOnFirstUpdate = false }: { stopOnFirstUpdate?: boolean } = {},
) {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    model: createTextStreamModel('Good to hear.'),
    instructions: 'You are a test agent.',
    memory: new MockMemory({ storage }),
    ...agentOverrides,
  });
  const pubsub = new EventEmitterPubSub();
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    pubsub,
    resourceId: 'test-resource',
    modes: [
      {
        id: 'build',
        agent: engine === 'durable' ? createDurableAgent({ agent, cache: new InMemoryServerCache(), pubsub }) : agent,
      },
    ],
    defaultModeId: 'build',
    initialState: { yolo: true },
  });

  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  await controller.getMastra()?.startWorkers();
  await session.thread.create();
  const threadId = session.thread.requireId();

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => {
    events.push(event);
    if (stopOnFirstUpdate && event.type === 'message_update') session.abort();
  });

  await session.sendMessage({ content: 'It seems to work well actually' }).catch(error => {
    if (!stopOnFirstUpdate) throw error;
  });
  if (stopOnFirstUpdate) await vi.waitFor(() => expect(events.some(event => event.type === 'agent_end')).toBe(true));

  const streamedStart = events.find(
    (event): event is Extract<AgentControllerEvent, { type: 'message_start' }> =>
      event.type === 'message_start' && event.message.role === 'assistant',
  );
  const persisted = await session.thread.listMessages({ threadId });
  return { events, streamedStart, persistedAssistant: persisted.filter(message => message.role === 'assistant') };
}

function liveAssistantMetadata(events: AgentControllerEvent[], messageId: string) {
  const start = events.find(
    (event): event is Extract<AgentControllerEvent, { type: 'message_start' }> =>
      event.type === 'message_start' && event.message.id === messageId,
  );
  return start?.message.content.metadata;
}

describe('stream ↔ persisted message identity', () => {
  it('emits the assistant message under the id its persisted copy carries', async () => {
    const { events, streamedStart, persistedAssistant } = await sendOneMessage();

    expect(streamedStart).toBeDefined();
    const streamedEnd = events.find(
      (event): event is Extract<AgentControllerEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.id === streamedStart!.message.id,
    );
    expect(streamedEnd).toMatchObject({ type: 'message_end', id: streamedStart!.message.id });
    expect(persistedAssistant).toHaveLength(1);
    expect(streamedStart!.message.id).toBe(persistedAssistant[0]!.id);
  }, 30000);

  it.each<Engine>(['default', 'durable'])(
    'names the model on the live assistant message the way its persisted copy does (%s engine)',
    async engine => {
      const { streamedStart, persistedAssistant } = await sendOneMessage({}, engine);

      const persistedMetadata = persistedAssistant[0]?.content.metadata;
      expect(persistedMetadata).toMatchObject({ modelId: 'mock-model-id', provider: 'mock-provider' });
      expect(streamedStart?.message.content.metadata).toMatchObject({
        modelId: persistedMetadata?.modelId,
        provider: persistedMetadata?.provider,
      });
    },
    30000,
  );

  it.each<Engine>(['default', 'durable'])(
    'names the model on a reply stopped before its step finishes (%s engine)',
    async engine => {
      const { events, streamedStart } = await sendOneMessage(
        { model: createModelStoppedMidReply({ provider: 'stopped-provider', modelId: 'stopped-model' }) },
        engine,
        { stopOnFirstUpdate: true },
      );

      expect(liveAssistantMetadata(events, streamedStart!.message.id)).toMatchObject({
        modelId: 'stopped-model',
        provider: 'stopped-provider',
      });
    },
    30000,
  );

  it.each<{ engine: Engine; announcesHop: boolean }>([
    { engine: 'default', announcesHop: false },
    { engine: 'durable', announcesHop: false },
    { engine: 'default', announcesHop: true },
    { engine: 'durable', announcesHop: true },
  ])(
    'names the fallback model when the primary fails ($engine engine, hop announced: $announcesHop)',
    async ({ engine, announcesHop }) => {
      const { events, persistedAssistant } = await sendOneMessage(
        {
          errorProcessorDefaults: false,
          errorProcessors: announcesHop
            ? [
                {
                  id: 'announce-hop',
                  processAPIError: async ({ writer }) => {
                    await writer?.custom({ type: 'data-model-fallback', data: { to: 'fallback-model' } });
                    return { retry: false };
                  },
                },
              ]
            : [],
          model: [
            { model: createFailingModel({ provider: 'primary-provider', modelId: 'primary-model' }), maxRetries: 0 },
            {
              model: createTextStreamModel('Good to hear.', {
                provider: 'fallback-provider',
                modelId: 'fallback-model',
              }),
              maxRetries: 0,
            },
          ],
        },
        engine,
      );

      expect(persistedAssistant).toHaveLength(1);
      const reply = persistedAssistant[0]!;
      expect(reply.content.metadata).toMatchObject({ modelId: 'fallback-model', provider: 'fallback-provider' });
      expect(liveAssistantMetadata(events, reply.id)).toMatchObject({
        modelId: 'fallback-model',
        provider: 'fallback-provider',
      });
    },
    30000,
  );

  it('keeps the hop notice in the saved reply when the fallback is retried', async () => {
    let fallbackCalls = 0;
    const fallback = createTextStreamModel('Good to hear.', {
      provider: 'fallback-provider',
      modelId: 'fallback-model',
    });
    const answer = fallback.doStream.bind(fallback);
    fallback.doStream = async options => {
      fallbackCalls++;
      if (fallbackCalls === 1) throw new Error('rate limited');
      return answer(options);
    };
    let apiErrors = 0;
    const { persistedAssistant } = await sendOneMessage({
      errorProcessorDefaults: false,
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'announce-hop-then-retry',
          processAPIError: async ({ writer }) => {
            apiErrors++;
            if (apiErrors > 1) return { retry: true };
            await writer?.custom({ type: 'data-model-fallback', data: { to: 'fallback-model' } });
            return { retry: false };
          },
        },
      ],
      model: [
        { model: createFailingModel({ provider: 'primary-provider', modelId: 'primary-model' }), maxRetries: 0 },
        { model: fallback, maxRetries: 0 },
      ],
    });

    expect(fallbackCalls).toBe(2);
    expect(persistedAssistant).toHaveLength(1);
    expect(persistedAssistant[0]!.content.parts.filter(part => part.type !== 'step-start')).toEqual([
      expect.objectContaining({ type: 'data-model-fallback', data: { to: 'fallback-model' } }),
      expect.objectContaining({ type: 'text', text: 'Good to hear.' }),
    ]);
  }, 30000);

  it('keeps the hop notice in place, live and saved, when a later step retries the fallback', async () => {
    let primaryCalls = 0;
    const primary = createToolCallModel({ provider: 'primary-provider', modelId: 'primary-model' });
    const callTool = primary.doStream.bind(primary);
    primary.doStream = async options => {
      primaryCalls++;
      if (primaryCalls > 1) throw new Error('rate limited');
      return callTool(options);
    };
    let fallbackCalls = 0;
    const fallback = createTextStreamModel('Good to hear.', {
      provider: 'fallback-provider',
      modelId: 'fallback-model',
    });
    const answer = fallback.doStream.bind(fallback);
    fallback.doStream = async options => {
      fallbackCalls++;
      if (fallbackCalls === 1) throw new Error('rate limited');
      return answer(options);
    };
    const hop = { type: 'data-mastracode-model-fallback' as const, data: { to: 'fallback-model' } };
    let apiErrors = 0;
    const { events, persistedAssistant } = await sendOneMessage({
      errorProcessorDefaults: false,
      maxProcessorRetries: 1,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look it up',
          inputSchema: z.object({}),
          execute: async () => 'found',
        }),
      },
      errorProcessors: [
        {
          id: 'announce-hop-then-retry',
          processAPIError: async ({ writer }) => {
            apiErrors++;
            if (apiErrors > 1) return { retry: true };
            await writer?.custom(hop);
            return { retry: false };
          },
        },
      ],
      model: [
        { model: primary, maxRetries: 0 },
        { model: fallback, maxRetries: 0 },
      ],
    });

    expect(fallbackCalls).toBe(2);
    expect(persistedAssistant).toHaveLength(1);
    const reply = persistedAssistant[0]!;
    expect(reply.content.parts.filter(part => part.type !== 'step-start')).toEqual([
      expect.objectContaining({ type: 'text', text: 'Looking it up.' }),
      expect.objectContaining({ type: 'tool-invocation' }),
      expect.objectContaining(hop),
      expect.objectContaining({ type: 'text', text: 'Good to hear.' }),
    ]);
    const liveHops = events.filter(
      event => event.type === 'message_update' && event.event.type === 'part' && event.event.part.type === hop.type,
    );
    expect(liveHops).toEqual([
      expect.objectContaining({
        id: reply.id,
        event: expect.objectContaining({ index: reply.content.parts.findIndex(part => part.type === hop.type) }),
      }),
    ]);
  }, 30000);
});
