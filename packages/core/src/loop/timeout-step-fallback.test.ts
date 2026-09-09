import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../mastra';
import type { ModelManagerModelConfig } from '../stream/types';
import { loop } from './loop';
import {
  createMessageListWithUserMessage,
  createTestMastra,
  defaultSettings,
  mockDate,
  testUsage,
} from './test-utils/utils';

describe('modelSettings.timeout drives model fallback', () => {
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

  it('advances to the next model when the first exceeds its first-content budget', async () => {
    const stalling: ModelManagerModelConfig = {
      id: 'stalling-before-content',
      maxRetries: 0,
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]).pipeThrough(
            new TransformStream({
              async transform(chunk, controller) {
                controller.enqueue(chunk);
                await new Promise(() => {});
              },
            }),
          ),
        }),
      }),
    };

    const working: ModelManagerModelConfig = {
      id: 'working-after-first-content-timeout',
      maxRetries: 0,
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'from first-content fallback' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage },
          ]),
        }),
      }),
    };

    const settings = defaultSettings();
    const result = loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'test-run-id',
      messageList: createMessageListWithUserMessage(),
      models: [stalling, working],
      modelSettings: { ...settings.modelSettings, timeout: { firstChunkMs: 100 } },
    } as any);

    expect(await result.text).toBe('from first-content fallback');
  });

  it('preserves call-level firstChunkMs when a model overrides stepMs', async () => {
    const delayed: ModelManagerModelConfig = {
      id: 'delayed-with-step-override',
      maxRetries: 0,
      modelSettings: { timeout: { stepMs: 500 } },
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              await new Promise(resolve => setTimeout(resolve, 100));
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'too late' });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage: testUsage });
              controller.close();
            },
          }),
        }),
      }),
    };

    const working: ModelManagerModelConfig = {
      id: 'working-after-merged-timeout',
      maxRetries: 0,
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: 'merged timeout fallback' },
            { type: 'text-end', id: 'text-2' },
            { type: 'finish', finishReason: 'stop', usage: testUsage },
          ]),
        }),
      }),
    };

    const settings = defaultSettings();
    const result = loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'test-run-id',
      messageList: createMessageListWithUserMessage(),
      models: [delayed, working],
      modelSettings: { ...settings.modelSettings, timeout: { firstChunkMs: 50 } },
    } as any);

    expect(await result.text).toBe('merged timeout fallback');
  });

  it('advances to the next model when the first exceeds its step budget', async () => {
    const stalling: ModelManagerModelConfig = {
      id: 'stalling',
      maxRetries: 0,
      model: new MockLanguageModelV2({ doStream: () => new Promise(() => {}) }),
    };

    const working: ModelManagerModelConfig = {
      id: 'working',
      maxRetries: 0,
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'from fallback' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage },
          ]),
        }),
      }),
    };

    const settings = defaultSettings();
    const result = loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'test-run-id',
      messageList: createMessageListWithUserMessage(),
      models: [stalling, working],
      modelSettings: { ...settings.modelSettings, timeout: { stepMs: 100 } },
    } as any);

    expect(await result.text).toBe('from fallback');
  });
});
