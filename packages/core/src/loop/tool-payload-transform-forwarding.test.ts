import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Mastra } from '../mastra';
import type { ToolPayloadTransformPolicy } from '../tools/types';
import { loop } from './loop';
import {
  createMessageListWithUserMessage,
  createTestMastra,
  createTestModels,
  defaultSettings,
  mockDate,
  testUsage,
} from './test-utils/utils';

/**
 * Regression: `loop()` rebuilds the `_internal` bag before handing it to the
 * agentic loop, and that rebuilt bag is what hydrates the run scope. If it
 * drops `toolPayloadTransform`, the policy never reaches the run scope, so the
 * in-process tool payload transform silently no-ops for every non-durable
 * agent stream that configured one. Drive a real `loop()` run with a tool call
 * and assert the policy actually gets invoked.
 */
describe('loop forwards _internal.toolPayloadTransform to the run scope', () => {
  let mastraRef: { current?: Mastra } = {};
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

  it('invokes the transform policy when the model emits a tool call', async () => {
    let transformInvoked = false;
    const toolPayloadTransform: ToolPayloadTransformPolicy = {
      transformToolPayload: async ctx => {
        transformInvoked = true;
        return ctx.input;
      },
    };

    const settings = defaultSettings();
    const result = await loop({
      ...settings,
      // `defaultSettings()` carries its own `_internal`, so merge into it rather
      // than letting the spread clobber our policy.
      _internal: { ...settings._internal, toolPayloadTransform },
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'test-run-id',
      messageList: createMessageListWithUserMessage(),
      models: createTestModels({
        stream: convertArrayToReadableStream([
          { type: 'tool-input-start', id: 'call-1', toolName: 'web_search', providerExecuted: true },
          { type: 'tool-input-delta', id: 'call-1', delta: '{ "value": "value" }' },
          { type: 'tool-input-end', id: 'call-1' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'web_search',
            input: `{ "value": "value" }`,
            providerExecuted: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'web_search',
            result: `{ "value": "result1" }`,
            providerExecuted: true,
          },
          { type: 'finish', finishReason: 'stop', usage: testUsage },
        ]),
      }),
      tools: {
        web_search: {
          type: 'provider-defined',
          id: 'test.web_search',
          name: 'web_search',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          args: {},
        },
      },
    } as any);

    await result.consumeStream();

    expect(transformInvoked).toBe(true);
  });
});
