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

describe('modelSettings.timeout.stepMs drives model fallback', () => {
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
