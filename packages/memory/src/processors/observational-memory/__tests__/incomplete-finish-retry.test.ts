/**
 * OM observer/reflector calls must not keep a reply whose stream closed early.
 *
 * Providers report an early close as finishReason 'other' (Gemini) or
 * 'unknown'. The agent loop treats those as non-terminal, so without a guard it
 * runs a second step over the partial reply and OM saves both replies stitched
 * together. OM should instead retry the whole call and keep only a complete
 * reply.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Extractor } from '../extractor';
import { ObserverRunner } from '../observer-runner';
import { ReflectorRunner } from '../reflector-runner';
import { RETRY_CONFIG } from '../retry';

type Reply = { text: string; finishReason: 'stop' | 'other' | 'unknown' };

function createScriptedModel(replies: Reply[]) {
  const prompts: string[][] = [];
  const assistantTexts: string[][] = [];
  const model = new MockLanguageModelV2({
    provider: 'google.vertex.chat',
    modelId: 'gemini-3.5-flash-lite',
    doStream: async ({ prompt }: any) => {
      const reply = replies[Math.min(prompts.length, replies.length - 1)]!;
      prompts.push(prompt.map((message: any) => message.role));
      assistantTexts.push(
        prompt
          .filter((message: any) => message.role === 'assistant')
          .flatMap((message: any) => message.content.map((part: any) => part.text ?? '')),
      );
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            if (reply.text) {
              controller.enqueue({ type: 'text-start', id: '1' });
              controller.enqueue({ type: 'text-delta', id: '1', delta: reply.text });
              controller.enqueue({ type: 'text-end', id: '1' });
            }
            controller.enqueue({
              type: 'finish',
              finishReason: reply.finishReason,
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        warnings: [],
      };
    },
  });
  return { model, prompts, assistantTexts };
}

function createMessage(text: string, role: 'user' | 'assistant', threadId = 'thread-1'): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    threadId,
    resourceId: 'resource-1',
    content: { format: 2, parts: [{ type: 'text', text }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
  };
}

function createObserverRunner(model: MockLanguageModelV2, extractors: Extractor<any>[] = []) {
  return new ObserverRunner({
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
      bufferTokens: false,
      previousObserverTokens: 1000,
      observeAttachments: false,
      extractors,
    } as any,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: model as any }),
    tokenCounter: { countMessages: () => 1 } as any,
  });
}

function createReflectorRunner(model: MockLanguageModelV2, extractors: Extractor<any>[] = []) {
  return new ReflectorRunner({
    reflectionConfig: { model: 'mock/model', observationTokens: 1000, extractors } as any,
    observationConfig: { model: 'mock/model', messageTokens: 1000 } as any,
    tokenCounter: { countObservations: (text: string) => text?.length ?? 0 } as any,
    storage: {} as any,
    scope: 'thread',
    buffering: {} as any,
    emitDebugEvent: vi.fn(),
    persistMarkerToStorage: vi.fn(),
    persistMarkerToMessage: vi.fn(),
    getCompressionStartLevel: async () => 0,
    resolveModel: () => ({ model: model as any }),
  });
}

const FULL_OBSERVATION = '* User uploaded the pile plan. 46 piles confirmed.';
const FULL_REPLY = `<observations>\n${FULL_OBSERVATION}\n</observations>`;
const PARTIAL_REPLY = FULL_REPLY.slice(0, 40);

const MULTI_THREAD_OBSERVATION = '* User asked for the pile count.';
const MULTI_THREAD_FULL_REPLY = `<observations>\n<thread id="thread-1">\n${MULTI_THREAD_OBSERVATION}\n</thread>\n</observations>`;
const MULTI_THREAD_PARTIAL_REPLY = MULTI_THREAD_FULL_REPLY.slice(0, 50);

describe('OM retries replies that end without a stop reason', () => {
  const originalConfig = { ...RETRY_CONFIG };

  beforeEach(() => {
    RETRY_CONFIG.initialDelayMs = 1;
    RETRY_CONFIG.maxDelayMs = 4;
    RETRY_CONFIG.jitter = 0;
  });

  afterEach(() => {
    Object.assign(RETRY_CONFIG, originalConfig);
  });

  for (const finishReason of ['other', 'unknown'] as const) {
    it(`observer retries a partial reply that ended with '${finishReason}'`, async () => {
      const { model, prompts } = createScriptedModel([
        { text: PARTIAL_REPLY, finishReason },
        { text: FULL_REPLY, finishReason: 'stop' },
      ]);
      const runner = createObserverRunner(model);

      const result = await runner.call(undefined, [
        createMessage('Add the pile plan.', 'user'),
        createMessage('Done, 46 piles.', 'assistant'),
      ]);

      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toEqual(prompts[0]);
      expect(prompts.flat()).not.toContain('assistant');
      expect(result.observations.trim()).toBe(FULL_OBSERVATION);
    });
  }

  it('observer retries a stream that closed with no output', async () => {
    const { model, prompts } = createScriptedModel([
      { text: '', finishReason: 'other' },
      { text: FULL_REPLY, finishReason: 'stop' },
    ]);
    const runner = createObserverRunner(model);

    const result = await runner.call(undefined, [createMessage('Add the pile plan.', 'user')]);

    expect(prompts).toHaveLength(2);
    expect(result.observations.trim()).toBe(FULL_OBSERVATION);
  });

  it('multi-thread observer retries a partial reply', async () => {
    const { model, prompts } = createScriptedModel([
      { text: MULTI_THREAD_PARTIAL_REPLY, finishReason: 'other' },
      { text: MULTI_THREAD_FULL_REPLY, finishReason: 'stop' },
    ]);
    const runner = createObserverRunner(model);

    const { results } = await runner.callMultiThread(
      undefined,
      new Map([['thread-1', [createMessage('How many piles?', 'user')]]]),
      ['thread-1'],
    );

    expect(prompts).toHaveLength(2);
    expect(prompts.flat()).not.toContain('assistant');
    expect(results.get('thread-1')?.observations.trim()).toBe(MULTI_THREAD_OBSERVATION);
  });

  it('reflector retries a partial reply', async () => {
    const { model, prompts } = createScriptedModel([
      { text: PARTIAL_REPLY, finishReason: 'other' },
      { text: FULL_REPLY, finishReason: 'stop' },
    ]);
    const runner = createReflectorRunner(model);

    const result = await runner.call(`${FULL_OBSERVATION}\n* Older detail that can be dropped.`);

    expect(prompts).toHaveLength(2);
    expect(prompts.flat()).not.toContain('assistant');
    expect(result.observations.trim()).toBe(FULL_OBSERVATION);
  });

  describe('with a structured extractor', () => {
    const moodExtractor = () =>
      new Extractor({
        name: 'mood',
        instructions: 'The user mood.',
        schema: z.object({ mood: z.string() }),
        metadataKeyPath: false,
      });
    const EXTRACTION_REPLY: Reply = { text: JSON.stringify({ mood: { mood: 'calm' } }), finishReason: 'stop' };

    it('observer retry starts from an empty thread and extraction sees only the complete reply', async () => {
      const { model, prompts, assistantTexts } = createScriptedModel([
        { text: PARTIAL_REPLY, finishReason: 'other' },
        { text: FULL_REPLY, finishReason: 'stop' },
        EXTRACTION_REPLY,
      ]);
      const runner = createObserverRunner(model, [moodExtractor()]);

      const result = await runner.call(undefined, [createMessage('Add the pile plan.', 'user')]);

      expect(prompts).toHaveLength(3);
      expect(prompts[1]).toEqual(prompts[0]);
      expect(assistantTexts[1]).toEqual([]);
      expect(assistantTexts[2]).toEqual([FULL_REPLY]);
      expect(result.observations.trim()).toBe(FULL_OBSERVATION);
      expect(result.extractedValues).toMatchObject({ mood: { mood: 'calm' } });
    });

    it('reflector retry starts from an empty thread and extraction sees only the complete reply', async () => {
      const { model, prompts, assistantTexts } = createScriptedModel([
        { text: PARTIAL_REPLY, finishReason: 'other' },
        { text: FULL_REPLY, finishReason: 'stop' },
        EXTRACTION_REPLY,
      ]);
      const runner = createReflectorRunner(model, [moodExtractor()]);

      const result = await runner.call(`${FULL_OBSERVATION}\n* Older detail that can be dropped.`);

      expect(prompts).toHaveLength(3);
      expect(prompts[1]).toEqual(prompts[0]);
      expect(assistantTexts[1]).toEqual([]);
      expect(assistantTexts[2]).toEqual([FULL_REPLY]);
      expect(result.observations.trim()).toBe(FULL_OBSERVATION);
      expect(result.extractedValues).toMatchObject({ mood: { mood: 'calm' } });
    });
  });
});
