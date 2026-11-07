import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyExtractorHooks } from '../extracted-values';
import { Extractor } from '../extractor';
import { ObservationalMemory } from '../observational-memory';
import * as observerAgent from '../observer-agent';

let formatSpy: ReturnType<typeof vi.spyOn>;

function observationTextFor(scope: 'thread' | 'resource') {
  return scope === 'resource'
    ? `<observations>
<thread id="thread-a">
* User discussed history rendering
<current-task>
- Primary: Testing
</current-task>
</thread>
</observations>`
    : `<observations>
* User discussed history rendering
</observations>
<current-task>
- Primary: Testing
</current-task>`;
}

function createObserverModel(scope: 'thread' | 'resource') {
  const observationText = observationTextFor(scope);
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      warnings: [],
      content: [{ type: 'text', text: observationText }],
    }),
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: observationText });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createMessages(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: { format: 2, parts: [{ type: 'text', text: `Message ${i}: `.padEnd(200, 'x') }] },
    type: 'text',
    createdAt: new Date(Date.now() - (count - i) * 1000),
  })) as MastraDBMessage[];
}

function createOm(scope: 'thread' | 'resource', extractors?: Extractor<any>[]) {
  return new ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope,
    observation: { model: createObserverModel(scope), messageTokens: 100, bufferTokens: false, extract: extractors },
    reflection: { model: createObserverModel(scope), observationTokens: 50_000 },
  });
}

describe('rendering recent history for observer hooks', () => {
  beforeEach(() => {
    formatSpy = vi.spyOn(observerAgent, 'formatMessagesForObserver');
  });

  afterEach(() => {
    formatSpy.mockRestore();
  });

  for (const scope of ['thread', 'resource'] as const) {
    it(`does not render recent messages when nothing consumes them (${scope} scope)`, async () => {
      const om = createOm(scope);
      const result = await om.observe({ threadId: 'thread-a', resourceId: 'res-a', messages: createMessages(10) });

      expect(result.observed).toBe(true);
      expect(formatSpy).not.toHaveBeenCalled();
    });

    it(`renders recent messages once for an onExtracted hook and passes them through (${scope} scope)`, async () => {
      const seen: Array<string | undefined> = [];
      const extractor = new Extractor({
        name: 'Recorder',
        mode: 'hook',
        onExtracted: ({ recentMessages }) => {
          seen.push(recentMessages);
        },
      });
      const om = createOm(scope, [extractor]);
      const result = await om.observe({ threadId: 'thread-a', resourceId: 'res-a', messages: createMessages(10) });

      expect(result.observed).toBe(true);
      expect(formatSpy).toHaveBeenCalledTimes(1);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toContain('Message 0');
    });
  }
});

describe('applyExtractorHooks recentMessages', () => {
  it('evaluates a deferred recentMessages once for all hooks and never when there are none', async () => {
    const recentMessages = vi.fn(() => 'rendered history');
    const received: Array<string | undefined> = [];
    const hook = (name: string) =>
      new Extractor({
        name,
        mode: 'hook',
        onExtracted: ({ recentMessages }) => {
          received.push(recentMessages);
        },
      });

    await applyExtractorHooks({
      source: 'observer',
      extractors: [hook('First'), hook('Second')],
      rawObservations: '* obs',
      recentMessages,
      threadId: 'thread-a',
    });

    expect(recentMessages).toHaveBeenCalledTimes(1);
    expect(received).toEqual(['rendered history', 'rendered history']);

    const unused = vi.fn(() => 'never');
    await applyExtractorHooks({
      source: 'observer',
      extractors: [],
      rawObservations: '* obs',
      recentMessages: unused,
      threadId: 'thread-a',
    });
    expect(unused).not.toHaveBeenCalled();
  });
});
