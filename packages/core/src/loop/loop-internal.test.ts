import { ReadableStream } from 'node:stream/web';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import type { LoopRun } from './types';

let capturedLoopRun: LoopRun | undefined;

vi.mock('./workflows/stream', () => ({
  workflowLoopStream: (loopRun: LoopRun) => {
    capturedLoopRun = loopRun;
    return new ReadableStream({ start: controller => controller.close() });
  },
}));

const { loop } = await import('./loop');

describe('loop internal bootstrap', () => {
  it('preserves tool payload transform while rebuilding _internal', () => {
    const toolPayloadTransform = {
      targets: ['display'],
      transformToolPayload: vi.fn(),
    };

    loop({
      agentId: 'test-agent',
      messageList: new MessageList(),
      models: [
        {
          model: {
            modelId: 'test-model',
            provider: 'test-provider',
            specificationVersion: 'v2',
          },
        } as any,
      ],
      _internal: {
        toolPayloadTransform: toolPayloadTransform as any,
      },
    });

    expect(capturedLoopRun?._internal?.toolPayloadTransform).toBe(toolPayloadTransform);
  });
});
