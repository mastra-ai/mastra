import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { isMastraTimeoutError } from '../../../loop/timeout';
import { execute } from './execute';

/**
 * With step timeout wrapping consumption, stalled streams should surface MastraTimeoutError once stepMs elapses mid-read.
 */
describe('stepMs vs mid-stream stall', () => {
  it('surfaces MastraTimeoutError from stepMs while the returned stream hangs after first tokens', async () => {
    const STEP_MS = 400;

    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'x' });
            // Intentionally omit finish/close — simulates stall mid-stream.
          },
        }),
        warnings: [],
        request: { body: '' },
        response: { headers: {} },
      }),
    });

    const out = execute({
      runId: 'repro-step-ms-stall',
      model: model as any,
      inputMessages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 0, timeout: { stepMs: STEP_MS } },
    });

    const reader = out.getReader();
    async function consume() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.type === 'error' && 'error' in value) {
          throw (value as { error: unknown }).error;
        }
      }
    }

    let caught: unknown;
    try {
      await consume();
      expect.fail('expected timeout');
    } catch (e) {
      caught = e;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        //
      }
    }

    expect(caught !== undefined && isMastraTimeoutError(caught)).toBe(true);
  });
});
