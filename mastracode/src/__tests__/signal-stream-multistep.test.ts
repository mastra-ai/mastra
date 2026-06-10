import { afterEach, describe, expect, it } from 'vitest';

import { createRealV1Harness } from '../test-utils/real-v1-harness.js';

const cleanups: Array<() => void> = [];

/**
 * Two-turn stream: first turn calls a custom `echo` tool, second turn (after
 * the tool result) emits final text. Proves `signalStream` performs multi-step
 * tool round-trips (maxSteps) and surfaces the tool-result chunk.
 */
function makeStreams() {
  let call = 0;
  return async () => {
    call += 1;
    if (call === 1) {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'tool-call',
              toolCallId: 'call-echo',
              toolName: 'echo',
              input: JSON.stringify({ text: 'hi' }),
              providerExecuted: false,
            });
            controller.enqueue({
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    }
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done: hi' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    };
  };
}

describe('v1 signalStream multi-step tool round-trip', () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it('executes a tool and continues to a final turn under yolo', async () => {
    const echoTool = {
      id: 'echo',
      description: 'Echo the input text.',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
      execute: async ({ text }: { text: string }) => ({ echoed: text }),
    };

    const { harness, cleanup } = createRealV1Harness<{ yolo?: boolean }>({
      doStream: makeStreams(),
      tools: { echo: echoTool as never },
      initialState: { yolo: true },
    });
    cleanups.push(cleanup);
    await harness.init();

    const session = await harness.session({ threadId: 'thread-multistep', resourceId: 'res-1' });
    const output = (await session.signalStream({
      messages: [{ role: 'user', content: 'echo hi' }],
    })) as { fullStream: AsyncIterable<{ type: string }> };

    const seen: string[] = [];
    for await (const chunk of output.fullStream) seen.push(chunk.type);

    // Tool ran and the agent continued to a second turn producing final text.
    expect(seen).toContain('tool-call');
    expect(seen).toContain('tool-result');
    expect(seen).toContain('text-delta');
  });
});
