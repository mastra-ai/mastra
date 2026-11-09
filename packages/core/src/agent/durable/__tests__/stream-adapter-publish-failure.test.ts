import { describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createDurableAgentStream, emitChunkEvent } from '../stream-adapter';
import type { DurableAgentStreamResult } from '../stream-adapter';

class RejectingPubSub extends EventEmitterPubSub {
  override async publish(): Promise<void> {
    throw new Error('Pubsub transport unavailable');
  }
}

describe('durable stream adapter publish failures', () => {
  it('surfaces the run error without waiting for frames the transport rejected', async () => {
    const pubsub = new CachingPubSub(new RejectingPubSub(), new InMemoryServerCache());
    const logger = { warn: vi.fn() };
    const runId = 'publish-failure-run';

    const { output, ready, fail, cleanup } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      logger: logger as any,
    }) as DurableAgentStreamResult<any>;

    try {
      await ready;

      // The opening frame is cached with its index before the transport rejects
      // it, so the log holds a frame the live subscription will never deliver.
      await expect(
        emitChunkEvent(pubsub, runId, { type: 'start', runId, from: 'AGENT', payload: {} } as any),
      ).rejects.toThrow('Pubsub transport unavailable');

      const started = Date.now();
      await fail(new Error('stream failed'));

      const chunks: any[] = [];
      for await (const chunk of output.fullStream) chunks.push(chunk);
      const elapsed = Date.now() - started;

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].payload.error.message).toBe('stream failed');
      // Well under the reader's 10s pending-frame deadline.
      expect(elapsed).toBeLessThan(1000);
      expect(logger.warn).not.toHaveBeenCalled();
    } finally {
      cleanup();
      await (pubsub.getInner() as EventEmitterPubSub).close();
    }
  });
});
