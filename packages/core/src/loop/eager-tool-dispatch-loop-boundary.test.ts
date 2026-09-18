import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Mastra } from '../mastra';
import { createTool } from '../tools';
import { loop } from './loop';
import {
  createMessageListWithUserMessage,
  createTestMastra,
  defaultSettings,
  mockDate,
  testUsage,
} from './test-utils/utils';

/**
 * `Agent.stream()` owns the eager-dispatch default: it resolves `eagerToolExecution`
 * to a boolean before the options reach the agentic-execution workflow, and the
 * workflow starts a coordinator only for an explicit `true`.
 *
 * That split is what keeps every other way into the loop — the durable agent's mirrored
 * steps, a direct `loop()` call — off the eager path by stated condition rather than by
 * the option happening not to be threaded through. Pin both directions here, at the
 * boundary itself, since the durable steps never build this workflow at all and so
 * cannot demonstrate the gate.
 */
describe('loop() only dispatches eagerly when eager execution is asked for explicitly', () => {
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

  const run = async (eagerToolExecution: boolean | undefined) => {
    const events: string[] = [];
    let stepCount = 0;

    const model = new MockLanguageModelV2({
      doStream: async () => {
        const isFirstStep = stepCount++ === 0;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `response-${stepCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });

              if (isFirstStep) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'call-a',
                  toolName: 'tool-a',
                  input: JSON.stringify({ value: 'a' }),
                });
                // A window wide enough for an eager dispatch to be observed, if one
                // was started. Only `Date` is faked, so this timer really elapses.
                await new Promise(resolve => setTimeout(resolve, 100));
                events.push('finish');
                controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: testUsage });
              } else {
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                controller.enqueue({ type: 'finish', finishReason: 'stop', usage: testUsage });
              }
              controller.close();
            },
          }),
        };
      },
    });

    const settings = defaultSettings();
    const result = await loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'test-run-id',
      messageList: createMessageListWithUserMessage(),
      ...(eagerToolExecution === undefined ? {} : { eagerToolExecution }),
      models: [{ model, maxRetries: 0, id: 'test-model' }],
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Ordinary server tool',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            events.push('execute-a');
            return { value };
          },
        }),
      },
    } as any);

    await result.consumeStream();
    return events;
  };

  it('leaves the call to the foreach when the option is omitted', async () => {
    const events = await run(undefined);
    expect(events).toEqual(['finish', 'execute-a']);
  }, 30_000);

  it('starts the call during the stream when the option is explicitly true', async () => {
    const events = await run(true);
    expect(events).toEqual(['execute-a', 'finish']);
  }, 30_000);
});
