import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Extractor } from '../extractor';
import { ObserverRunner } from '../observer-runner';

type Reply =
  | { text: string; finishReason: 'stop' | 'other' | 'unknown' }
  // A transient provider failure, before any output or after partial text.
  | { text: string; error: 'before-output' | 'mid-stream' };

const transientProviderError = () =>
  Object.assign(new Error('Internal server error'), { statusCode: 500, isRetryable: true });

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
      if ('error' in reply && reply.error === 'before-output') throw transientProviderError();
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
            if ('error' in reply) {
              controller.enqueue({ type: 'error', error: transientProviderError() });
            } else {
              controller.enqueue({
                type: 'finish',
                finishReason: reply.finishReason,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
            }
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

function withLogger(warn: ReturnType<typeof vi.fn>) {
  const mastra = new Mastra({ logger: false });
  vi.spyOn(mastra.getLogger(), 'warn').mockImplementation(warn);
  return mastra;
}

function createRunner(model: MockLanguageModelV2, extractors: Extractor<any>[], warn: ReturnType<typeof vi.fn>) {
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
    mastra: withLogger(warn),
  });
}

const REPLY = '<observations>\n* User likes tea.\n</observations>';

describe('observer logs missing required sections', () => {
  it('warns with the slugs of required sections the observer left out', async () => {
    const { model } = createScriptedModel([{ text: REPLY, finishReason: 'stop' }]);
    const warn = vi.fn();
    const mood = new Extractor({ name: 'Mood', instructions: 'Describe the mood.', required: true });
    const topic = new Extractor({ name: 'Topic', instructions: 'Name the topic.' });

    const result = await createRunner(model, [mood, topic], warn).call(undefined, [createMessage('Hi', 'user')]);

    expect(result.extractionFailures?.map(f => f.slug)).toEqual(['mood']);
    expect(warn).toHaveBeenCalledWith(
      'OM observer output is missing required sections',
      expect.objectContaining({ missingSlugs: ['mood'], threadId: 'thread-1' }),
    );
  });

  it('does not warn when the required section is present', async () => {
    const { model } = createScriptedModel([{ text: `${REPLY}\n<mood>UNCHANGED</mood>`, finishReason: 'stop' }]);
    const warn = vi.fn();
    const mood = new Extractor({ name: 'Mood', instructions: 'Describe the mood.', required: true });

    await createRunner(model, [mood], warn).call(undefined, [createMessage('Hi', 'user')]);

    expect(warn).not.toHaveBeenCalledWith('OM observer output is missing required sections', expect.anything());
  });
});
