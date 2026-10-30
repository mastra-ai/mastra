import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MastraTimeoutError } from '../../../loop/timeout';
import { createDurableAgentStream, emitChunkEvent, emitErrorEvent } from '../stream-adapter';
import type { DurableAgentStreamResult } from '../stream-adapter';

async function errorChunksFor(runId: string, chunkError: Error, runError: Error) {
  const pubsub = new EventEmitterPubSub();
  const { output, ready, waitForEventDelivery } = createDurableAgentStream({
    pubsub,
    runId,
    messageId: `msg-${runId}`,
    model: { modelId: 'test', provider: 'test', version: 'v3' },
  }) as DurableAgentStreamResult<any>;
  await ready;

  await emitChunkEvent(pubsub, runId, { type: 'start', runId, from: 'AGENT', payload: {} } as any);
  // A step that saw the deadline streams it as an error chunk; the run then reports its own error.
  await emitChunkEvent(pubsub, runId, { type: 'error', runId, from: 'AGENT', payload: { error: chunkError } } as any);
  await emitErrorEvent(pubsub, runId, runError);
  await waitForEventDelivery();

  const errors: unknown[] = [];
  for await (const chunk of output.fullStream) {
    if (chunk.type === 'error') errors.push((chunk.payload as { error: unknown }).error);
  }
  await pubsub.close();
  return errors;
}

describe('durable stream adapter total-timeout error', () => {
  it('reports a total timeout once when a step streamed it before the run reported it', async () => {
    const timeout = () => new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 4_000 });
    const errors = await errorChunksFor('timeout-dedupe-run', timeout(), timeout());

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ name: 'MastraTimeoutError' });
  });

  it('still reports a run error that differs from the streamed one', async () => {
    const errors = await errorChunksFor(
      'timeout-distinct-run',
      new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 4_000 }),
      new Error('run failed'),
    );

    expect(errors).toHaveLength(2);
    expect(errors[1]).toMatchObject({ message: 'run failed' });
  });
});
