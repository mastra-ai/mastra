/**
 * summarizeConversation() / Memory.summarizeThread() tests
 *
 * Standalone one-shot summarization that reuses the Observer + extractor
 * plumbing without an ObservationalMemory instance or any storage writes.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../..';
import { Extractor } from '../extractor';
import { summarizeConversation } from '../summarize';

function createTestMessage(
  content: string,
  role: 'user' | 'assistant' = 'user',
  extra?: Partial<MastraDBMessage>,
): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: { format: 2, parts: [{ type: 'text', text: content }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
    ...extra,
  };
}

/** Mock model: doStream serves the summarizer output, doGenerate serves the structured-extraction follow-up. */
function createMockSummarizerModel(streamText: string, generateObjectJson?: string, onDoStream?: (args: any) => void) {
  const doStream = vi.fn(async (args: any) => {
    onDoStream?.(args);
    return {
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sum-1', modelId: 'mock-summarizer', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: streamText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop' as const,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  });
  const doGenerate = vi.fn(async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
    warnings: [],
    content: [{ type: 'text' as const, text: generateObjectJson ?? '{}' }],
  }));
  const model = new MockLanguageModelV2({ doStream, doGenerate } as any);
  return { model, doStream, doGenerate };
}

const OBSERVATION_OUTPUT = `<observations>
* Caller asked about roof inspection pricing
* Caller lives in the 94103 zip code
</observations>`;

describe('summarizeConversation()', () => {
  it('returns the distilled summary from the conversation', async () => {
    const { model } = createMockSummarizerModel(OBSERVATION_OUTPUT);
    const messages = [
      createTestMessage('Hi, how much is a roof inspection?'),
      createTestMessage('It depends on the roof — can I get your zip code?', 'assistant'),
      createTestMessage('94103'),
    ];

    const result = await summarizeConversation({ model: model as any, messages });

    expect(result.summary).toContain('roof inspection');
    expect(result.summary).toContain('94103');
    expect(result.extracted).toEqual({});
    expect(result.usage?.totalTokens).toBe(150);
  });

  it('appends custom instructions to the summarizer system prompt', async () => {
    let systemText = '';
    const { model } = createMockSummarizerModel(OBSERVATION_OUTPUT, undefined, ({ prompt }: any) => {
      const systemMessage = prompt.find((message: any) => message.role === 'system');
      systemText = typeof systemMessage?.content === 'string' ? systemMessage.content : '';
    });

    await summarizeConversation({
      model: model as any,
      messages: [createTestMessage('Hello')],
      instructions: 'Summarize this voicemail call for the business owner.',
    });

    expect(systemText).toContain('Summarize this voicemail call for the business owner.');
  });

  it('runs inline extractors and fires onExtracted with the conversation identity', async () => {
    const onExtracted = vi.fn(async () => undefined);
    const { model } = createMockSummarizerModel(`${OBSERVATION_OUTPUT}\n<call-sentiment>positive</call-sentiment>`);

    const result = await summarizeConversation({
      model: model as any,
      messages: [createTestMessage('Hello', 'user', { threadId: 'call-1', resourceId: 'caller-1' })],
      extract: [
        new Extractor({
          name: 'Call sentiment',
          instructions: 'Rate the caller sentiment.',
          metadataKeyPath: false,
          onExtracted,
        }),
      ],
    });

    expect(result.extracted).toEqual({ 'call-sentiment': 'positive' });
    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({ current: 'positive', threadId: 'call-1', resourceId: 'caller-1' }),
    );
  });

  it('runs structured extractors through the follow-up extraction call', async () => {
    const { model, doGenerate } = createMockSummarizerModel(
      OBSERVATION_OUTPUT,
      JSON.stringify({ 'call-summary': { summary: 'Caller asked about pricing.', sentiment: 'positive' } }),
    );

    const result = await summarizeConversation({
      model: model as any,
      messages: [createTestMessage('Hello', 'user', { threadId: 'call-1' })],
      extract: [
        new Extractor({
          name: 'Call summary',
          instructions: 'Return a concise summary of the call.',
          schema: z.object({ summary: z.string(), sentiment: z.enum(['positive', 'neutral', 'negative']) }),
          metadataKeyPath: false,
        }),
      ],
    });

    expect(doGenerate).toHaveBeenCalled();
    expect(result.extracted['call-summary']).toEqual({
      summary: 'Caller asked about pricing.',
      sentiment: 'positive',
    });
  });

  it('surfaces failed extractor output in extractionFailures', async () => {
    const onExtracted = vi.fn(async () => undefined);
    // `summary` must be a string — a numeric value fails the extractor's schema.
    const { model } = createMockSummarizerModel(
      OBSERVATION_OUTPUT,
      JSON.stringify({ 'call-summary': { summary: 123, sentiment: 'positive' } }),
    );

    const result = await summarizeConversation({
      model: model as any,
      messages: [createTestMessage('Hello', 'user', { threadId: 'call-1' })],
      extract: [
        new Extractor({
          name: 'Call summary',
          instructions: 'Return a concise summary of the call.',
          schema: z.object({ summary: z.string(), sentiment: z.enum(['positive', 'neutral', 'negative']) }),
          metadataKeyPath: false,
          onExtracted,
        }),
      ],
    });

    expect(result.extracted).toEqual({});
    expect(result.extractionFailures).toHaveLength(1);
    expect(result.extractionFailures?.[0]?.slug).toBe('call-summary');
    expect(result.extractionFailures?.[0]?.error).toBeTruthy();
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it('returns an empty result without calling the model when there are no messages', async () => {
    const { model, doStream, doGenerate } = createMockSummarizerModel(OBSERVATION_OUTPUT);

    const result = await summarizeConversation({ model: model as any, messages: [] });

    expect(result).toEqual({ summary: '', extracted: {} });
    expect(doStream).not.toHaveBeenCalled();
    expect(doGenerate).not.toHaveBeenCalled();
  });
});

describe('Memory.summarizeThread()', () => {
  /** Seed a memory instance with one thread whose messages carry the given texts, in order. */
  async function createThreadWithMessages(texts: string[]) {
    const memory = new Memory({ storage: new InMemoryStore() });
    const threadId = 'call-thread';
    const resourceId = 'caller-42';

    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Call',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const base = Date.now();
    await memory.saveMessages({
      messages: texts.map((text, index) =>
        createTestMessage(text, index % 2 === 0 ? 'user' : 'assistant', {
          threadId,
          resourceId,
          createdAt: new Date(base + index * 1000),
        }),
      ),
    });
    return { memory, threadId, resourceId };
  }

  /** Capture every summarizer prompt as one searchable string. */
  function createPromptCapturingModel() {
    const prompts: string[] = [];
    const { model } = createMockSummarizerModel(OBSERVATION_OUTPUT, undefined, (args: any) =>
      prompts.push(JSON.stringify(args.prompt)),
    );
    return { model, promptText: () => prompts.join('\n') };
  }

  it('loads the thread messages from storage and summarizes them', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const threadId = 'call-thread';
    const resourceId = 'caller-42';

    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Call',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await memory.saveMessages({
      messages: [
        createTestMessage('How much is a roof inspection?', 'user', { threadId, resourceId }),
        createTestMessage('Depends on the roof.', 'assistant', { threadId, resourceId }),
      ],
    });

    const { model, doStream } = createMockSummarizerModel(OBSERVATION_OUTPUT);
    const result = await memory.summarizeThread({
      model: model as any,
      threadId,
      resourceId,
      instructions: 'Summarize the call.',
    });

    expect(doStream).toHaveBeenCalled();
    expect(result.summary).toContain('roof inspection');
  });

  it('only summarizes the last N messages when lastMessages is set', async () => {
    const { memory, threadId, resourceId } = await createThreadWithMessages([
      'marker-one',
      'marker-two',
      'marker-three',
      'marker-four',
      'marker-five',
    ]);
    const { model, promptText } = createPromptCapturingModel();

    await memory.summarizeThread({ model: model as any, threadId, resourceId, lastMessages: 2 });

    expect(promptText()).toContain('marker-four');
    expect(promptText()).toContain('marker-five');
    expect(promptText()).not.toContain('marker-one');
    expect(promptText()).not.toContain('marker-two');
    expect(promptText()).not.toContain('marker-three');
  });

  it('stops loading older messages once maxInputTokens is crossed, always keeping the newest', async () => {
    const { memory, threadId, resourceId } = await createThreadWithMessages([
      `marker-old ${'lorem '.repeat(200)}`,
      `marker-new ${'ipsum '.repeat(200)}`,
    ]);
    const { model, promptText } = createPromptCapturingModel();

    await memory.summarizeThread({ model: model as any, threadId, resourceId, maxInputTokens: 10 });

    expect(promptText()).toContain('marker-new');
    expect(promptText()).not.toContain('marker-old');
  });

  it('stops paging through storage when the abort signal fires during loading', async () => {
    const texts = Array.from({ length: 120 }, (_, index) => `marker-${index + 1}`);
    const { memory, threadId, resourceId } = await createThreadWithMessages(texts);
    const { model, doStream } = createMockSummarizerModel(OBSERVATION_OUTPUT);

    const controller = new AbortController();
    const originalRecall = memory.recall.bind(memory);
    const recallSpy = vi.spyOn(memory, 'recall').mockImplementation(async args => {
      const result = await originalRecall(args);
      controller.abort();
      return result;
    });

    await expect(
      memory.summarizeThread({ model: model as any, threadId, resourceId, abortSignal: controller.signal }),
    ).rejects.toThrow();

    expect(recallSpy).toHaveBeenCalledTimes(1);
    expect(doStream).not.toHaveBeenCalled();
  });

  it('paginates across storage pages and preserves chronological order', async () => {
    const texts = Array.from({ length: 120 }, (_, index) => `marker-${String(index + 1).padStart(3, '0')}`);
    const { memory, threadId, resourceId } = await createThreadWithMessages(texts);
    const { model, promptText } = createPromptCapturingModel();

    await memory.summarizeThread({ model: model as any, threadId, resourceId });

    const text = promptText();
    expect(text).toContain('marker-001');
    expect(text).toContain('marker-120');
    expect(text.indexOf('marker-001')).toBeLessThan(text.indexOf('marker-120'));
  });
});
