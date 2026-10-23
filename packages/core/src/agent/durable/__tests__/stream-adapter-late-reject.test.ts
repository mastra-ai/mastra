import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createDurableAgentStream, emitChunkEvent, emitErrorEvent } from '../stream-adapter';
import type { DurableAgentStreamResult } from '../stream-adapter';

describe('durable stream adapter rejection', () => {
  it('delivers chunks queued before a rejecting error to a reader that arrives late', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'late-reject-run';

    const { output, ready, waitForEventDelivery } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
    }) as DurableAgentStreamResult<any>;
    await ready;

    await emitChunkEvent(pubsub, runId, { type: 'start', runId, from: 'AGENT', payload: {} } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'step-start',
      runId,
      from: 'AGENT',
      payload: { messageId: `msg-${runId}`, request: {}, warnings: [] },
    } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'tool-call',
      runId,
      from: 'AGENT',
      payload: { toolCallId: 'call-1', toolName: 'step', args: {} },
    } as any);
    await emitErrorEvent(pubsub, runId, new Error('late failure'), undefined, 'reject');
    await waitForEventDelivery();

    const types: string[] = [];
    let error: unknown;
    try {
      for await (const chunk of output.fullStream) types.push(chunk.type);
    } catch (e) {
      error = e;
    }

    expect(types).toEqual(['start', 'step-start', 'tool-call']);
    expect((error as Error)?.message).toBe('late failure');
    await pubsub.close();
  });
});
