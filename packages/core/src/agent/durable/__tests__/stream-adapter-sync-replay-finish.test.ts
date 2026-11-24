import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { AgentStreamEventTypes } from '../constants';
import { createDurableAgentStream } from '../stream-adapter';

describe('durable stream adapter replay during subscribe', () => {
  it('finishes a reader whose FINISH is replayed synchronously while it subscribes', async () => {
    const runId = 'sync-replay-finish-run';
    // A replay transport may deliver history inside the subscribe call, before the adapter builds its output.
    class SyncReplayPubSub extends EventEmitterPubSub {
      override async subscribeWithReplay(...args: Parameters<EventEmitterPubSub['subscribeWithReplay']>) {
        const [, callback] = args;
        void callback({
          type: AgentStreamEventTypes.FINISH,
          runId,
          data: {
            output: { text: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [] },
            stepResult: { reason: 'stop', warnings: [], isContinued: false },
          },
        } as any);
        await super.subscribeWithReplay(...args);
      }
    }
    const pubsub = new SyncReplayPubSub();
    const onFinish = vi.fn();
    const { output, cleanup, ready } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      onFinish,
    });

    try {
      await ready;
      const types: string[] = [];
      for await (const chunk of output.fullStream) types.push(chunk.type);
      expect(types).toContain('finish');
      expect(onFinish).toHaveBeenCalledOnce();
    } finally {
      cleanup();
      await pubsub.close();
    }
  });
});
