import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../mastra';
import type { ModelManagerModelConfig } from '../stream/types';
import { loop } from './loop';
import {
  createMessageListWithUserMessage,
  createTestMastra,
  createTestModels,
  defaultSettings,
  mockDate,
  testUsage,
} from './test-utils/utils';
import { isMastraTimeoutError } from './timeout';

const hangingModel = (id: string): ModelManagerModelConfig => ({
  id,
  maxRetries: 0,
  model: new MockLanguageModelV2({
    doStream: () => new Promise(() => {}),
    doGenerate: () => new Promise(() => {}),
  }),
});

const respondingModel = (id: string, text: string): ModelManagerModelConfig => ({
  id,
  maxRetries: 0,
  model: new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: testUsage },
      ]),
    }),
  }),
});

describe('modelSettings.timeout.totalMs', () => {
  const mastraRef: { current?: Mastra } = {};
  let dispose: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(mockDate);
    const created = await createTestMastra();
    mastraRef.current = created.mastra;
    dispose = created.dispose;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await dispose?.();
    mastraRef.current = undefined;
    dispose = undefined;
  });

  const runLoop = async ({
    models,
    totalMs,
    abortSignal,
  }: {
    models: ModelManagerModelConfig[];
    totalMs?: number;
    abortSignal?: AbortSignal;
  }) => {
    const settings = defaultSettings();
    const result = loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'test-run-id',
      messageList: createMessageListWithUserMessage(),
      models,
      modelSettings: { ...settings.modelSettings, timeout: totalMs ? { totalMs } : undefined },
      options: { ...settings.options, abortSignal },
    } as any);

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }
    return chunks;
  };

  it('terminates a hanging run with a total-timeout error chunk', async () => {
    const chunks = await runLoop({ models: [hangingModel('slow')], totalMs: 100 });

    const errorChunk = chunks.find(chunk => chunk.type === 'error');
    expect(errorChunk).toBeDefined();
    expect(isMastraTimeoutError(errorChunk.payload.error)).toBe(true);
    expect(errorChunk.payload.error.timeoutType).toBe('total');
    expect(chunks.some(chunk => chunk.type === 'finish')).toBe(false);
  });

  it('does not fall back to the next model when the total budget is exhausted', async () => {
    const fallback = respondingModel('fallback', 'from fallback');
    const doStream = vi.spyOn(fallback.model as any, 'doStream');

    const chunks = await runLoop({ models: [hangingModel('slow'), fallback], totalMs: 100 });

    expect(chunks.some(chunk => chunk.type === 'error')).toBe(true);
    expect(doStream).not.toHaveBeenCalled();
  });

  it('leaves a run that finishes within the budget untouched', async () => {
    const chunks = await runLoop({ models: createTestModels(), totalMs: 30_000 });

    expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
    expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
  });

  it('is inert when no total budget is configured', async () => {
    const chunks = await runLoop({ models: createTestModels() });

    expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
    expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
  });

  it('still honours a caller-supplied abort signal', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('user cancelled')), 50);

    const chunks = await runLoop({
      models: [hangingModel('slow')],
      totalMs: 30_000,
      abortSignal: controller.signal,
    });

    // An abort settles the run through the normal abort path (which still emits a finish
    // chunk); what matters is that it is not misreported as a timeout.
    const errorChunk = chunks.find(chunk => chunk.type === 'error');
    if (errorChunk) {
      expect(isMastraTimeoutError(errorChunk.payload.error)).toBe(false);
    }
  });
});
